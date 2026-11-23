// The canvas: rendering, selection, drag / resize / rotate with smart guides, text, table and shape-text editing,
// line ends, freehand drawing, right-click menus, shortcuts, zoom.
import { state, emit, on, commit, curSlide, findEl, selected, uid, clone, undo, redo, newSlide } from './store.js';
import { elementNode, bgCss, innerHtml, elStyle } from './render.js';
import { ic } from './assets.js';
import { t as tr } from './i18n.js';
import { setEnds, ends } from './elements/line.js';
import { measureTable } from './elements/table.js';
import { strokeElement, TOOLS } from './elements/draw.js';
import { textArea } from './shapes.js';
import { sanitizeHtml } from './sanitize.js';
import { contextMenu, isModalOpen, toast, closePopover } from './ui.js';

const $ = (s) => document.querySelector(s);
let stage, overlay, wrap, viewport;
const SNAP = 6; // screen px

export function initEditor() {
  stage = $('#stage'); overlay = $('#overlay'); wrap = $('#stageWrap'); viewport = $('#viewport');
  new ResizeObserver(() => fit()).observe(viewport);
  viewport.addEventListener('pointerdown', onDown);
  viewport.addEventListener('dblclick', onDbl);
  viewport.addEventListener('pointermove', onHover);
  viewport.addEventListener('contextmenu', onContext);
  viewport.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoomAt(Math.max(0.1, Math.min(4, state.scale * (e.deltaY < 0 ? 1.1 : 0.9))), e.clientX, e.clientY);
  }, { passive: false });
  document.addEventListener('keydown', onKey);
  document.addEventListener('copy', onCopy); document.addEventListener('cut', onCut); document.addEventListener('paste', onPaste);
  on((what) => {
    if (['all', 'slide', 'canvas'].includes(what)) renderStage();
    if (['all', 'slide', 'canvas', 'sel'].includes(what)) renderOverlay();
  });
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
  state.scale = Math.max(0.05, s); window.__stageScale = state.scale;
  wrap.style.width = state.doc.w * state.scale + 'px';
  wrap.style.height = state.doc.h * state.scale + 'px';
  wrap.style.margin = state.zoom === 'fit' ? 'auto' : '40px';
  stage.style.width = state.doc.w + 'px'; stage.style.height = state.doc.h + 'px';
  stage.style.transform = `scale(${state.scale})`;
  $('#zoomVal').textContent = state.zoom === 'fit' ? tr('Fit') : Math.round(state.scale * 100) + '%';
  renderOverlay();
}
export function setZoom(z) { state.zoom = z; fit(); }
// zoom keeping the point under the cursor still
export function zoomAt(z, cx, cy) {
  const r = wrap.getBoundingClientRect();
  const px = (cx - r.left) / state.scale, py = (cy - r.top) / state.scale;
  setZoom(z);
  const r2 = wrap.getBoundingClientRect();
  viewport.scrollLeft += px * state.scale + r2.left - cx;
  viewport.scrollTop += py * state.scale + r2.top - cy;
}

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
  if (state.editingId && findEl(state.editingId)) {
    const el = findEl(state.editingId);
    if (el.type === 'text') startEditing(state.editingId, false); else if (el.type === 'shape') editShapeText(el.id, false);
  }
  if (state.cell && findEl(state.cell.id)) editCell(state.cell.id, state.cell.r, state.cell.c, false);
  stage.classList.toggle('drawing', !!state.tool);
}
// keep text boxes' and tables' stored height equal to their rendered height
function measureTexts() {
  for (const el of curSlide().elements) {
    const n = stage.querySelector(`[data-id="${el.id}"]`); if (!n) continue;
    if (el.type === 'text') { const h = Math.ceil(n.offsetHeight); if (h && Math.abs(h - el.h) > 0.5) el.h = h; }
    if (el.type === 'table') { if (measureTable(el, n)) n.style.height = el.h + 'px'; }
  }
}
// cheap update of one element (during drags)
export function patchNode(el) {
  const n = stage.querySelector(`[data-id="${el.id}"]`); if (!n) return;
  n.style.cssText = elStyle(el);
  const editing = el.id === state.editingId || state.cell?.id === el.id;
  if (!editing) n.querySelector('.inner').innerHTML = innerHtml(el);
  if (el.type === 'text') el.h = Math.ceil(n.offsetHeight) || el.h;
  if (el.type === 'table' && !editing) { if (measureTable(el, n)) n.style.height = el.h + 'px'; }
}

