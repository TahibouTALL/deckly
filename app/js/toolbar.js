// Context bar above the canvas: shows only the controls that fit what is selected.
import { state, emit, on, commit, curSlide, selected, findEl } from './store.js';
import { packs, ic, SHAPES, FRAMES, shapeSvg } from './assets.js';
import { popover, closePopover, openColorPopover, toast } from './ui.js';
import { layer, align, removeSel, duplicate, patchNode, renderOverlay, startEditing, groupSel, ungroupSel, isOneGroup } from './editor.js';
import { openTab } from './panels.js';
import { t as tr, translateDom } from './i18n.js';
import { animatePopover, transitionPopover } from './pro.js';
import { removeBackground } from './bgremove.js';

const $ = (s) => document.querySelector(s);
let bar;

export function initToolbar() {
  bar = $('#ctxBar');
  on((w) => { if (['all', 'sel', 'slide', 'canvas', 'history'].includes(w)) render(); });
  bar.addEventListener('click', onClick);
  // keep the text selection alive while clicking toolbar buttons during text editing
  bar.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  bar.addEventListener('change', onChange);
}

const btn = (act, icon, title, on = false, label = '') => `<button class="cb${on ? ' on' : ''}" data-act="${act}" title="${title}">${icon ? ic(icon) : ''}${label}</button>`;
const colorBtn = (act, color, title) => `<button class="cb" data-act="${act}" title="${title}"><span class="color-dot" style="background:${color}"></span></button>`;

