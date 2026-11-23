// Bottom strip: slide thumbnails, add / duplicate / delete / hide / reorder by drag, right-click menu, grid view.
import { state, emit, on, commit, newSlide, clone, uid, undo } from './store.js';
import { miniSlide } from './render.js';
import { ic } from './assets.js';
import { popover, closePopover, toast, contextMenu, modal, closeModal } from './ui.js';
import { t as tr } from './i18n.js';
import { hasAnim } from './anim.js';

const $ = (s) => document.querySelector(s);
const TH = 86;

export function initSlides() {
  on((w) => {
    if (['all', 'slide', 'history'].includes(w)) renderStrip();
    else if (w === 'canvas') { clearTimeout(initSlides.t); initSlides.t = setTimeout(refreshThumb, 250); }
  });
  document.addEventListener('deckly-slide-dup', () => dupSlide(state.slide));
  document.addEventListener('deckly-slide-del', () => delSlide(state.slide));
  document.addEventListener('deckly-slide-nav', (e) => go(state.slide + e.detail));
  $('#gridViewBtn').onclick = gridView;
}

export function go(i) {
  if (!state.doc) return;
  i = Math.max(0, Math.min(state.doc.slides.length - 1, i));
  if (i === state.slide) return;
  state.slide = i; state.sel = []; state.editingId = null; state.cell = null;
  emit('slide');
}

function thumb(i) {
  const D = state.doc, w = TH * D.w / D.h, s = D.slides[i];
  const t = document.createElement('button');
  t.className = 'slide-thumb' + (i === state.slide ? ' active' : '') + (s.hidden ? ' hidden-slide' : '');
  t.style.width = w + 'px'; t.draggable = true; t.dataset.i = i;
  t.setAttribute('aria-label', tr('Slide {n} of {m}', { n: i + 1, m: D.slides.length }));
  t.innerHTML = `<span class="num-tag">${i + 1}${s.hidden ? ' ' + ic('eye-off', 'ic') : ''}</span><span class="more" title="${tr('Slide options')}">${ic('ellipsis')}</span><div class="mini"></div>${s.transition || s.elements.some(hasAnim) ? `<span class="anim-badge" title="${tr('Animated')}">${ic('sparkles')}</span>` : ''}`;
  t.querySelector('.mini').appendChild(miniSlide(s, D, w - 4));
  return t;
}

