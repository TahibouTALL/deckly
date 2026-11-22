// The canvas: rendering, selection, drag / resize / rotate with smart guides, text editing, shortcuts.
import { state, emit, on, commit, curSlide, findEl, selected, uid, clone, undo, redo } from './store.js';
import { elementNode, bgCss, innerHtml, elStyle } from './render.js';
import { ic } from './assets.js';
import { t as tr } from './i18n.js';

const $ = (s) => document.querySelector(s);
let stage, overlay, wrap, viewport;
const SNAP = 6; // screen px

export function initEditor() {
  stage = $('#stage'); overlay = $('#overlay'); wrap = $('#stageWrap'); viewport = $('#viewport');
  new ResizeObserver(() => fit()).observe(viewport);
  viewport.addEventListener('pointerdown', onDown);
  viewport.addEventListener('dblclick', onDbl);
  viewport.addEventListener('pointermove', onHover);
  viewport.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(Math.max(0.1, Math.min(4, state.scale * (e.deltaY < 0 ? 1.1 : 0.9))));
  }, { passive: false });
  document.addEventListener('keydown', onKey);
  document.addEventListener('copy', onCopy); document.addEventListener('paste', onPaste);
  on((what) => {
    if (['all', 'slide', 'canvas'].includes(what)) renderStage();
    if (['all', 'slide', 'canvas', 'sel'].includes(what)) renderOverlay();
  });
  // drop files / panel items onto the canvas
  viewport.addEventListener('dragover', (e) => { e.preventDefault(); });
  viewport.addEventListener('drop', (e) => {
    e.preventDefault();
    const p = toStage(e.clientX, e.clientY);
    const item = e.dataTransfer.getData('application/x-deckly');
    if (item) { document.dispatchEvent(new CustomEvent('deckly-drop', { detail: { item: JSON.parse(item), x: p.x, y: p.y } })); return; }
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) document.dispatchEvent(new CustomEvent('deckly-files', { detail: { files, x: p.x, y: p.y } }));
  });
}

// ---------- zoom / fit ----------
export function fit() {
  if (!state.doc || !viewport) return;
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  const s = state.zoom === 'fit' ? Math.min((vw - 80) / state.doc.w, (vh - 60) / state.doc.h) : state.zoom;
  state.scale = Math.max(0.05, s);
  wrap.style.width = state.doc.w * state.scale + 'px';
  wrap.style.height = state.doc.h * state.scale + 'px';
  wrap.style.margin = state.zoom === 'fit' ? 'auto' : '40px';
  stage.style.width = state.doc.w + 'px'; stage.style.height = state.doc.h + 'px';
  stage.style.transform = `scale(${state.scale})`;
  $('#zoomVal').textContent = state.zoom === 'fit' ? tr('Fit') : Math.round(state.scale * 100) + '%';
  renderOverlay();
}
export function setZoom(z) { state.zoom = z; fit(); }

// ---------- render ----------
export function renderStage() {
  if (!state.doc) return;
  const slide = curSlide();
  stage.style.background = bgCss(slide.bg).replace(/^background:/, '');
  stage.innerHTML = '';
  for (const el of slide.elements) {
    if (el.hidden) continue;
    const n = elementNode(el);
    if (el.id === state.editingId) n.classList.add('editing');
    stage.appendChild(n);
  }
  measureTexts();
  fit();
  if (state.editingId && findEl(state.editingId)) startEditing(state.editingId, false);
}
// keep text boxes' stored height equal to their rendered height
function measureTexts() {
  for (const el of curSlide().elements) {
    if (el.type !== 'text') continue;
    const n = stage.querySelector(`[data-id="${el.id}"]`); if (!n) continue;
    const h = Math.ceil(n.offsetHeight);
    if (h && Math.abs(h - el.h) > 0.5) el.h = h;
  }
}
// cheap update of one element (during drags)
export function patchNode(el) {
  const n = stage.querySelector(`[data-id="${el.id}"]`); if (!n) return;
  n.style.cssText = elStyle(el);
  if (el.type !== 'text') n.querySelector('.inner').innerHTML = innerHtml(el);
  else if (el.id !== state.editingId) n.querySelector('.inner').innerHTML = innerHtml(el);
  if (el.type === 'text') el.h = Math.ceil(n.offsetHeight) || el.h;
}