function render() {
  if (!state.doc) return;
  const els = selected();
  let h = '';
  if (!els.length) {
    const bg = curSlide().bg;
    h = `<div class="grp">${colorBtn('slidebg', bg.type === 'color' ? bg.value : bg.type === 'gradient' ? bg.value : `url(${bg.value}) center/cover`, 'Background colour')}<span class="ctx-label">Background</span></div>`
      + `<div class="grp">${btn('bgpanel', 'images', 'More backgrounds', false, 'Backgrounds')}</div>`
      + `<div class="grp">${btn('transition', 'film', 'Transition', !!curSlide().transition, 'Transition')}</div>`
      + `<div class="grp">${btn('slide-dup', 'copy-plus', 'Duplicate slide', false, 'Duplicate slide')}${btn('slide-del', 'trash-2', 'Delete slide', false, '')}</div>`
      + `<span class="ctx-label push">Tip: click an element to edit it · double-click text to type</span>`;
  } else if (els.length > 1) {
    h = `<span class="ctx-label">${tr('{n} selected', { n: els.length })}</span>`
      + `<div class="grp">${isOneGroup(els) ? btn('ungroup', 'ungroup', 'Ungroup (Ctrl+Shift+G)', false, 'Ungroup') : btn('group', 'group', 'Group (Ctrl+G)', false, 'Group')}</div>`
      + `<div class="grp">${btn('al-left', 'align-start-vertical', 'Align left')}${btn('al-center', 'align-center-vertical', 'Align centre')}${btn('al-right', 'align-end-vertical', 'Align right')}${btn('al-top', 'align-start-horizontal', 'Align top')}${btn('al-middle', 'align-center-horizontal', 'Align middle')}${btn('al-bottom', 'align-end-horizontal', 'Align bottom')}</div>`
      + `<div class="grp">${btn('dist-h', 'align-horizontal-space-around', 'Space evenly across')}${btn('dist-v', 'align-vertical-space-around', 'Space evenly down')}</div>`
      + common(els);
  } else {
    const el = els[0];
    if (el.type === 'text') {
      h = `<div class="grp"><button class="cb font-pick" data-act="font" style="font-family:'${el.font}'">${el.font}${ic('chevron-down')}</button></div>`
        + `<div class="grp"><div class="num"><button data-act="size-">${ic('minus')}</button><input data-in="size" value="${Math.round(el.size)}"><button data-act="size+">${ic('plus')}</button></div></div>`
        + `<div class="grp"><button class="cb" data-act="tcolor" title="Text colour"><span class="text-color">A<span style="background:${el.color}"></span></span></button>`
        + btn('bold', 'bold', 'Bold', el.bold) + btn('italic', 'italic', 'Italic', el.italic) + btn('underline', 'underline', 'Underline', el.underline) + btn('strike', 'strikethrough', 'Strikethrough', el.strike) + btn('upper', 'case-upper', 'Uppercase', el.upper) + '</div>'
        + `<div class="grp">${btn('align', { left: 'align-left', center: 'align-center', right: 'align-right', justify: 'align-justify' }[el.align || 'left'], 'Alignment')}${btn('spacing', 'between-vertical-start', 'Spacing')}${btn('effects', 'wand-sparkles', 'Effects', el.shadow || el.outline || !!el.highlight, 'Effects')}</div>`
        + common(els);
    } else if (el.type === 'shape' && SHAPES[el.shape]?.line) {
      h = `<div class="grp">${colorBtn('stroke', el.stroke, 'Line colour')}<span class="ctx-label">Line</span></div>`
        + `<div class="grp"><span class="ctx-label">Thickness</span><div class="num"><button data-act="sw-">${ic('minus')}</button><input data-in="sw" value="${el.strokeWidth}"><button data-act="sw+">${ic('plus')}</button></div></div>`
        + `<div class="grp">${['line', 'arrowLine', 'dashLine', 'dotLine'].map((k) => btn('ltype-' + k, { line: 'minus', arrowLine: 'move-right', dashLine: 'ellipsis', dotLine: 'grip-horizontal' }[k], SHAPES[k].name, el.shape === k)).join('')}</div>`
        + common(els);
    } else if (el.type === 'shape') {
      h = `<div class="grp">${colorBtn('fill', el.fill, 'Colour')}${btn('border', 'square-dashed', 'Border', el.strokeWidth > 0, 'Border')}${['rect', 'rounded'].includes(el.shape) ? btn('radius', 'square-round-corner', 'Corner rounding') : ''}</div>`
        + `<div class="grp">${btn('shapeswap', 'shapes', 'Change shape', false, 'Shape')}</div>` + common(els);
    } else if (el.type === 'icon') {
      h = `<div class="grp">${colorBtn('icolor', el.color, 'Icon colour')}<span class="ctx-label">Colour</span></div>`
        + `<div class="grp"><span class="ctx-label">Line weight</span><div class="num"><button data-act="isw-">${ic('minus')}</button><input data-in="isw" value="${el.sw}"><button data-act="isw+">${ic('plus')}</button></div></div>` + common(els);
    } else if (el.type === 'image') {
      h = `<div class="grp">${btn('replace', 'replace', 'Replace photo', false, 'Replace')}${btn('filters', 'sliders-horizontal', 'Adjust', false, 'Adjust')}${btn('frame', 'crop', 'Frame shape', false, 'Frame')}${btn('focus', 'scan', 'Crop focus', false, '')}</div>`
        + `<div class="grp">${el.origSrc ? btn('restorebg', 'undo-2', 'Restore original', false, '') : btn('removebg', 'eraser', 'Remove background', false, 'Remove background')}${btn('flip', 'flip-horizontal-2', 'Flip', el.flipX)}${btn('asbg', 'wallpaper', 'Set as background', false, 'Set as background')}</div>`
        + (el.credit ? `<span class="ctx-label" title="${el.credit.replace(/"/g, '')}">${ic('info')}</span>` : '') + common(els);
    } else {
      h = `<span class="ctx-label">${{ sticker: 'Sticker', logo: 'Logo', svg: 'Icon' }[el.type] || 'Element'}</span>` + common(els);
    }
  }
  bar.innerHTML = h;
  translateDom(bar);
}
function common(els) {
  const lock = els.every((e) => e.locked);
  return `<div class="grp push">${btn('animate', 'sparkles', 'Animate', els.some((e) => e.anim), 'Animate')}${btn('position', 'layers', 'Position & layers', false, 'Position')}${btn('opacity', 'blend', 'Transparency')}${btn('shadowbox', 'square-stack', 'Drop shadow', els.every((e) => e.shadowBox))}</div>`
    + `<div class="grp">${btn('dup', 'copy-plus', 'Duplicate')}${btn('lock', lock ? 'lock' : 'lock-open', lock ? 'Unlock' : 'Lock', lock)}${`<button class="cb danger" data-act="del" title="Delete">${ic('trash-2')}</button>`}</div>`;
}

