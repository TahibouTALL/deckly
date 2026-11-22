// Bottom strip: slide thumbnails, add / duplicate / delete / reorder by drag.
import { state, emit, on, commit, newSlide, clone, uid } from './store.js';
import { miniSlide } from './render.js';
import { ic } from './assets.js';
import { popover, closePopover, toast } from './ui.js';
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
}

export function go(i) {
  if (!state.doc) return;
  i = Math.max(0, Math.min(state.doc.slides.length - 1, i));
  if (i === state.slide) return;
  state.slide = i; state.sel = []; state.editingId = null;
  emit('slide');
}

function thumb(i) {
  const D = state.doc, w = TH * D.w / D.h;
  const t = document.createElement('div');
  t.className = 'slide-thumb' + (i === state.slide ? ' active' : '');
  t.style.width = w + 'px'; t.draggable = true; t.dataset.i = i;
  t.innerHTML = `<span class="num-tag">${i + 1}</span><button class="more" title="${tr('Slide options')}">${ic('ellipsis')}</button><div class="mini"></div>${state.doc.slides[i].transition || state.doc.slides[i].elements.some(hasAnim) ? `<span class="anim-badge" title="${tr('Animated')}">${ic('sparkles')}</span>` : ''}`;
  t.querySelector('.mini').appendChild(miniSlide(D.slides[i], D, w - 4));
  return t;
}

function renderStrip() {
  const strip = $('#slidesStrip'); if (!state.doc) return;
  strip.innerHTML = '';
  state.doc.slides.forEach((_, i) => strip.appendChild(thumb(i)));
  const add = document.createElement('button'); add.className = 'add-slide'; add.innerHTML = `${ic('plus')}${tr('Add slide')}`;
  add.onclick = () => { state.doc.slides.splice(state.slide + 1, 0, newSlide(clone(state.doc.slides[state.slide].bg))); state.slide++; state.sel = []; commit(); emit('slide'); };
  strip.appendChild(add);
  strip.onclick = (e) => {
    const more = e.target.closest('.more'), t = e.target.closest('.slide-thumb');
    if (more) { e.stopPropagation(); menu(more, Number(t.dataset.i)); return; }
    if (t) go(Number(t.dataset.i));
  };
  // drag to reorder
  let from = null;
  strip.ondragstart = (e) => { const t = e.target.closest('.slide-thumb'); if (!t) return; from = Number(t.dataset.i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'slide'); };
  strip.ondragover = (e) => { if (from == null) return; e.preventDefault(); strip.querySelectorAll('.drop-before').forEach((n) => n.classList.remove('drop-before')); const t = e.target.closest('.slide-thumb'); if (t) t.classList.add('drop-before'); };
  strip.ondrop = (e) => {
    e.preventDefault(); const t = e.target.closest('.slide-thumb');
    const to = t ? Number(t.dataset.i) : state.doc.slides.length;
    if (from != null && to !== from) {
      const cur = state.doc.slides[state.slide];
      const [s] = state.doc.slides.splice(from, 1);
      state.doc.slides.splice(to > from ? to - 1 : to, 0, s);
      state.slide = state.doc.slides.indexOf(cur);
      commit(); emit('slide');
    }
    from = null;
  };
  strip.ondragend = () => { from = null; strip.querySelectorAll('.drop-before').forEach((n) => n.classList.remove('drop-before')); };
  strip.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function refreshThumb() {
  const t = $(`#slidesStrip .slide-thumb[data-i="${state.slide}"] .mini`); if (!t) return;
  const D = state.doc; t.innerHTML = ''; t.appendChild(miniSlide(D.slides[state.slide], D, TH * D.w / D.h - 4));
}

function menu(anchor, i) {
  popover(anchor, `<div class="pop-list"><button data-m="dup">${ic('copy-plus')} Duplicate slide</button><button data-m="up">${ic('arrow-left')} Move left</button><button data-m="down">${ic('arrow-right')} Move right</button><button data-m="del">${ic('trash-2')} Delete slide</button></div>`, (p) => {
    p.onclick = (e) => {
      const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return; closePopover();
      if (m === 'dup') dupSlide(i); if (m === 'del') delSlide(i);
      if (m === 'up' || m === 'down') { const j = i + (m === 'up' ? -1 : 1); if (j < 0 || j >= state.doc.slides.length) return; const S = state.doc.slides; [S[i], S[j]] = [S[j], S[i]]; state.slide = j; commit(); emit('slide'); }
    };
  });
}
function dupSlide(i) {
  const s = clone(state.doc.slides[i]); s.id = uid(); s.elements.forEach((e) => { e.mid = e.mid || e.id; e.id = uid(); }); // mid links the copies to the originals (Match & move)
  state.doc.slides.splice(i + 1, 0, s); state.slide = i + 1; state.sel = []; commit(); emit('slide');
}
function delSlide(i) {
  if (state.doc.slides.length === 1) { state.doc.slides[0] = newSlide(); state.sel = []; commit(); emit('slide'); return; }
  state.doc.slides.splice(i, 1); state.slide = Math.min(state.slide, state.doc.slides.length - 1); state.sel = []; commit(); emit('slide');
  toast('Slide deleted — Ctrl+Z to undo');
}