let floatTools;
export function renderOverlay(busyText) {
  if (!overlay) return;
  overlay.innerHTML = '';
  const s = state.scale;
  const els = selected();
  if (!els.length) return;
  if (els.length === 1) {
    const el = els[0];
    const box = document.createElement('div');
    box.className = 'sel' + (busyText ? ' busy' : '');
    box.style.cssText = `left:${el.x * s}px;top:${el.y * s}px;width:${el.w * s}px;height:${el.h * s}px;transform:rotate(${el.rot || 0}deg)`;
    if (!el.locked && el.id !== state.editingId) {
      const handles = el.type === 'text' ? ['nw', 'ne', 'sw', 'se', 'e', 'w']
        : ['icon', 'sticker', 'logo', 'svg'].includes(el.type) ? ['nw', 'ne', 'sw', 'se']
          : ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
      box.innerHTML = handles.map((h) => `<div class="h ${h}${h.length === 1 ? ' side' : ''}" data-h="${h}"></div>`).join('')
        + `<div class="rot" data-h="rot">${ic('rotate-cw')}</div>`;
    }
    box.innerHTML += `<div class="size-tag">${busyText || ''}</div>`;
    overlay.appendChild(box);
  } else {
    const b = bounds(els);
    const box = document.createElement('div');
    box.className = 'sel multi';
    box.style.cssText = `left:${b.x * s}px;top:${b.y * s}px;width:${b.w * s}px;height:${b.h * s}px`;
    overlay.appendChild(box);
  }
  if (!busyText && state.editingId == null) {
    const b = bounds(els);
    floatTools = document.createElement('div');
    floatTools.className = 'float-tools';
    const top = b.y * s - 48;
    floatTools.style.cssText = `left:${(b.x + b.w / 2) * s}px;top:${top < -40 ? (b.y + b.h) * s + 56 : top}px`;
    const lock = els.every((e) => e.locked);
    floatTools.innerHTML = `<button data-ft="dup" title="${tr('Duplicate (Ctrl+D)')}">${ic('copy-plus')}</button>`
      + `<button data-ft="lock" title="${tr(lock ? 'Unlock' : 'Lock')}">${ic(lock ? 'lock' : 'lock-open')}</button>`
      + `<button data-ft="del" title="${tr('Delete')}">${ic('trash-2')}</button>`;
    floatTools.addEventListener('pointerdown', (e) => e.stopPropagation());
    floatTools.addEventListener('click', (e) => {
      const b2 = e.target.closest('[data-ft]'); if (!b2) return;
      if (b2.dataset.ft === 'dup') duplicate();
      if (b2.dataset.ft === 'del') removeSel();
      if (b2.dataset.ft === 'lock') { els.forEach((x) => (x.locked = !lock)); commit(); emit('canvas'); }
    });
    overlay.appendChild(floatTools);
  }
}

export function bounds(els) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const e of els) { x1 = Math.min(x1, e.x); y1 = Math.min(y1, e.y); x2 = Math.max(x2, e.x + e.w); y2 = Math.max(y2, e.y + e.h); }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
export function toStage(cx, cy) {
  const r = wrap.getBoundingClientRect();
  return { x: (cx - r.left) / state.scale, y: (cy - r.top) / state.scale };
}

// ---------- selection ----------
export function select(ids, add = false) {
  if (state.editingId) stopEditing();
  // clicking one element of a group selects the whole group
  const groups = new Set(ids.map((id) => findEl(id)?.group).filter(Boolean));
  if (groups.size) ids = [...new Set([...ids, ...curSlide().elements.filter((e) => groups.has(e.group)).map((e) => e.id)])];
  state.sel = add ? [...new Set([...state.sel, ...ids])] : ids;
  emit('sel');
}
export function groupSel() {
  const els = selected(); if (els.length < 2) return;
  const g = 'g' + uid(); els.forEach((e) => (e.group = g));
  commit(); emit('canvas');
}
export function ungroupSel() {
  const els = selected(); if (!els.some((e) => e.group)) return;
  els.forEach((e) => delete e.group);
  commit(); emit('canvas');
}
export const isOneGroup = (els) => els.length > 1 && els[0].group && els.every((e) => e.group === els[0].group);
// copies of grouped elements form new groups of their own
function regroup(copies) {
  const map = {};
  for (const c of copies) if (c.group) c.group = map[c.group] ||= 'g' + uid();
  return copies;
}