// apply a change to the selection; `live` = no history entry yet (sliders)
function set(fn, live = false) {
  for (const el of selected()) { fn(el); patchNode(el); }
  renderOverlay();
  if (!live) { commit(); emit('canvas'); }
}
const range = (label, key, min, max, val, unit = '') => `<div class="range-row"><label>${label}</label><input type="range" data-k="${key}" min="${min}" max="${max}" value="${val}"><span class="v">${val}${unit}</span></div>`;
function wireRanges(p, apply) {
  p.querySelectorAll('input[type=range]').forEach((r) => {
    r.oninput = () => { r.nextElementSibling.textContent = r.value + (r.nextElementSibling.textContent.replace(/[-\d.]/g, '')); apply(r.dataset.k, Number(r.value), true); };
    r.onchange = () => apply(r.dataset.k, Number(r.value), false);
  });
}

function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act; const el = selected()[0];
  const editing = !!state.editingId;
  const exec = (cmd) => { document.execCommand(cmd); const n = document.querySelector('.el.editing .txt'); if (n) { el.html = n.innerHTML; } };
  switch (a) {
    case 'slidebg': { const bg = curSlide().bg; openColorPopover(b, bg.type === 'color' ? bg.value : '#FFFFFF', (c) => { curSlide().bg = c.includes('gradient') ? { type: 'gradient', value: c } : { type: 'color', value: c }; emit('canvas'); }, () => commit(), { gradients: true }); break; }
    case 'bgpanel': openTab('background'); break;
    case 'slide-dup': document.dispatchEvent(new Event('deckly-slide-dup')); break;
    case 'slide-del': document.dispatchEvent(new Event('deckly-slide-del')); break;
    case 'font': fontPopover(b, el); break;
    case 'size-': case 'size+': set((x) => (x.size = Math.max(6, Math.round(x.size + (a === 'size+' ? 1 : -1) * Math.max(1, Math.round(x.size * 0.08)))))); break;
    case 'tcolor': openColorPopover(b, el.color, (c) => set((x) => (x.color = c), true), () => { commit(); emit('canvas'); }); break;
    case 'bold': case 'italic': case 'underline': case 'strike':
      if (editing && window.getSelection().toString()) { exec({ bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough' }[a]); commit(); }
      else set((x) => (x[a] = !x[a]));
      break;
    case 'upper': set((x) => (x.upper = !x.upper)); break;
    case 'align': set((x) => (x.align = { left: 'center', center: 'right', right: 'justify', justify: 'left' }[x.align || 'left'])); break;
    case 'spacing': popover(b, range('Letter spacing', 'spacing', -10, 80, el.spacing || 0) + range('Line height', 'lh', 80, 250, Math.round((el.lineHeight || 1.25) * 100), '%'),
      (p) => wireRanges(p, (k, v, live) => set((x) => { if (k === 'spacing') x.spacing = v; else x.lineHeight = v / 100; }, live))); break;
    case 'effects': effectsPopover(b, el); break;
    case 'stroke': openColorPopover(b, el.stroke, (c) => set((x) => (x.stroke = c), true), () => { commit(); emit('canvas'); }); break;
    case 'sw-': case 'sw+': set((x) => (x.strokeWidth = Math.max(1, x.strokeWidth + (a === 'sw+' ? 2 : -2)))); break;
    case 'fill': openColorPopover(b, el.fill, (c) => set((x) => (x.fill = c), true), () => { commit(); emit('canvas'); }); break;
    case 'border': popover(b, range('Thickness', 'bw', 0, 40, el.strokeWidth || 0) + '<button class="btn ghost block" data-bc style="margin-top:6px">Border colour</button>', (p) => {
      wireRanges(p, (k, v, live) => set((x) => { x.strokeWidth = v; x.stroke = x.stroke || '#1E1F2B'; }, live));
      p.querySelector('[data-bc]').onclick = (ev) => openColorPopover(ev.currentTarget, el.stroke || '#1E1F2B', (c) => set((x) => { x.stroke = c; if (!x.strokeWidth) x.strokeWidth = 4; }, true), () => { commit(); emit('canvas'); });
    }); break;
    case 'radius': popover(b, range('Rounding', 'r', 0, 50, el.radius ?? (el.shape === 'rounded' ? 18 : 0)), (p) => wireRanges(p, (k, v, live) => set((x) => { x.radius = v; x.shape = 'rounded'; }, live))); break;
    case 'shapeswap': popover(b, `<div class="grid g5">${Object.entries(SHAPES).filter(([, s]) => !s.line).map(([k]) => `<button class="tile" data-s="${k}">${shapeSvg(k, '#B9A8FF')}</button>`).join('')}</div>`,
      (p) => p.querySelectorAll('[data-s]').forEach((x) => (x.onclick = () => set((y) => (y.shape = x.dataset.s))))); break;
    case 'icolor': openColorPopover(b, el.color, (c) => set((x) => (x.color = c), true), () => { commit(); emit('canvas'); }); break;
    case 'isw-': case 'isw+': set((x) => (x.sw = Math.max(0.5, Math.min(4, Math.round((x.sw + (a === 'isw+' ? 0.25 : -0.25)) * 100) / 100)))); break;
    case 'replace': toast('Click or drop any photo — it replaces the selected one'); set((x) => (x.placeholder = true)); openTab('photos'); break;
    case 'filters': filtersPopover(b, el); break;
    case 'frame': popover(b, `<h4>Frame shape</h4><div class="grid g4">${FRAMES.map((k) => `<button class="tile" data-f="${k}">${shapeSvg(k, '#D9DBE6')}</button>`).join('')}</div>` + range('Rounded corners', 'r', 0, 50, el.radius || 0),
      (p) => { p.querySelectorAll('[data-f]').forEach((x) => (x.onclick = () => set((y) => (y.frame = x.dataset.f)))); wireRanges(p, (k, v, live) => set((x) => { x.radius = v; x.frame = 'rect'; }, live)); }); break;
    case 'focus': popover(b, '<h4>Which part of the photo to keep</h4>' + range('Left ↔ right', 'fx', 0, 100, el.focusX ?? 50) + range('Top ↕ bottom', 'fy', 0, 100, el.focusY ?? 50),
      (p) => wireRanges(p, (k, v, live) => set((x) => { if (k === 'fx') x.focusX = v; else x.focusY = v; }, live))); break;
    case 'flip': set((x) => (x.flipX = !x.flipX)); break;
    case 'removebg': doRemoveBg(el, b); break;
    case 'restorebg': set((x) => { x.src = x.origSrc; delete x.origSrc; }); toast('Original photo restored'); break;
    case 'asbg': curSlide().bg = { type: 'image', value: el.src }; removeSel(); toast('Photo set as background'); break;
    case 'position': positionPopover(b); break;
    case 'animate': animatePopover(b); break;
    case 'transition': transitionPopover(b); break;
    case 'opacity': popover(b, range('Transparency', 'op', 0, 100, Math.round((el.opacity ?? 1) * 100), '%'), (p) => wireRanges(p, (k, v, live) => set((x) => (x.opacity = v / 100), live))); break;
    case 'shadowbox': { const v = !selected().every((x) => x.shadowBox); set((x) => (x.shadowBox = v)); break; }
    case 'dup': duplicate(); break;
    case 'lock': { const v = !selected().every((x) => x.locked); set((x) => (x.locked = v)); break; }
    case 'del': removeSel(); break;
    case 'dist-h': case 'dist-v': distribute(a === 'dist-h' ? 'x' : 'y'); break;
    case 'group': groupSel(); break;
    case 'ungroup': ungroupSel(); break;
    default: if (a.startsWith('al-')) align(a.slice(3)); if (a.startsWith('ltype-')) set((x) => (x.shape = a.slice(6)));
  }
}
function onChange(e) {
  const i = e.target.closest('[data-in]'); if (!i) return;
  const v = Number(i.value); if (!isFinite(v)) return;
  if (i.dataset.in === 'size') set((x) => (x.size = Math.max(6, Math.min(800, v))));
  if (i.dataset.in === 'sw') set((x) => (x.strokeWidth = Math.max(1, Math.min(80, v))));
  if (i.dataset.in === 'isw') set((x) => (x.sw = Math.max(0.5, Math.min(4, v))));
}

function fontPopover(b, el) {
  popover(b, `<h4>Fonts (offline)</h4><div class="pop-list">${packs.fonts.map((f) => `<button class="font-item ${f === el.font ? 'on' : ''}" data-f="${f}" style="font-family:'${f}'">${f}</button>`).join('')}</div>`,
    (p) => p.querySelectorAll('[data-f]').forEach((x) => (x.onclick = () => { set((y) => (y.font = x.dataset.f)); closePopover(); })));
}
function effectsPopover(b, el) {
  const sw = (k, on, label) => `<div class="toggle-row"><span>${label}</span><button class="switch ${on ? 'on' : ''}" data-t="${k}"></button></div>`;
  popover(b, '<h4>Text effects</h4>' + sw('shadow', el.shadow, 'Shadow') + sw('outline', el.outline, 'Outline') + sw('highlight', !!el.highlight, 'Highlight behind text')
    + '<button class="btn ghost block" data-hc style="margin-top:6px">Highlight / outline colour</button>', (p) => {
    p.querySelectorAll('[data-t]').forEach((s) => (s.onclick = () => {
      s.classList.toggle('on'); const v = s.classList.contains('on');
      set((x) => { if (s.dataset.t === 'highlight') x.highlight = v ? (x.hlColor || '#FFE066') : null; else x[s.dataset.t] = v; });
    }));
    p.querySelector('[data-hc]').onclick = (ev) => openColorPopover(ev.currentTarget, el.highlight || '#FFE066', (c) => set((x) => { if (x.outline && !x.highlight) x.outlineColor = c; else { x.hlColor = c; x.highlight = c; } }, true), () => { commit(); emit('canvas'); });
  });
}
function filtersPopover(b, el) {
  const f = el.filters || {};
  const presets = [['Original', {}], ['B&W', { grayscale: 100, contrast: 110 }], ['Warm', { sepia: 30, saturate: 120 }], ['Cool', { hue: 190, saturate: 80, sepia: 20 }], ['Vivid', { saturate: 150, contrast: 110 }], ['Faded', { contrast: 80, brightness: 110, saturate: 80 }]];
  popover(b, `<h4>Quick looks</h4><div class="chips">${presets.map(([n], i) => `<button class="chip" data-p="${i}">${n}</button>`).join('')}</div>`
    + range('Brightness', 'brightness', 30, 170, f.brightness ?? 100) + range('Contrast', 'contrast', 30, 170, f.contrast ?? 100) + range('Saturation', 'saturate', 0, 200, f.saturate ?? 100)
    + range('Black & white', 'grayscale', 0, 100, f.grayscale ?? 0) + range('Blur', 'blur', 0, 20, f.blur ?? 0), (p) => {
    wireRanges(p, (k, v, live) => set((x) => { x.filters = { ...(x.filters || {}), [k]: v }; }, live));
    p.querySelectorAll('[data-p]').forEach((c) => (c.onclick = () => { set((x) => (x.filters = { ...presets[c.dataset.p][1] })); filtersPopover(b, selected()[0]); }));
  });
}
function positionPopover(b) {
  popover(b, `<h4>Layers</h4><div class="pop-list">
      <button data-l="top">${ic('bring-to-front')} Bring to front</button><button data-l="up">${ic('arrow-up')} Forward</button>
      <button data-l="down">${ic('arrow-down')} Backward</button><button data-l="bottom">${ic('send-to-back')} Send to back</button></div>
    <h4 style="margin-top:10px">Align on the slide</h4><div class="grid g3">
      ${[['left', 'align-start-vertical'], ['center', 'align-center-vertical'], ['right', 'align-end-vertical'], ['top', 'align-start-horizontal'], ['middle', 'align-center-horizontal'], ['bottom', 'align-end-horizontal']].map(([k, i]) => `<button class="cb" data-a="${k}" title="${k}">${ic(i)}</button>`).join('')}</div>`, (p) => {
    p.querySelectorAll('[data-l]').forEach((x) => (x.onclick = () => layer(x.dataset.l)));
    p.querySelectorAll('[data-a]').forEach((x) => (x.onclick = () => align(x.dataset.a)));
  });
}
function distribute(axis) {
  const els = selected(); if (els.length < 3) { toast('Select 3 or more elements'); return; }
  const size = axis === 'x' ? 'w' : 'h';
  els.sort((a, b) => a[axis] - b[axis]);
  const first = els[0], last = els[els.length - 1];
  const total = els.reduce((s, e) => s + e[size], 0);
  const gap = (last[axis] + last[size] - first[axis] - total) / (els.length - 1);
  let pos = first[axis];
  for (const e of els) { e[axis] = pos; pos += e[size] + gap; }
  commit(); emit('canvas');
}

async function doRemoveBg(el, b) {
  if (el.placeholder) return;
  b.disabled = true; const old = b.innerHTML; b.innerHTML = ic('loader') + tr('Removing the background…');
  try {
    const out = await removeBackground(el.src);
    el.origSrc = el.src; el.src = out; patchNode(el); commit(); emit('canvas'); toast('Background removed');
  } catch (e) { console.error(e); toast('Could not remove the background'); b.innerHTML = old; b.disabled = false; }
}