let floatTools;
export function renderOverlay(busyText) {
  if (!overlay) return;
  overlay.innerHTML = '';
  const s = state.scale;
  const els = selected();
  if (!els.length || state.tool) return;
  if (els.length === 1) {
    const el = els[0];
    const box = document.createElement('div');
    box.className = 'sel' + (busyText ? ' busy' : '') + (el.locked ? ' locked' : '');
    box.style.cssText = `left:${el.x * s}px;top:${el.y * s}px;width:${el.w * s}px;height:${el.h * s}px;transform:rotate(${el.rot || 0}deg)`;
    if (!el.locked && el.id !== state.editingId) {
      let handles;
      if (el.type === 'line') handles = [];
      else if (el.type === 'text') handles = ['nw', 'ne', 'sw', 'se', 'e', 'w'];
      else if (['icon', 'sticker', 'logo', 'svg', 'qr'].includes(el.type)) handles = ['nw', 'ne', 'sw', 'se'];
      else if (el.type === 'table') handles = ['e', 'w', 'se'];
      else handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
      box.innerHTML = handles.map((h) => `<div class="h ${h}${h.length === 1 ? ' side' : ''}" data-h="${h}"></div>`).join('')
        + (el.type === 'line' ? `<div class="h end" data-h="p1" style="left:${el.a[0] * el.w * s - 8}px;top:${el.a[1] * el.h * s - 8}px"></div><div class="h end" data-h="p2" style="left:${el.b[0] * el.w * s - 8}px;top:${el.b[1] * el.h * s - 8}px"></div>` : `<div class="rot" data-h="rot">${ic('rotate-cw')}</div>`);
    }
    if (el.locked) box.innerHTML += `<div class="lock-tag">${ic('lock')}</div>`;
    box.innerHTML += `<div class="size-tag">${busyText || ''}</div>`;
    overlay.appendChild(box);
    if (state.cell?.id === el.id) { const td = stage.querySelector(`[data-id="${el.id}"] td[data-r="${state.cell.r}"][data-c="${state.cell.c}"]`); if (td) { const cb = document.createElement('div'); cb.className = 'cell-box'; const r = td.getBoundingClientRect(), vr = wrap.getBoundingClientRect(); cb.style.cssText = `left:${r.left - vr.left}px;top:${r.top - vr.top}px;width:${r.width}px;height:${r.height}px`; overlay.appendChild(cb); } }
  } else {
    const b = bounds(els);
    const box = document.createElement('div');
    box.className = 'sel multi';
    box.style.cssText = `left:${b.x * s}px;top:${b.y * s}px;width:${b.w * s}px;height:${b.h * s}px`;
    if (!els.some((e) => e.locked)) box.innerHTML = ['nw', 'ne', 'sw', 'se'].map((h) => `<div class="h ${h}" data-h="${h}"></div>`).join('');
    overlay.appendChild(box);
  }
  if (!busyText && state.editingId == null && !state.cell) {
    const b = bounds(els);
    floatTools = document.createElement('div');
    floatTools.className = 'float-tools';
    const right = (b.x + b.w) * s + 12, fitsRight = right + 120 < viewport.clientWidth + viewport.scrollLeft - 20;
    const top = b.y * s - 48;
    floatTools.style.cssText = fitsRight ? `left:${right}px;top:${b.y * s}px;transform:none` : `left:${(b.x + b.w / 2) * s}px;top:${top < -40 ? (b.y + b.h) * s + 56 : top}px`;
    const lock = els.every((e) => e.locked);
    floatTools.innerHTML = `<button data-ft="dup" title="${tr('Duplicate (Ctrl+D)')}">${ic('copy-plus')}</button>`
      + `<button data-ft="lock" title="${tr(lock ? 'Unlock' : 'Lock')}">${ic(lock ? 'lock' : 'lock-open')}</button>`
      + `<button data-ft="more" title="${tr('More')}">${ic('ellipsis')}</button>`
      + `<button data-ft="del" title="${tr('Delete')}">${ic('trash-2')}</button>`;
    floatTools.addEventListener('pointerdown', (e) => e.stopPropagation());
    floatTools.addEventListener('click', (e) => {
      const b2 = e.target.closest('[data-ft]'); if (!b2) return;
      if (b2.dataset.ft === 'dup') duplicate();
      if (b2.dataset.ft === 'del') removeSel();
      if (b2.dataset.ft === 'lock') { els.forEach((x) => (x.locked = !lock)); commit(); emit('canvas'); }
      if (b2.dataset.ft === 'more') { const r = b2.getBoundingClientRect(); elementMenu(r.left, r.bottom + 4); }
    });
    overlay.appendChild(floatTools);
  }
}