function hitEl(target) {
  const n = target.closest('.stage .el');
  return n ? findEl(n.dataset.id) : null;
}

function onHover(e) {
  if (drag) return;
  overlay.querySelectorAll('.hover-box').forEach((n) => n.remove());
  const el = hitEl(e.target);
  if (!el || state.sel.includes(el.id)) return;
  const s = state.scale;
  const hb = document.createElement('div'); hb.className = 'hover-box';
  hb.style.cssText = `left:${el.x * s}px;top:${el.y * s}px;width:${el.w * s}px;height:${el.h * s}px;transform:rotate(${el.rot || 0}deg)`;
  overlay.prepend(hb);
}

// ---------- pointer interactions ----------
let drag = null;
function onDown(e) {
  if (e.button !== 0) return;
  const handle = e.target.closest('[data-h]');
  const p = toStage(e.clientX, e.clientY);
  if (state.editingId) {
    const n = e.target.closest('.el.editing');
    if (n) return; // clicks inside the text being edited
    stopEditing();
  }
  if (handle) {
    const el = selected()[0];
    drag = { mode: handle.dataset.h === 'rot' ? 'rot' : 'resize', h: handle.dataset.h, el, start: p, orig: clone(el) };
  } else {
    const el = hitEl(e.target);
    if (el) {
      if (e.shiftKey) { select(state.sel.includes(el.id) ? state.sel.filter((i) => i !== el.id) : [...state.sel, el.id]); return; }
      const already = state.sel.includes(el.id);
      if (!already) select([el.id]);
      const els = selected().filter((x) => !x.locked);
      if (!els.length) return;
      if (e.altKey) { // alt-drag duplicates
        const copies = regroup(els.map((x) => ({ ...clone(x), id: uid() })));
        curSlide().elements.push(...copies); emit('canvas'); select(copies.map((c) => c.id));
        drag = { mode: 'move', els: copies, start: p, origs: copies.map(clone), moved: false };
      } else drag = { mode: 'move', els, start: p, origs: els.map(clone), moved: false, pickOne: already && el.group && state.sel.length > 1 ? el.id : null };
    } else {
      select([]);
      drag = { mode: 'marquee', start: p, sx: e.clientX, sy: e.clientY };
    }
  }
  viewport.setPointerCapture(e.pointerId);
  viewport.addEventListener('pointermove', onMove);
  viewport.addEventListener('pointerup', onUp, { once: true });
}

function onMove(e) {
  if (!drag) return;
  const p = toStage(e.clientX, e.clientY);
  const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
  if (drag.mode === 'move') {
    if (!drag.moved && Math.hypot(dx, dy) * state.scale < 3) return;
    drag.moved = true;
    const ob = bounds(drag.origs);
    let nx = ob.x + dx, ny = ob.y + dy;
    const g = e.ctrlKey ? { x: nx, y: ny, lines: [] } : snapMove(nx, ny, ob.w, ob.h, drag.els.map((x) => x.id));
    drag.els.forEach((el, i) => { el.x = drag.origs[i].x + (g.x - ob.x); el.y = drag.origs[i].y + (g.y - ob.y); patchNode(el); });
    renderOverlay(`x ${Math.round(g.x)}  y ${Math.round(g.y)}`); drawGuides(g.lines);
  } else if (drag.mode === 'resize') resizeMove(p, e.shiftKey);
  else if (drag.mode === 'rot') {
    const o = drag.orig, cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    let a = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI - 90;
    a = ((a % 360) + 360) % 360;
    if (!e.shiftKey) for (const t of [0, 45, 90, 135, 180, 225, 270, 315, 360]) if (Math.abs(a - t) < 4) a = t % 360;
    drag.el.rot = Math.round(a);
    patchNode(drag.el); renderOverlay(`${drag.el.rot}°`);
  } else if (drag.mode === 'marquee') {
    const m = $('#marquee'), vr = viewport.getBoundingClientRect();
    const x1 = Math.min(drag.sx, e.clientX) - vr.left + viewport.scrollLeft, y1 = Math.min(drag.sy, e.clientY) - vr.top + viewport.scrollTop;
    m.classList.remove('hidden');
    m.style.cssText = `left:${x1}px;top:${y1}px;width:${Math.abs(e.clientX - drag.sx)}px;height:${Math.abs(e.clientY - drag.sy)}px`;
    const r = { x: Math.min(drag.start.x, p.x), y: Math.min(drag.start.y, p.y), x2: Math.max(drag.start.x, p.x), y2: Math.max(drag.start.y, p.y) };
    drag.hits = curSlide().elements.filter((el) => !el.hidden && !el.locked && el.x < r.x2 && el.x + el.w > r.x && el.y < r.y2 && el.y + el.h > r.y).map((el) => el.id);
  }
}