function renderStrip() {
  const strip = $('#slidesStrip'); if (!state.doc) return;
  strip.innerHTML = '';
  state.doc.slides.forEach((_, i) => strip.appendChild(thumb(i)));
  const add = document.createElement('button'); add.className = 'add-slide'; add.innerHTML = `${ic('plus')}${tr('Add slide')}`;
  add.onclick = () => addSlide(state.slide);
  strip.appendChild(add);
  strip.onclick = (e) => {
    const more = e.target.closest('.more'), t = e.target.closest('.slide-thumb');
    if (more) { e.stopPropagation(); const r = more.getBoundingClientRect(); menu(r.left, r.bottom + 4, Number(t.dataset.i)); return; }
    if (t) go(Number(t.dataset.i));
  };
  strip.oncontextmenu = (e) => { const t = e.target.closest('.slide-thumb'); if (!t) return; e.preventDefault(); go(Number(t.dataset.i)); menu(e.clientX, e.clientY, Number(t.dataset.i)); };
  let from = null;
  strip.ondragstart = (e) => { const t = e.target.closest('.slide-thumb'); if (!t) return; from = Number(t.dataset.i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'slide'); };
  strip.ondragover = (e) => { if (from == null) return; e.preventDefault(); strip.querySelectorAll('.drop-before').forEach((n) => n.classList.remove('drop-before')); const t = e.target.closest('.slide-thumb'); if (t) t.classList.add('drop-before'); };
  strip.ondrop = (e) => {
    e.preventDefault(); const t = e.target.closest('.slide-thumb');
    const to = t ? Number(t.dataset.i) : state.doc.slides.length;
    moveSlide(from, to); from = null;
  };
  strip.ondragend = () => { from = null; strip.querySelectorAll('.drop-before').forEach((n) => n.classList.remove('drop-before')); };
  strip.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function moveSlide(from, to) {
  if (from == null || to === from) return;
  const cur = state.doc.slides[state.slide];
  const [s] = state.doc.slides.splice(from, 1);
  state.doc.slides.splice(to > from ? to - 1 : to, 0, s);
  state.slide = state.doc.slides.indexOf(cur);
  commit(); emit('slide');
}
function refreshThumb() {
  const t = $(`#slidesStrip .slide-thumb[data-i="${state.slide}"] .mini`); if (!t) return;
  const D = state.doc; t.innerHTML = ''; t.appendChild(miniSlide(D.slides[state.slide], D, TH * D.w / D.h - 4));
}
export function addSlide(after = state.slide) {
  state.doc.slides.splice(after + 1, 0, newSlide(clone(state.doc.slides[after].bg))); state.slide = after + 1; state.sel = []; commit(); emit('slide');
}
function menu(x, y, i) {
  const s = state.doc.slides[i];
  contextMenu(x, y, [
    { icon: 'plus', label: 'New slide after', act: 'add', kbd: 'Ctrl Enter' }, { icon: 'copy-plus', label: 'Duplicate slide', act: 'dup' }, 'sep',
    { icon: 'arrow-left', label: 'Move left', act: 'up', disabled: i === 0 }, { icon: 'arrow-right', label: 'Move right', act: 'down', disabled: i === state.doc.slides.length - 1 },
    { icon: s.hidden ? 'eye' : 'eye-off', label: s.hidden ? 'Show in the presentation' : 'Hide from the presentation', act: 'hide' }, { icon: 'layout-grid', label: 'Slide grid', act: 'grid' }, 'sep',
    { icon: 'trash-2', label: 'Delete slide', act: 'del', danger: true },
  ], (m) => {
    if (m === 'add') addSlide(i); if (m === 'dup') dupSlide(i); if (m === 'del') delSlide(i); if (m === 'grid') gridView();
    if (m === 'hide') { s.hidden = !s.hidden; commit(); emit('slide'); }
    if (m === 'up' || m === 'down') { const j = i + (m === 'up' ? -1 : 1); if (j < 0 || j >= state.doc.slides.length) return; const S = state.doc.slides; [S[i], S[j]] = [S[j], S[i]]; state.slide = j; commit(); emit('slide'); }
  });
}
function dupSlide(i) {
  const s = clone(state.doc.slides[i]); s.id = uid(); s.elements.forEach((e) => { e.mid = e.mid || e.id; e.id = uid(); }); // mid links the copies to the originals (Match & move)
  state.doc.slides.splice(i + 1, 0, s); state.slide = i + 1; state.sel = []; commit(); emit('slide');
}
function delSlide(i) {
  if (state.doc.slides.length === 1) { state.doc.slides[0] = newSlide(); state.sel = []; commit(); emit('slide'); return; }
  state.doc.slides.splice(i, 1); state.slide = Math.min(state.slide, state.doc.slides.length - 1); state.sel = []; commit(); emit('slide');
  toast('Slide deleted', { label: 'Undo', fn: undo });
}
// every slide at once: reorder by drag, duplicate, hide, delete
export function gridView() {
  const D = state.doc;
  const draw = () => {
    modal(`<h3>${ic('layout-grid')} ${tr('Slide grid')}</h3><p class="hint" style="font-size:13px">${tr('Drag to reorder. Click a slide to open it.')}</p><div class="slide-grid" id="sg"></div><div style="text-align:right;margin-top:12px"><button class="btn primary" data-close>${tr('Done')}</button></div>`, { width: 980 });
    const g = document.querySelector('#sg'); let from = null;
    D.slides.forEach((s, i) => {
      const it = document.createElement('div'); it.className = 'sg-item' + (i === state.slide ? ' active' : ''); it.draggable = true; it.dataset.i = i;
      it.innerHTML = `<span class="num">${i + 1}${s.hidden ? ' ' + ic('eye-off') : ''}</span><div class="acts"><button data-a="dup" title="${tr('Duplicate slide')}">${ic('copy-plus')}</button><button data-a="hide" title="${tr(s.hidden ? 'Show in the presentation' : 'Hide from the presentation')}">${ic(s.hidden ? 'eye' : 'eye-off')}</button><button data-a="del" title="${tr('Delete slide')}">${ic('trash-2')}</button></div>`;
      it.appendChild(miniSlide(s, D, 200)); if (s.hidden) it.style.opacity = '.55';
      it.onclick = (e) => { const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'dup') { dupSlide(i); draw(); return; } if (a === 'del') { delSlide(i); draw(); return; } if (a === 'hide') { s.hidden = !s.hidden; commit(); emit('slide'); draw(); return; } state.slide = i; state.sel = []; emit('slide'); closeModal(); };
      it.ondragstart = () => { from = i; };
      it.ondragover = (e) => { e.preventDefault(); g.querySelectorAll('.drop-before').forEach((n) => n.classList.remove('drop-before')); it.classList.add('drop-before'); };
      it.ondrop = (e) => { e.preventDefault(); moveSlide(from, i); from = null; draw(); };
      it.ondragend = () => g.querySelectorAll('.drop-before').forEach((n) => n.classList.remove('drop-before'));
      g.appendChild(it);
    });
  };
  draw();
}