export function bounds(els) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const e of els) {
    const r = ((e.rot || 0) * Math.PI) / 180, cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    for (const [px, py] of [[e.x, e.y], [e.x + e.w, e.y], [e.x, e.y + e.h], [e.x + e.w, e.y + e.h]]) {
      const dx = px - cx, dy = py - cy;
      const rx = cx + dx * Math.cos(r) - dy * Math.sin(r), ry = cy + dx * Math.sin(r) + dy * Math.cos(r);
      x1 = Math.min(x1, rx); y1 = Math.min(y1, ry); x2 = Math.max(x2, rx); y2 = Math.max(y2, ry);
    }
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
export function toStage(cx, cy) {
  const r = wrap.getBoundingClientRect();
  return { x: (cx - r.left) / state.scale, y: (cy - r.top) / state.scale };
}

// ---------- selection ----------
export function select(ids, add = false) {
  if (state.editingId) stopEditing();
  if (state.cell && !ids.includes(state.cell.id)) stopCell();
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
function regroup(copies) {
  const map = {};
  for (const c of copies) { delete c.mid; if (c.group) c.group = map[c.group] ||= 'g' + uid(); }
  return copies;
}
// the selection as units: a group counts as one box
function units(els) {
  const out = [], seen = new Set();
  for (const e of els) {
    if (e.group) { if (seen.has(e.group)) continue; seen.add(e.group); out.push(els.filter((x) => x.group === e.group)); }
    else out.push([e]);
  }
  return out;
}
function hitEl(target) {
  const n = target.closest('.stage .el');
  return n ? findEl(n.dataset.id) : null;
}
function onHover(e) {
  if (drag || state.tool) return;
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
  if (state.tool) { drawDown(e); return; }
  const handle = e.target.closest('[data-h]');
  const p = toStage(e.clientX, e.clientY);
  if (state.editingId) {
    const n = e.target.closest('.el.editing');
    if (n) return; // clicks inside the text being edited
    stopEditing();
  }
  if (state.cell) {
    const td = e.target.closest('td');
    const n = e.target.closest('.el');
    if (td && n && n.dataset.id === state.cell.id) { const r = +td.dataset.r, c = +td.dataset.c; if (r !== state.cell.r || c !== state.cell.c) editCell(state.cell.id, r, c); return; }
    stopCell();
  }
  if (handle) {
    const h = handle.dataset.h;
    if (state.sel.length > 1) { const els = selected(); drag = { mode: 'resizeMulti', h, els, origs: els.map(clone), start: p, box: bounds(els) }; }
    else { const el = selected()[0]; if (!el) return; drag = { mode: h === 'rot' ? 'rot' : h === 'p1' || h === 'p2' ? 'end' : 'resize', h, el, start: p, orig: clone(el) }; }
  } else {
    const el = hitEl(e.target);
    if (el) {
      if (e.shiftKey) { select(state.sel.includes(el.id) ? state.sel.filter((i) => i !== el.id) : [...state.sel, el.id]); return; }
      const already = state.sel.includes(el.id);
      if (!already) select([el.id]);
      else if (el.type === 'table' && state.sel.length === 1) { const td = e.target.closest('td'); if (td) { state.cell = { id: el.id, r: +td.dataset.r, c: +td.dataset.c, view: true }; emit('sel'); } }
      const els = selected().filter((x) => !x.locked);
      if (!els.length) return;
      if (e.altKey) {
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
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) ny = ob.y; else nx = ob.x; }
    const g = e.ctrlKey ? { x: nx, y: ny, lines: [] } : snapMove(nx, ny, ob.w, ob.h, drag.els.map((x) => x.id));
    drag.els.forEach((el, i) => { el.x = drag.origs[i].x + (g.x - ob.x); el.y = drag.origs[i].y + (g.y - ob.y); patchNode(el); });
    renderOverlay(`x ${Math.round(g.x)}  y ${Math.round(g.y)}`); drawGuides(g.lines);
  } else if (drag.mode === 'resize') resizeMove(p, e.shiftKey);
  else if (drag.mode === 'resizeMulti') {
    const b = drag.box, h = drag.h;
    const ax = h.includes('w') ? b.x + b.w : b.x, ay = h.includes('n') ? b.y + b.h : b.y; // anchor corner
    const k = Math.max(0.05, Math.max(Math.abs(p.x - ax) / b.w, Math.abs(p.y - ay) / b.h));
    drag.els.forEach((el, i) => { const o = drag.origs[i]; el.x = ax + (o.x - ax) * k; el.y = ay + (o.y - ay) * k; el.w = o.w * k; el.h = o.h * k; if (o.size) el.size = Math.round(o.size * k * 10) / 10; if (el.type === 'table') { el.rowH = o.rowH.map((r) => r * k); el.style = { ...o.style, size: Math.round((o.style.size || 32) * k), pad: Math.round((o.style.pad || 16) * k) }; } patchNode(el); });
    renderOverlay(`${Math.round(k * 100)}%`);
  } else if (drag.mode === 'end') {
    const el = drag.el, o = drag.orig;
    // pointer in the element's unrotated frame
    const r = ((o.rot || 0) * Math.PI) / 180, cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const lx = cx + (p.x - cx) * Math.cos(-r) - (p.y - cy) * Math.sin(-r), ly = cy + (p.x - cx) * Math.sin(-r) + (p.y - cy) * Math.cos(-r);
    const E = ends(o);
    let nx = lx, ny = ly;
    const ox = drag.h === 'p1' ? E.x2 : E.x1, oy = drag.h === 'p1' ? E.y2 : E.y1;
    if (e.shiftKey) { const a = Math.atan2(ny - oy, nx - ox), step = Math.PI / 4, sa = Math.round(a / step) * step, len = Math.hypot(nx - ox, ny - oy); nx = ox + len * Math.cos(sa); ny = oy + len * Math.sin(sa); }
    else { const sn = snapPoint(nx, ny, [el.id]); nx = sn.x; ny = sn.y; drawGuides(sn.lines); }
    if (drag.h === 'p1') setEnds(el, nx, ny, E.x2, E.y2); else setEnds(el, E.x1, E.y1, nx, ny);
    if (o.rot) { // keep the box centred where the rotated geometry puts it
      const ncx = el.x + el.w / 2, ncy = el.y + el.h / 2;
      const rcx = cx + (ncx - cx) * Math.cos(r) - (ncy - cy) * Math.sin(r), rcy = cy + (ncx - cx) * Math.sin(r) + (ncy - cy) * Math.cos(r);
      el.x = rcx - el.w / 2; el.y = rcy - el.h / 2;
    }
    patchNode(el); renderOverlay(`${Math.round(Math.hypot(nx - ox, ny - oy))} px`);
  } else if (drag.mode === 'rot') {
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
    if (d.pickOne) { state.sel = [d.pickOne]; emit('sel'); return; }
    renderOverlay(); return;
  }
  commit(); emit('canvas');
}

function resizeMove(p, keepRatio) {
  const o = drag.orig, el = drag.el, h = drag.h;
  const rad = (o.rot || 0) * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const ddx = p.x - drag.start.x, ddy = p.y - drag.start.y;
  const lx = ddx * cos + ddy * sin, ly = -ddx * sin + ddy * cos;
  let w = o.w, hh = o.h, ox = 0, oy = 0;
  if (h.includes('e')) w = o.w + lx;
  if (h.includes('w')) { w = o.w - lx; ox = lx; }
  if (h.includes('s')) hh = o.h + ly;
  if (h.includes('n')) { hh = o.h - ly; oy = ly; }
  const corner = h.length === 2;
  const always = ['icon', 'sticker', 'logo', 'svg', 'text', 'qr'].includes(el.type) || (el.type === 'image' && el.sticker);
  const ratioLock = corner && (always || (el.type === 'shape' || el.type === 'draw' || el.type === 'table' ? keepRatio : !keepRatio));
  if (ratioLock) {
    const k = Math.max(w / o.w, hh / o.h);
    w = o.w * k; hh = o.h * k;
    if (h.includes('w')) ox = o.w - w; if (h.includes('n')) oy = o.h - hh;
  }
  const min = 12;
  if (w < min) { if (h.includes('w')) ox -= min - w; w = min; }
  if (hh < min) { if (h.includes('n')) oy -= min - hh; hh = min; }
  const cx0 = o.x + o.w / 2, cy0 = o.y + o.h / 2;
  const ncxL = ox + w / 2 - o.w / 2, ncyL = oy + hh / 2 - o.h / 2;
  const ncx = cx0 + ncxL * cos - ncyL * sin, ncy = cy0 + ncxL * sin + ncyL * cos;
  el.w = w; el.h = hh; el.x = ncx - w / 2; el.y = ncy - hh / 2;
  if (el.type === 'text' && corner) el.size = Math.max(6, Math.round(o.size * (w / o.w) * 10) / 10);
  if (el.type === 'table') { const k = hh / o.h; el.rowH = o.rowH.map((r) => r * k); if (corner) { el.style = { ...o.style, size: Math.round((o.style.size || 32) * (w / o.w)), pad: Math.round((o.style.pad || 16) * (w / o.w)) }; } }
  if (el.type === 'shape' && el.text && corner) el.text = { ...el.text, size: Math.max(6, Math.round((o.text.size || 32) * (w / o.w))) };
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
    for (const [, v] of vals) for (const c of cands) { const dd = Math.abs(v - c); if (dd < bd) { bd = dd; out = { shift: c - v, at: c }; } }
    return out;
  };
  const bx = best([[0, x], [w / 2, x + w / 2], [w, x + w]], xs);
  const by = best([[0, y], [h / 2, y + h / 2], [h, y + h]], ys);
  if (bx) { x += bx.shift; lines.push({ v: true, at: bx.at }); }
  if (by) { y += by.shift; lines.push({ v: false, at: by.at }); }
  return { x, y, lines };
}
function snapPoint(x, y, ignore) { const g = snapMove(x, y, 0, 0, ignore); return { x: g.x, y: g.y, lines: g.lines }; }
function drawGuides(lines) {
  overlay.querySelectorAll('.guide').forEach((n) => n.remove());
  for (const l of lines) {
    const g = document.createElement('div');
    g.className = 'guide ' + (l.v ? 'v' : 'h');
    if (l.v) g.style.left = l.at * state.scale + 'px'; else g.style.top = l.at * state.scale + 'px';
    overlay.appendChild(g);
  }
}

// ---------- text / cell / shape-text editing ----------
function onDbl(e) {
  if (state.tool) return;
  const el = hitEl(document.elementFromPoint(e.clientX, e.clientY) || e.target);
  if (!el || el.locked) return;
  if (el.type === 'text') startEditing(el.id);
  else if (el.type === 'table') { const td = (document.elementFromPoint(e.clientX, e.clientY) || e.target).closest('td'); if (td) editCell(el.id, +td.dataset.r, +td.dataset.c); }
  else if (el.type === 'shape') editShapeText(el.id);
  else if (el.type === 'image') document.dispatchEvent(new CustomEvent('deckly-image-dbl', { detail: el }));
  else if (el.type === 'chart' || el.type === 'qr') document.dispatchEvent(new CustomEvent('deckly-edit-data', { detail: el }));
}
function makeEditable(t, el, onInput, selectAll) {
  t.contentEditable = 'true'; t.spellcheck = true;
  t.focus();
  const r = document.createRange(); r.selectNodeContents(t); if (!selectAll) r.collapse(false);
  window.getSelection().removeAllRanges(); window.getSelection().addRange(r);
  t.addEventListener('input', onInput);
  t.addEventListener('paste', (ev) => { ev.preventDefault(); document.execCommand('insertText', false, ev.clipboardData.getData('text/plain')); });
}
export function startEditing(id, selectAll = true) {
  const el = findEl(id); if (!el) return;
  if (el.type === 'shape') return editShapeText(id, selectAll);
  state.sel = [id]; state.editingId = id;
  const n = stage.querySelector(`[data-id="${id}"]`); if (!n) return;
  n.classList.add('editing');
  const t = n.querySelector('.txt');
  makeEditable(t, el, () => { el.html = cleanHtml(t.innerHTML); el.h = n.offsetHeight; renderOverlay(); }, selectAll);
  emit('sel');
}
export function editShapeText(id, selectAll = true) {
  const el = findEl(id); if (!el) return;
  if (!el.text) el.text = { html: '', color: contrastOf(el.fill), size: Math.round(Math.min(state.doc.w, state.doc.h) * 0.032), font: 'Inter', align: 'center', valign: 'middle', bold: false };
  state.sel = [id]; state.editingId = id; window.__editingShape = id;
  const n = stage.querySelector(`[data-id="${id}"]`); if (!n) return;
  n.querySelector('.inner').innerHTML = innerHtml(el);
  n.classList.add('editing');
  const t = n.querySelector('.shape-text .txt'); if (!t) return;
  makeEditable(t, el, () => { el.text.html = cleanHtml(t.innerHTML); }, selectAll);
  emit('sel');
}
const contrastOf = (hex) => { const m = /^#([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#FFFFFF'; const n = parseInt(m[1], 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150 ? '#1E1F2B' : '#FFFFFF'; };
export function stopEditing() {
  const id = state.editingId; if (!id) return;
  state.editingId = null; window.__editingShape = null;
  const el = findEl(id);
  const n = stage.querySelector(`[data-id="${id}"]`);
  if (el && n) {
    if (el.type === 'text') { const t = n.querySelector('.txt'); el.html = cleanHtml(t.innerHTML); if (!t.textContent.trim()) { curSlide().elements = curSlide().elements.filter((x) => x.id !== id); state.sel = []; } }
    else if (el.type === 'shape') { const t = n.querySelector('.shape-text .txt'); if (t) el.text.html = cleanHtml(t.innerHTML); if (!el.text.html.replace(/<[^>]+>/g, '').trim()) el.text.html = ''; }
  }
  window.getSelection().removeAllRanges();
  commit(); emit('canvas');
}
export function editCell(id, r, c, selectAll = true) {
  const el = findEl(id); if (!el || !el.cells[r]?.[c]) return;
  if (state.editingId) stopEditing();
  if (state.cell && (state.cell.id !== id || state.cell.r !== r || state.cell.c !== c)) stopCell(false);
  state.sel = [id]; state.cell = { id, r, c };
  const n = stage.querySelector(`[data-id="${id}"]`); if (!n) return;
  const td = n.querySelector(`td[data-r="${r}"][data-c="${c}"]`); if (!td) return;
  n.classList.add('editing-cell');
  const t = td.querySelector('.cell');
  makeEditable(t, el, () => { el.cells[r][c].h = cleanHtml(t.innerHTML); if (measureTable(el, n)) { n.style.height = el.h + 'px'; } renderOverlay(); }, selectAll);
  t.onkeydown = (ev) => {
    if (ev.key === 'Tab') { ev.preventDefault(); let nr = r, nc = c + (ev.shiftKey ? -1 : 1); if (nc >= el.cols) { nc = 0; nr++; } if (nc < 0) { nc = el.cols - 1; nr--; } if (nr >= el.rows) { import('./elements/table.js').then((m) => { m.addRow(el); commit(); emit('canvas'); setTimeout(() => editCell(id, nr, 0), 20); }); return; } if (nr >= 0) editCell(id, nr, nc); }
    if (ev.key === 'Escape') { ev.stopPropagation(); stopCell(); }
  };
  emit('sel');
}
export function stopCell(doCommit = true) {
  const cl = state.cell; if (!cl) return;
  state.cell = null;
  const el = findEl(cl.id); const n = stage.querySelector(`[data-id="${cl.id}"]`);
  if (el && n) { const t = n.querySelector(`td[data-r="${cl.r}"][data-c="${cl.c}"] .cell`); if (t && t.isContentEditable) { el.cells[cl.r][cl.c].h = cleanHtml(t.innerHTML); t.contentEditable = 'false'; } n.classList.remove('editing-cell'); }
  window.getSelection().removeAllRanges();
  if (doCommit) { commit(); emit('canvas'); }
}
function cleanHtml(h) { return sanitizeHtml(h); }

// ---------- freehand drawing ----------
let stroke = null;
export function startDraw(tool = 'pen') {
  if (state.editingId) stopEditing(); if (state.cell) stopCell();
  state.tool = { name: tool, color: state.tool?.color || '#6C4CF5', size: TOOLS[tool].size };
  state.sel = []; closePopover(); emit('sel'); stage.classList.add('drawing');
  toast(tr('Draw on the slide — Esc or “Done” to stop'));
}
export function stopDraw() { state.tool = null; stage.classList.remove('drawing'); emit('sel'); }
function drawDown(e) {
  const p = toStage(e.clientX, e.clientY);
  stroke = { pts: [[p.x, p.y, e.pressure || 0.5]], svg: null };
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', 'draw-live'); s.setAttribute('viewBox', `0 0 ${state.doc.w} ${state.doc.h}`); s.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible';
  stage.appendChild(s); stroke.svg = s;
  viewport.setPointerCapture(e.pointerId);
  viewport.addEventListener('pointermove', drawMove);
  viewport.addEventListener('pointerup', drawUp, { once: true });
}
function drawMove(e) {
  if (!stroke) return;
  const p = toStage(e.clientX, e.clientY);
  stroke.pts.push([p.x, p.y, e.pressure || 0.5]);
  const el = strokeElement(stroke.pts, state.tool.name, state.tool.color, state.tool.size);
  stroke.svg.innerHTML = `<g transform="translate(${el.x} ${el.y})"><path d="${el.d}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linecap="${state.tool.name === 'highlighter' ? 'butt' : 'round'}" stroke-linejoin="round" opacity="${el.opacity}" ${state.tool.name === 'highlighter' ? 'style="mix-blend-mode:multiply"' : ''}/></g>`;
}
function drawUp() {
  viewport.removeEventListener('pointermove', drawMove);
  if (!stroke) return;
  const el = strokeElement(stroke.pts, state.tool.name, state.tool.color, state.tool.size);
  stroke.svg.remove(); stroke = null;
  el.id = uid(); el.rot = 0;
  curSlide().elements.push(el); commit(); emit('canvas');
}

// ---------- right-click menus ----------
function onContext(e) {
  e.preventDefault();
  if (state.tool) return;
  const el = hitEl(e.target);
  if (el) { if (!state.sel.includes(el.id)) select([el.id]); elementMenu(e.clientX, e.clientY); }
  else { select([]); slideMenu(e.clientX, e.clientY); }
}
function elementMenu(x, y) {
  const els = selected(); if (!els.length) return;
  const one = els.length === 1 ? els[0] : null, lock = els.every((e) => e.locked);
  const items = [
    { icon: 'scissors', label: 'Cut', act: 'cut', kbd: 'Ctrl X' }, { icon: 'copy', label: 'Copy', act: 'copy', kbd: 'Ctrl C' }, { icon: 'clipboard-paste', label: 'Paste', act: 'paste', kbd: 'Ctrl V', disabled: !clip },
    { icon: 'copy-plus', label: 'Duplicate', act: 'dup', kbd: 'Ctrl D' }, 'sep',
    { icon: 'paintbrush', label: 'Copy style', act: 'cstyle', kbd: 'Ctrl Alt C' }, { icon: 'paint-roller', label: 'Paste style', act: 'pstyle', kbd: 'Ctrl Alt V', disabled: !styleClip }, 'sep',
    { icon: 'bring-to-front', label: 'Bring to front', act: 'top' }, { icon: 'arrow-up', label: 'Bring forward', act: 'up', kbd: 'Ctrl ]' }, { icon: 'arrow-down', label: 'Send backward', act: 'down', kbd: 'Ctrl [' }, { icon: 'send-to-back', label: 'Send to back', act: 'bottom' }, 'sep',
    ...(els.length > 1 ? [isOneGroup(els) ? { icon: 'ungroup', label: 'Ungroup', act: 'ungroup', kbd: 'Ctrl Shift G' } : { icon: 'group', label: 'Group', act: 'group', kbd: 'Ctrl G' }] : []),
    { icon: lock ? 'lock-open' : 'lock', label: lock ? 'Unlock' : 'Lock', act: 'lock' },
    ...(one?.type === 'image' && !one.sticker ? [{ icon: 'replace', label: 'Replace photo', act: 'replace' }, { icon: 'wallpaper', label: 'Set as background', act: 'asbg' }] : []),
    ...(one?.type === 'text' || one?.type === 'shape' ? [{ icon: 'pencil', label: 'Edit text', act: 'edit', kbd: 'Enter' }] : []),
    { icon: 'sparkles', label: 'Animate', act: 'animate' }, 'sep',
    { icon: 'trash-2', label: 'Delete', act: 'del', kbd: tr('Del'), danger: true },
  ];
  contextMenu(x, y, items, (a) => {
    if (a === 'cut') cutSel(); if (a === 'copy') copySel(); if (a === 'paste') pasteClip(); if (a === 'dup') duplicate();
    if (a === 'cstyle') copyStyle(); if (a === 'pstyle') pasteStyle();
    if (['top', 'up', 'down', 'bottom'].includes(a)) layer(a);
    if (a === 'group') groupSel(); if (a === 'ungroup') ungroupSel();
    if (a === 'lock') { els.forEach((e) => (e.locked = !lock)); commit(); emit('canvas'); }
    if (a === 'del') removeSel();
    if (a === 'edit') startEditing(one.id);
    if (a === 'animate') document.dispatchEvent(new CustomEvent('deckly-open-tab', { detail: 'animate' }));
    if (a === 'replace') document.dispatchEvent(new CustomEvent('deckly-toolbar-act', { detail: 'replace' }));
    if (a === 'asbg') document.dispatchEvent(new CustomEvent('deckly-toolbar-act', { detail: 'asbg' }));
  });
}
function slideMenu(x, y) {
  contextMenu(x, y, [
    { icon: 'clipboard-paste', label: 'Paste', act: 'paste', kbd: 'Ctrl V', disabled: !clip }, { icon: 'type', label: 'Add text', act: 'text', kbd: 'T' }, { icon: 'pen-tool', label: 'Draw', act: 'draw', kbd: 'D' }, 'sep',
    { icon: 'plus', label: 'New slide', act: 'new', kbd: 'Ctrl Enter' }, { icon: 'copy-plus', label: 'Duplicate slide', act: 'dupslide' }, { icon: 'paint-bucket', label: 'Background', act: 'bg' }, { icon: 'sparkles', label: 'Transition', act: 'animate' }, { icon: 'notebook-pen', label: 'Speaker notes', act: 'notes' }, 'sep',
    { icon: 'trash-2', label: 'Delete slide', act: 'delslide', danger: true },
  ], (a) => {
    if (a === 'paste') pasteClip(); if (a === 'text') document.dispatchEvent(new Event('deckly-add-text')); if (a === 'draw') startDraw('pen');
    if (a === 'new') { state.doc.slides.splice(state.slide + 1, 0, newSlide(clone(curSlide().bg))); state.slide++; state.sel = []; commit(); emit('slide'); }
    if (a === 'dupslide') document.dispatchEvent(new Event('deckly-slide-dup')); if (a === 'delslide') document.dispatchEvent(new Event('deckly-slide-del'));
    if (a === 'bg') document.dispatchEvent(new CustomEvent('deckly-open-tab', { detail: 'background' })); if (a === 'animate') document.dispatchEvent(new CustomEvent('deckly-open-tab', { detail: 'animate' }));
    if (a === 'notes') $('#notesBtn').click();
  });
}

// ---------- actions ----------
export function addElement(el, at) {
  const D = state.doc;
  el.id = el.id || uid();
  el.rot = el.rot || 0; el.opacity = el.opacity ?? 1;
  if (at) { el.x = at.x - el.w / 2; el.y = at.y - el.h / 2; }
  else if (el.x == null || el.type === 'line' && at === null && el.x == null) {
    const n = curSlide().elements.length % 6;
    el.x = (D.w - el.w) / 2 + n * 24; el.y = (D.h - el.h) / 2 + n * 24;
  }
  if (state.tool) stopDraw();
  curSlide().elements.push(el);
  state.sel = [el.id];
  commit(); emit('canvas');
  const n = stage.querySelector(`[data-id="${el.id}"]`); if (n) { n.animate([{ transform: 'scale(.92)', opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }], { duration: 160, easing: 'ease-out' }); }
  return el;
}
export function removeSel() {
  if (!state.sel.length) return;
  const gone = selected();
  curSlide().elements = curSlide().elements.filter((e) => !state.sel.includes(e.id));
  state.sel = []; state.cell = null; commit(); emit('canvas');
  toast(gone.length > 1 ? tr('{n} elements deleted', { n: gone.length }) : 'Element deleted', { label: 'Undo', fn: undo });
}
export function duplicate() {
  const els = selected(); if (!els.length) return;
  const copies = regroup(els.map((e) => ({ ...clone(e), id: uid(), x: e.x + 30, y: e.y + 30 })));
  curSlide().elements.push(...copies); state.sel = copies.map((c) => c.id);
  commit(); emit('canvas');
}
export function layer(dir) {
  const els = curSlide().elements;
  const ids = [...state.sel].sort((a, b) => els.findIndex((e) => e.id === a) - els.findIndex((e) => e.id === b));
  for (const id of dir === 'up' || dir === 'top' ? [...ids].reverse() : ids) {
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
  const us = units(els);
  const ref = us.length > 1 ? bounds(els) : { x: 0, y: 0, w: D.w, h: D.h };
  for (const u of us) {
    const b = bounds(u); let dx = 0, dy = 0;
    if (how === 'left') dx = ref.x - b.x; if (how === 'right') dx = ref.x + ref.w - b.w - b.x; if (how === 'center') dx = ref.x + (ref.w - b.w) / 2 - b.x;
    if (how === 'top') dy = ref.y - b.y; if (how === 'bottom') dy = ref.y + ref.h - b.h - b.y; if (how === 'middle') dy = ref.y + (ref.h - b.h) / 2 - b.y;
    for (const e of u) { e.x += dx; e.y += dy; }
  }
  commit(); emit('canvas');
}
export function distribute(axis) {
  const us = units(selected()); if (us.length < 3) { toast('Select 3 or more elements'); return; }
  const size = axis === 'x' ? 'w' : 'h';
  const boxes = us.map((u) => ({ u, b: bounds(u) })).sort((a, b) => a.b[axis] - b.b[axis]);
  const first = boxes[0].b, last = boxes[boxes.length - 1].b;
  const total = boxes.reduce((s, x) => s + x.b[size], 0);
  const gap = (last[axis] + last[size] - first[axis] - total) / (boxes.length - 1);
  let pos = first[axis];
  for (const { u, b } of boxes) { const d = pos - b[axis]; for (const e of u) e[axis] += d; pos += b[size] + gap; }
  commit(); emit('canvas');
}
export function setProps(patch) { for (const el of selected()) Object.assign(el, patch); commit(); emit('canvas'); }

let clip = null, styleClip = null;
function copySel() { if (!state.sel.length) return; clip = clone(selected()); try { navigator.clipboard?.writeText('deckly:' + JSON.stringify(clip)); } catch { /* */ } }
function cutSel() { copySel(); removeSel(); }
function pasteClip() {
  if (!clip) return;
  const copies = regroup(clip.map((x) => ({ ...clone(x), id: uid(), x: x.x + 30, y: x.y + 30 })));
  curSlide().elements.push(...copies); state.sel = copies.map((c) => c.id); commit(); emit('canvas');
}
function copyStyle() {
  const el = selected()[0]; if (!el) return;
  const keys = { text: ['font', 'size', 'color', 'bold', 'italic', 'underline', 'strike', 'upper', 'align', 'lineHeight', 'spacing', 'shadow', 'outline', 'outlineColor', 'highlight', 'effect', 'glowColor'], shape: ['fill', 'stroke', 'strokeWidth', 'radius', 'gradient', 'shadowBox', 'opacity'], line: ['stroke', 'strokeWidth', 'dash', 'capStart', 'capEnd', 'kind'], icon: ['color', 'sw'], image: ['filters', 'frame', 'radius', 'shadowBox', 'opacity'], table: ['style'], chart: ['opts'], draw: ['stroke', 'fill', 'strokeWidth', 'opacity'] }[el.type] || ['opacity'];
  styleClip = { type: el.type, props: Object.fromEntries(keys.filter((k) => el[k] !== undefined).map((k) => [k, clone(el[k])])) };
  toast('Style copied — select another element and press Ctrl+Alt+V');
}
function pasteStyle() {
  if (!styleClip) return;
  let n = 0;
  for (const el of selected()) { if (el.type === styleClip.type || (styleClip.type === 'text' && el.type === 'shape' && el.text)) { const target = styleClip.type === 'text' && el.type === 'shape' ? el.text : el; Object.assign(target, clone(styleClip.props)); n++; } }
  if (n) { commit(); emit('canvas'); } else toast('The style does not apply to this kind of element');
}
function onCopy(e) {
  if (isTyping() || !state.sel.length) return;
  clip = clone(selected()); e.preventDefault();
  e.clipboardData.setData('text/plain', 'deckly:' + JSON.stringify(clip));
}
function onCut(e) { if (isTyping() || !state.sel.length) return; onCopy(e); removeSel(); }
function onPaste(e) {
  if (isTyping()) return;
  const txt = e.clipboardData.getData('text/plain');
  const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
  if (files.length) { e.preventDefault(); document.dispatchEvent(new CustomEvent('deckly-files', { detail: { files } })); return; }
  let items = null;
  if (txt.startsWith('deckly:')) { try { items = JSON.parse(txt.slice(7)); } catch { /* */ } }
  if (Array.isArray(items)) {
    e.preventDefault();
    const copies = regroup(items.filter((x) => x && typeof x === 'object' && typeof x.type === 'string').map((x) => ({ ...x, id: uid(), x: (+x.x || 0) + 30, y: (+x.y || 0) + 30 })));
    if (!copies.length) return;
    curSlide().elements.push(...copies); state.sel = copies.map((c) => c.id); commit(); emit('canvas');
  } else if (txt.trim()) {
    e.preventDefault();
    addElement({ type: 'text', w: 900, h: 60, html: txt.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])).replace(/\n/g, '<br>'), font: 'Inter', size: 40, color: '#1E1F2B' });
  }
}
const isTyping = () => { const a = document.activeElement; return state.editingId || state.cell || (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)); };