function onUp() {
  viewport.removeEventListener('pointermove', onMove);
  const d = drag; drag = null;
  drawGuides([]);
  if (!d) return;
  if (d.mode === 'marquee') { $('#marquee').classList.add('hidden'); if (d.hits?.length) select(d.hits); return; }
  if (d.mode === 'move' && !d.moved) {
    // second click inside a selected group: select just that piece
    if (d.pickOne) { state.sel = [d.pickOne]; emit('sel'); return; }
    renderOverlay(); return;
  }
  commit(); emit('canvas');
}

function resizeMove(p, keepRatio) {
  const o = drag.orig, el = drag.el, h = drag.h;
  const rad = (o.rot || 0) * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  // pointer delta in the element's local (unrotated) frame
  const ddx = p.x - drag.start.x, ddy = p.y - drag.start.y;
  const lx = ddx * cos + ddy * sin, ly = -ddx * sin + ddy * cos;
  let w = o.w, hh = o.h, ox = 0, oy = 0; // ox/oy = local shift of the top-left
  if (h.includes('e')) w = o.w + lx;
  if (h.includes('w')) { w = o.w - lx; ox = lx; }
  if (h.includes('s')) hh = o.h + ly;
  if (h.includes('n')) { hh = o.h - ly; oy = ly; }
  const corner = h.length === 2;
  // corners keep proportions (Shift frees them); shapes are free (Shift locks); icons and text always keep them
  const always = ['icon', 'sticker', 'logo', 'svg', 'text'].includes(el.type);
  const ratioLock = corner && (always || (el.type === 'shape' ? keepRatio : !keepRatio));
  if (ratioLock) {
    const k = Math.max(w / o.w, hh / o.h);
    w = o.w * k; hh = o.h * k;
    if (h.includes('w')) ox = o.w - w; if (h.includes('n')) oy = o.h - hh;
  }
  const min = 12;
  if (w < min) { if (h.includes('w')) ox -= min - w; w = min; }
  if (hh < min) { if (h.includes('n')) oy -= min - hh; hh = min; }
  // keep the opposite corner fixed under rotation
  const cx0 = o.x + o.w / 2, cy0 = o.y + o.h / 2;
  const ncxL = ox + w / 2 - o.w / 2, ncyL = oy + hh / 2 - o.h / 2;
  const ncx = cx0 + ncxL * cos - ncyL * sin, ncy = cy0 + ncxL * sin + ncyL * cos;
  el.w = w; el.h = hh; el.x = ncx - w / 2; el.y = ncy - hh / 2;
  if (el.type === 'text' && corner) {
    el.size = Math.max(6, Math.round(o.size * (w / o.w) * 10) / 10);
  }
  patchNode(el);
  renderOverlay(`${Math.round(el.w)} × ${Math.round(el.h)}`);
}

// ---------- smart guides ----------
function snapMove(x, y, w, h, ignore) {
  const t = SNAP / state.scale, D = state.doc;
  const xs = [0, D.w / 2, D.w], ys = [0, D.h / 2, D.h];
  for (const e of curSlide().elements) {
    if (ignore.includes(e.id) || e.hidden) continue;
    xs.push(e.x, e.x + e.w / 2, e.x + e.w); ys.push(e.y, e.y + e.h / 2, e.y + e.h);
  }
  const lines = [];
  const best = (vals, cands) => {
    let bd = t, out = null;
    for (const [off, v] of vals) for (const c of cands) { const dd = Math.abs(v - c); if (dd < bd) { bd = dd; out = { shift: c - v, at: c }; } }
    return out;
  };
  const bx = best([[0, x], [w / 2, x + w / 2], [w, x + w]], xs);
  const by = best([[0, y], [h / 2, y + h / 2], [h, y + h]], ys);
  if (bx) { x += bx.shift; lines.push({ v: true, at: bx.at }); }
  if (by) { y += by.shift; lines.push({ v: false, at: by.at }); }
  return { x, y, lines };
}
function drawGuides(lines) {
  overlay.querySelectorAll('.guide').forEach((n) => n.remove());
  for (const l of lines) {
    const g = document.createElement('div');
    g.className = 'guide ' + (l.v ? 'v' : 'h');
    if (l.v) g.style.left = l.at * state.scale + 'px'; else g.style.top = l.at * state.scale + 'px';
    overlay.appendChild(g);
  }
}

// ---------- text editing ----------
function onDbl(e) {
  // pointer capture retargets dblclick to the viewport, so hit-test at the click point
  const el = hitEl(document.elementFromPoint(e.clientX, e.clientY) || e.target);
  if (el?.type === 'text' && !el.locked) startEditing(el.id);
  else if (el?.type === 'image') document.dispatchEvent(new CustomEvent('deckly-image-dbl', { detail: el }));
}
export function startEditing(id, selectAll = true) {
  const el = findEl(id); if (!el) return;
  state.sel = [id]; state.editingId = id;
  const n = stage.querySelector(`[data-id="${id}"]`); if (!n) return;
  n.classList.add('editing');
  const t = n.querySelector('.txt');
  t.contentEditable = 'true'; t.spellcheck = true;
  t.focus();
  const r = document.createRange(); r.selectNodeContents(t); if (!selectAll) r.collapse(false);
  window.getSelection().removeAllRanges(); window.getSelection().addRange(r);
  t.addEventListener('input', () => { el.html = cleanHtml(t.innerHTML); el.h = n.offsetHeight; renderOverlay(); });
  t.addEventListener('paste', (ev) => { ev.preventDefault(); document.execCommand('insertText', false, ev.clipboardData.getData('text/plain')); });
  emit('sel');
}
export function stopEditing() {
  const id = state.editingId; if (!id) return;
  state.editingId = null;
  const el = findEl(id);
  const n = stage.querySelector(`[data-id="${id}"]`);
  if (el && n) {
    const t = n.querySelector('.txt');
    el.html = cleanHtml(t.innerHTML);
    if (!t.textContent.trim()) { curSlide().elements = curSlide().elements.filter((x) => x.id !== id); state.sel = []; }
  }
  window.getSelection().removeAllRanges();
  commit(); emit('canvas');
}
function cleanHtml(h) {
  return h.replace(/<(?!\/?(b|i|u|br|div|span|strong|em)\b)[^>]*>/gi, '').replace(/ style="[^"]*"/g, '');
}

// ---------- actions ----------
export function addElement(el, at) {
  const D = state.doc;
  el.id = uid();
  el.rot = el.rot || 0; el.opacity = el.opacity ?? 1;
  if (at) { el.x = at.x - el.w / 2; el.y = at.y - el.h / 2; }
  else if (el.x == null) {
    // cascade new items so they do not stack exactly
    const n = curSlide().elements.length % 6;
    el.x = (D.w - el.w) / 2 + n * 24; el.y = (D.h - el.h) / 2 + n * 24;
  }
  curSlide().elements.push(el);
  state.sel = [el.id];
  commit(); emit('canvas');
  return el;
}
export function removeSel() {
  if (!state.sel.length) return;
  curSlide().elements = curSlide().elements.filter((e) => !state.sel.includes(e.id));
  state.sel = []; commit(); emit('canvas');
}
export function duplicate() {
  const els = selected(); if (!els.length) return;
  const copies = regroup(els.map((e) => ({ ...clone(e), id: uid(), x: e.x + 30, y: e.y + 30 })));
  curSlide().elements.push(...copies); state.sel = copies.map((c) => c.id);
  commit(); emit('canvas');
}
export function layer(dir) {
  const els = curSlide().elements;
  for (const id of dir === 'up' || dir === 'top' ? [...state.sel].reverse() : state.sel) {
    const i = els.findIndex((e) => e.id === id); if (i < 0) continue;
    const [e] = els.splice(i, 1);
    const j = dir === 'top' ? els.length : dir === 'bottom' ? 0 : dir === 'up' ? Math.min(els.length, i + 1) : Math.max(0, i - 1);
    els.splice(j, 0, e);
  }
  commit(); emit('canvas');
}
export function align(how) {
  const els = selected(); if (!els.length) return;
  const D = state.doc;
  const ref = els.length > 1 ? bounds(els) : { x: 0, y: 0, w: D.w, h: D.h };
  for (const e of els) {
    if (how === 'left') e.x = ref.x; if (how === 'right') e.x = ref.x + ref.w - e.w; if (how === 'center') e.x = ref.x + (ref.w - e.w) / 2;
    if (how === 'top') e.y = ref.y; if (how === 'bottom') e.y = ref.y + ref.h - e.h; if (how === 'middle') e.y = ref.y + (ref.h - e.h) / 2;
  }
  commit(); emit('canvas');
}