function onKey(e) {
  if ($('#editor').classList.contains('hidden') || !$('#present').classList.contains('hidden') || isModalOpen()) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod && k === '/') { e.preventDefault(); document.dispatchEvent(new Event('deckly-shortcuts')); return; }
  if (state.tool) { if (k === 'escape') stopDraw(); return; }
  if (state.editingId) { if (k === 'escape') { stopEditing(); } return; }
  if (state.cell && !state.cell.view) { if (k === 'escape') stopCell(); return; }
  if (isTyping()) return;
  if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if (mod && e.altKey && k === 'c') { e.preventDefault(); copyStyle(); return; }
  if (mod && e.altKey && k === 'v') { e.preventDefault(); pasteStyle(); return; }
  if (mod && k === 'd') { e.preventDefault(); duplicate(); return; }
  if (mod && k === 'g') { e.preventDefault(); if (e.shiftKey) ungroupSel(); else groupSel(); return; }
  if (mod && k === 'a') { e.preventDefault(); select(curSlide().elements.filter((x) => !x.locked).map((x) => x.id)); return; }
  if (mod && k === '0') { e.preventDefault(); setZoom('fit'); return; }
  if (mod && k === ']') { e.preventDefault(); layer(e.shiftKey ? 'top' : 'up'); return; }
  if (mod && k === '[') { e.preventDefault(); layer(e.shiftKey ? 'bottom' : 'down'); return; }
  if (mod && k === 'enter') { e.preventDefault(); state.doc.slides.splice(state.slide + 1, 0, newSlide(clone(curSlide().bg))); state.slide++; state.sel = []; commit(); emit('slide'); return; }
  if (k === 'delete' || k === 'backspace') { e.preventDefault(); removeSel(); return; }
  if (k === 'escape') { if (state.cell) stopCell(); select([]); return; }
  if (k === 'enter' && state.sel.length === 1 && ['text', 'shape'].includes(findEl(state.sel[0])?.type)) { e.preventDefault(); startEditing(state.sel[0]); return; }
  if (k === 'enter' && state.sel.length === 1 && findEl(state.sel[0])?.type === 'table') { e.preventDefault(); editCell(state.sel[0], 0, 0); return; }
  if (k === 't' && !mod) { e.preventDefault(); document.dispatchEvent(new Event('deckly-add-text')); return; }
  if (k === 'd' && !mod) { e.preventDefault(); startDraw('pen'); return; }
  if (k === 'tab' && !mod) { const els = curSlide().elements.filter((x) => !x.hidden); if (!els.length) return; e.preventDefault(); const i = els.findIndex((x) => x.id === state.sel[0]); select([els[(i + (e.shiftKey ? els.length - 1 : 1)) % els.length].id]); return; }
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) {
    const els = selected().filter((x) => !x.locked);
    if (!els.length) { document.dispatchEvent(new CustomEvent('deckly-slide-nav', { detail: k === 'arrowleft' || k === 'arrowup' ? -1 : 1 })); return; }
    e.preventDefault();
    const d = e.shiftKey ? 10 : 1;
    for (const el of els) { if (k === 'arrowleft') el.x -= d; if (k === 'arrowright') el.x += d; if (k === 'arrowup') el.y -= d; if (k === 'arrowdown') el.y += d; patchNode(el); }
    renderOverlay(); clearTimeout(onKey.t); onKey.t = setTimeout(() => { commit(); emit('canvas'); }, 400);
  }
}