let clip = null;
function onCopy(e) {
  if (isTyping() || !state.sel.length) return;
  clip = clone(selected()); e.preventDefault();
  e.clipboardData.setData('text/plain', 'deckly:' + JSON.stringify(clip));
}
function onPaste(e) {
  if (isTyping()) return;
  const txt = e.clipboardData.getData('text/plain');
  const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
  if (files.length) { e.preventDefault(); document.dispatchEvent(new CustomEvent('deckly-files', { detail: { files } })); return; }
  let items = null;
  if (txt.startsWith('deckly:')) { try { items = JSON.parse(txt.slice(7)); } catch { /* */ } }
  if (items) {
    e.preventDefault();
    const copies = regroup(items.map((x) => ({ ...x, id: uid(), x: x.x + 30, y: x.y + 30 })));
    curSlide().elements.push(...copies); state.sel = copies.map((c) => c.id); commit(); emit('canvas');
  } else if (txt.trim()) {
    e.preventDefault();
    addElement({ type: 'text', w: 900, h: 60, html: txt.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])).replace(/\n/g, '<br>'), font: 'Inter', size: 40, color: '#1E1F2B' });
  }
}
const isTyping = () => { const a = document.activeElement; return state.editingId || (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)); };

function onKey(e) {
  if ($('#editor').classList.contains('hidden') || !$('#present').classList.contains('hidden')) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (state.editingId) { if (k === 'escape') { stopEditing(); } return; }
  if (isTyping()) return;
  if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if (mod && k === 'd') { e.preventDefault(); duplicate(); return; }
  if (mod && k === 'g') { e.preventDefault(); if (e.shiftKey) ungroupSel(); else groupSel(); return; }
  if (mod && k === 'a') { e.preventDefault(); select(curSlide().elements.filter((x) => !x.locked).map((x) => x.id)); return; }
  if (mod && k === '0') { e.preventDefault(); setZoom('fit'); return; }
  if (k === 'delete' || k === 'backspace') { e.preventDefault(); removeSel(); return; }
  if (k === 'escape') { select([]); return; }
  if (k === 'enter' && state.sel.length === 1 && findEl(state.sel[0])?.type === 'text') { e.preventDefault(); startEditing(state.sel[0]); return; }
  if (k === 't' && !mod) { e.preventDefault(); document.dispatchEvent(new Event('deckly-add-text')); return; }
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) {
    const els = selected().filter((x) => !x.locked);
    if (!els.length) { document.dispatchEvent(new CustomEvent('deckly-slide-nav', { detail: k === 'arrowleft' || k === 'arrowup' ? -1 : 1 })); return; }
    e.preventDefault();
    const d = e.shiftKey ? 10 : 1;
    for (const el of els) { if (k === 'arrowleft') el.x -= d; if (k === 'arrowright') el.x += d; if (k === 'arrowup') el.y -= d; if (k === 'arrowdown') el.y += d; patchNode(el); }
    renderOverlay(); clearTimeout(onKey.t); onKey.t = setTimeout(() => { commit(); emit('canvas'); }, 400);
  }
}
