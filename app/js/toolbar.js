// Context bar above the canvas: shows only the controls that fit what is selected.
import { state, emit, on, commit, curSlide, selected, findEl, clone } from './store.js';
import { packs, ic, PALETTE, fontCat } from './assets.js';
import { SHAPES, SHAPE_CATS, FRAME_SHAPES, shapeSvg, isStrokeShape } from './shapes.js';
import { popover, closePopover, openColorPopover, toast, docColors } from './ui.js';
import { layer, align, distribute, removeSel, duplicate, patchNode, renderOverlay, startEditing, editShapeText, editCell, groupSel, ungroupSel, isOneGroup, startDraw, stopDraw, setProps } from './editor.js';
import { openTab, openElements } from './panels.js';
import { t as tr, translateDom } from './i18n.js';
import { hasAnim } from './anim.js';
import { removeBackground } from './bgremove.js';
import { CAPS, DASHES, KINDS as LINE_KINDS } from './elements/line.js';
import { PRESETS as TABLE_PRESETS, applyPreset, addRow, delRow, addCol, delCol } from './elements/table.js';
import { KINDS as CHART_KINDS, PALETTES, parseTable, colorOf } from './elements/chart.js';
import { TOOLS as DRAW_TOOLS } from './elements/draw.js';
import { DEVICE_FRAMES } from './render.js';
import { lib } from './library.js';
import { sanitizeHtml } from './sanitize.js';

const $ = (s) => document.querySelector(s);
let bar;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initToolbar() {
  bar = $('#ctxBar');
  on((w) => { if (['all', 'sel', 'slide', 'canvas', 'history'].includes(w)) render(); });
  bar.addEventListener('click', onClick);
  bar.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  bar.addEventListener('change', onChange);
  document.addEventListener('deckly-toolbar-act', (e) => { const b = bar.querySelector(`[data-act="${e.detail}"]`) || bar; runAction(e.detail, b); });
  document.addEventListener('deckly-edit-data', (e) => { const b = bar.querySelector('[data-act="data"]') || bar.querySelector('[data-act="qrtext"]'); if (b) b.click(); });
  document.addEventListener('deckly-open-tab', (e) => openTab(e.detail));
}

const btn = (act, icon, title, on = false, label = '') => `<button class="cb${on ? ' on' : ''}" data-act="${act}" title="${tr(title)}" aria-label="${tr(title)}" ${on ? 'aria-pressed="true"' : ''}>${icon ? ic(icon) : ''}${label ? `<span class="lbl">${tr(label)}</span>` : ''}</button>`;
const colorBtn = (act, color, title) => `<button class="cb" data-act="${act}" title="${tr(title)}" aria-label="${tr(title)}"><span class="color-dot" style="background:${esc(color)}"></span></button>`;
const sel = (act, opts, cur, title) => `<select class="tb-select" data-sel="${act}" title="${tr(title)}" aria-label="${tr(title)}">${opts.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${tr(l)}</option>`).join('')}</select>`;

function render() {
  if (!state.doc) return;
  const els = selected();
  let h = '';
  if (state.tool) {
    const t = state.tool;
    h = `<div class="grp"><span class="ctx-label">${tr('Drawing')}</span>${Object.keys(DRAW_TOOLS).map((k) => btn('tool-' + k, { pen: 'pen-tool', marker: 'brush', highlighter: 'highlighter' }[k], { pen: 'Pen', marker: 'Marker', highlighter: 'Highlighter' }[k], t.name === k)).join('')}</div>`
      + `<div class="grp">${colorBtn('toolcolor', t.color, 'Colour')}<span class="ctx-label">${tr('Thickness')}</span><input type="range" class="tb-range" data-k="toolsize" min="2" max="90" value="${t.size}"></div>`
      + `<div class="grp push"><button class="btn primary sm" data-act="drawdone">${ic('check')} ${tr('Done')}</button></div>`;
  } else if (!els.length) {
    const bg = curSlide().bg;
    h = `<div class="grp">${colorBtn('slidebg', bg.type === 'color' ? bg.value : bg.type === 'gradient' ? bg.value : `url(${bg.value}) center/cover`, 'Background colour')}<span class="ctx-label">${tr('Background')}</span></div>`
      + `<div class="grp">${btn('bgpanel', 'images', 'More backgrounds', false, 'Backgrounds')}</div>`
      + `<div class="grp">${btn('transition', 'sparkles', 'Animate', !!curSlide().transition || curSlide().elements.some(hasAnim), 'Animate')}${btn('draw', 'pen-tool', 'Draw (D)', false, 'Draw')}</div>`
      + `<div class="grp">${btn('slide-dup', 'copy-plus', 'Duplicate slide', false, 'Duplicate slide')}${btn('slide-del', 'trash-2', 'Delete slide', false, '')}</div>`
      + `<span class="ctx-label push">${tr('Tip: click an element to edit it · double-click text to type · right-click for more')}</span>`;
  } else if (els.length > 1) {
    h = `<span class="ctx-label">${tr('{n} selected', { n: els.length })}</span>`
      + `<div class="grp">${isOneGroup(els) ? btn('ungroup', 'ungroup', 'Ungroup (Ctrl+Shift+G)', false, 'Ungroup') : btn('group', 'group', 'Group (Ctrl+G)', false, 'Group')}</div>`
      + `<div class="grp">${btn('al-left', 'align-start-vertical', 'Align left')}${btn('al-center', 'align-center-vertical', 'Align centre')}${btn('al-right', 'align-end-vertical', 'Align right')}${btn('al-top', 'align-start-horizontal', 'Align top')}${btn('al-middle', 'align-center-horizontal', 'Align middle')}${btn('al-bottom', 'align-end-horizontal', 'Align bottom')}</div>`
      + `<div class="grp">${btn('dist-h', 'align-horizontal-space-around', 'Space evenly across')}${btn('dist-v', 'align-vertical-space-around', 'Space evenly down')}</div>`
      + (els.every((e) => e.type === 'text') ? textTools(els[0], true) : '')
      + common(els);
  } else {
    const el = els[0];
    if (el.type === 'text') h = textTools(el) + common(els);
    else if (el.type === 'line') {
      h = `<div class="grp">${colorBtn('stroke', el.stroke, 'Line colour')}<div class="num"><button data-act="sw-" aria-label="−">${ic('minus')}</button><input data-in="sw" value="${el.strokeWidth}" aria-label="${tr('Thickness')}"><button data-act="sw+" aria-label="+">${ic('plus')}</button></div></div>`
        + `<div class="grp">${DASHES.map((d) => btn('dash-' + d, { solid: 'minus', dashed: 'ellipsis', dotted: 'grip-horizontal' }[d], { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' }[d], el.dash === d)).join('')}</div>`
        + `<div class="grp"><span class="ctx-label">${tr('Start')}</span>${sel('capStart', CAPS.map((c) => [c, capName(c)]), el.capStart, 'Start cap')}<span class="ctx-label">${tr('End')}</span>${sel('capEnd', CAPS.map((c) => [c, capName(c)]), el.capEnd, 'End cap')}</div>`
        + `<div class="grp">${LINE_KINDS.map((k) => btn('kind-' + k, { straight: 'minus', elbow: 'corner-down-right', curve: 'spline' }[k], { straight: 'Straight', elbow: 'Elbow', curve: 'Curved' }[k], el.kind === k)).join('')}${el.kind !== 'straight' ? `<input type="range" class="tb-range" data-k="bend" min="-100" max="100" value="${Math.round((el.bend ?? 0.5) * 100)}" title="${tr('Curve')}">` : ''}</div>`
        + common(els);
    } else if (el.type === 'shape') {
      const stroke = isStrokeShape(el.shape);
      h = `<div class="grp">${colorBtn('fill', el.gradient ? `linear-gradient(135deg,${el.gradient.stops.map((s) => s[0]).join(',')})` : el.fill, stroke ? 'Line colour' : 'Colour')}${stroke ? `<div class="num"><button data-act="sw-" aria-label="−">${ic('minus')}</button><input data-in="sw" value="${el.strokeWidth || 6}"><button data-act="sw+" aria-label="+">${ic('plus')}</button></div>` : btn('border', 'square-dashed', 'Border', el.strokeWidth > 0, 'Border')}${['rect', 'rounded', 'process'].includes(el.shape) ? btn('radius', 'square-round-corner', 'Corner rounding') : ''}</div>`
        + `<div class="grp">${btn('shapeswap', 'shapes', 'Change shape', false, 'Shape')}${btn('shapetext', 'type', 'Text in the shape', !!el.text?.html, 'Text')}</div>`
        + (el.text?.html || el.id === state.editingId ? textTools(el.text, false, 'st-') : '')
        + common(els);
    } else if (el.type === 'icon') {
      const mono = !el.data || !lib.index.find((p) => p.id === el.name.split(':')[0])?.palette;
      h = (mono ? `<div class="grp">${colorBtn('icolor', el.color, 'Icon colour')}<span class="ctx-label">${tr('Colour')}</span></div>` : '')
        + (el.data?.b?.includes('stroke') || !el.data ? `<div class="grp"><span class="ctx-label">${tr('Line weight')}</span><div class="num"><button data-act="isw-" aria-label="−">${ic('minus')}</button><input data-in="isw" value="${el.sw || 2}"><button data-act="isw+" aria-label="+">${ic('plus')}</button></div></div>` : '') + common(els);
    } else if (el.type === 'image') {
      const st = !!el.sticker, dev = (el.frame || '').startsWith('device:');
      h = `<div class="grp">${st ? '' : btn('replace', 'replace', 'Replace photo', false, 'Replace')}${btn('filters', 'sliders-horizontal', 'Adjust', false, 'Adjust')}${st ? '' : btn('frame', 'crop', 'Frame', false, 'Frame')}${st ? '' : btn('focus', 'scan', 'Crop focus', false, '')}${dev ? colorBtn('framecolor', el.frameColor || '#1E1F2B', 'Device colour') : ''}</div>`
        + `<div class="grp">${st ? '' : el.origSrc ? btn('restorebg', 'undo-2', 'Restore original', false, '') : btn('removebg', 'eraser', 'Remove background', false, 'Remove background')}${btn('flip', 'flip-horizontal-2', 'Flip', el.flipX)}${btn('flipv', 'flip-vertical-2', 'Flip vertically', el.flipY)}${st ? '' : btn('asbg', 'wallpaper', 'Set as background', false, 'Set as background')}</div>`
        + (el.credit ? `<span class="ctx-label" title="${esc(el.credit)}">${ic('info')}</span>` : '') + common(els);
    } else if (el.type === 'table') {
      const s = el.style, cl = state.cell && state.cell.id === el.id ? el.cells[state.cell.r][state.cell.c] : null;
      h = `<div class="grp">${btn('tstyle', 'table-properties', 'Table style', false, 'Style')}${btn('theader', 'panel-top', 'Header row', s.header)}${btn('tbanded', 'rows-3', 'Banded rows', s.banded)}${sel('tborder', [['all', 'All borders'], ['horizontal', 'Horizontal'], ['outer', 'Outside'], ['none', 'No border']], s.border, 'Borders')}${colorBtn('tbcolor', s.borderColor || '#E6E7EF', 'Border colour')}</div>`
        + `<div class="grp">${btn('trow+', 'between-horizontal-end', 'Add a row', false, '')}${btn('trow-', 'minus', 'Remove a row', false, '')}<span class="ctx-label">${el.rows} ${tr('rows')}</span>${btn('tcol+', 'between-vertical-end', 'Add a column', false, '')}${btn('tcol-', 'minus', 'Remove a column', false, '')}<span class="ctx-label">${el.cols} ${tr('cols')}</span></div>`
        + `<div class="grp">${cl ? colorBtn('tcellfill', cl.fill || (s.header && state.cell.r === 0 ? s.headerFill : s.fill), 'Cell colour') : ''}<button class="cb font-pick" data-act="tfont" style="font-family:'${esc(s.font)}'">${esc(s.font)}${ic('chevron-down')}</button><div class="num"><button data-act="tsize-" aria-label="−">${ic('minus')}</button><input data-in="tsize" value="${Math.round(s.size)}"><button data-act="tsize+" aria-label="+">${ic('plus')}</button></div>${colorBtn('tcolor', cl?.color || s.color, 'Text colour')}${btn('tbold', 'bold', 'Bold', cl ? cl.bold ?? (s.header && state.cell.r === 0) : false)}${btn('talign', { left: 'align-left', center: 'align-center', right: 'align-right' }[cl?.align || s.align || 'left'], 'Alignment')}</div>`
        + common(els);
    } else if (el.type === 'chart') {
      const o = el.opts;
      h = `<div class="grp">${btn('ctype', { column: 'chart-column', bar: 'chart-bar', line: 'chart-line', area: 'chart-area', pie: 'chart-pie', donut: 'circle-dot-dashed' }[el.kind], 'Chart type', false, CHART_KINDS.find((k) => k[0] === el.kind)?.[1] || 'Chart')}${btn('data', 'table', 'Edit the data', false, 'Data')}${btn('cpalette', 'palette', 'Colours', false, 'Colours')}</div>`
        + `<div class="grp">${btn('c-legend', 'list', 'Legend', o.legend)}${btn('c-values', 'hash', 'Show values', o.values)}${['column', 'bar', 'line', 'area'].includes(el.kind) ? btn('c-grid', 'grid-2x2', 'Grid lines', o.grid) : ''}${['line', 'area'].includes(el.kind) ? btn('c-smooth', 'spline', 'Smooth curves', o.smooth) : ''}${['column', 'bar'].includes(el.kind) && el.series.length > 1 ? btn('c-stacked', 'layers', 'Stacked', o.stacked) : ''}${['column', 'bar'].includes(el.kind) ? btn('c-rounded', 'square-round-corner', 'Rounded bars', o.rounded) : ''}</div>`
        + `<div class="grp"><div class="num"><button data-act="csize-" aria-label="−">${ic('minus')}</button><input data-in="csize" value="${Math.round(o.size || 28)}" title="${tr('Text size')}"><button data-act="csize+" aria-label="+">${ic('plus')}</button></div>${colorBtn('ccolor', o.color || '#1E1F2B', 'Text colour')}</div>`
        + common(els);
    } else if (el.type === 'qr') {
      h = `<div class="grp">${btn('qrtext', 'link', 'Link or text', false, (el.text || '').slice(0, 28) || 'Link')}</div><div class="grp">${colorBtn('qrfg', el.fg, 'Code colour')}${colorBtn('qrbg', el.bg, 'Background colour')}${['square', 'rounded', 'dots'].map((s) => btn('qrstyle-' + s, { square: 'square', rounded: 'square-round-corner', dots: 'circle-dot' }[s], { square: 'Square', rounded: 'Rounded', dots: 'Dots' }[s], el.style === s)).join('')}</div>` + common(els);
    } else if (el.type === 'draw') {
      h = `<div class="grp">${colorBtn('dcolor', el.fill && el.fill !== 'none' ? el.fill : el.stroke, 'Colour')}${el.strokeWidth ? `<div class="num"><button data-act="dsw-" aria-label="−">${ic('minus')}</button><input data-in="dsw" value="${el.strokeWidth}"><button data-act="dsw+" aria-label="+">${ic('plus')}</button></div>` : ''}<span class="ctx-label">${tr({ pen: 'Pen', marker: 'Marker', highlighter: 'Highlighter' }[el.tool] || 'Drawing')}</span></div>` + common(els);
    } else {
      h = `<span class="ctx-label">${tr({ sticker: 'Sticker', logo: 'Logo', svg: 'Icon' }[el.type] || 'Element')}</span>` + common(els);
    }
  }
  bar.innerHTML = h;
  translateDom(bar);
}
const capName = (c) => ({ none: 'None', arrow: 'Arrow', triangle: 'Triangle', circle: 'Circle', square: 'Square', bar: 'Bar', diamond: 'Diamond' }[c]);
// text controls; `t` may be a text element or a shape's text object (prefix "st-")
function textTools(t, multi = false, p = '') {
  if (!t) return '';
  return `<div class="grp"><button class="cb font-pick" data-act="${p}font" style="font-family:'${esc(t.font)}'">${esc(t.font || 'Inter')}${ic('chevron-down')}</button></div>`
    + `<div class="grp"><div class="num"><button data-act="${p}size-" aria-label="−">${ic('minus')}</button><input data-in="${p}size" value="${Math.round(t.size || 32)}" aria-label="${tr('Text size')}"><button data-act="${p}size+" aria-label="+">${ic('plus')}</button></div>${btn(p + 'sizes', 'chevron-down', 'Sizes')}</div>`
    + `<div class="grp"><button class="cb" data-act="${p}tcolor" title="${tr('Text colour')}"><span class="text-color">A<span style="background:${esc(t.color)}"></span></span></button>`
    + btn(p + 'bold', 'bold', 'Bold', t.bold) + btn(p + 'italic', 'italic', 'Italic', t.italic) + btn(p + 'underline', 'underline', 'Underline', t.underline) + btn(p + 'strike', 'strikethrough', 'Strikethrough', t.strike) + btn(p + 'upper', 'case-upper', 'Uppercase', t.upper) + '</div>'
    + `<div class="grp">${btn(p + 'align', { left: 'align-left', center: 'align-center', right: 'align-right', justify: 'align-justify' }[t.align || 'left'], 'Alignment')}${p ? btn('st-valign', { top: 'align-start-horizontal', bottom: 'align-end-horizontal' }[t.valign] || 'align-center-horizontal', 'Vertical alignment') : btn('list', 'list', 'Bullet list', /^(•|&bull;)/.test(String(t.html || '').replace(/<[^>]+>/g, '').trim()))}${btn(p + 'spacing', 'between-vertical-start', 'Spacing')}${p ? '' : btn('effects', 'wand-sparkles', 'Effects', t.shadow || t.outline || !!t.highlight || !!t.effect, 'Effects')}</div>`;
}
function common(els) {
  const lock = els.every((e) => e.locked);
  return `<div class="grp push">${btn('animate', 'sparkles', 'Animate', els.some(hasAnim), 'Animate')}${btn('position', 'layers', 'Position & layers', false, 'Position')}${btn('opacity', 'blend', 'Transparency', els.some((e) => (e.opacity ?? 1) < 1), els.length === 1 && (els[0].opacity ?? 1) < 1 ? Math.round(els[0].opacity * 100) + '%' : '')}${btn('shadowbox', 'square-stack', 'Drop shadow', els.every((e) => e.shadowBox))}</div>`
    + `<div class="grp">${btn('dup', 'copy-plus', 'Duplicate')}${btn('lock', lock ? 'lock' : 'lock-open', lock ? 'Unlock' : 'Lock', lock)}<button class="cb danger" data-act="del" title="${tr('Delete')}" aria-label="${tr('Delete')}">${ic('trash-2')}</button></div>`;
}

// apply a change to the selection; `live` = no history entry yet (sliders)
function set(fn, live = false) {
  for (const el of selected()) { fn(el); patchNode(el); }
  renderOverlay();
  if (!live) { commit(); emit('canvas'); }
}
const range = (label, key, min, max, val, unit = '') => `<div class="range-row"><label>${tr(label)}</label><input type="range" data-k="${key}" min="${min}" max="${max}" value="${val}"><span class="v">${val}${unit}</span></div>`;
function wireRanges(p, apply) {
  p.querySelectorAll('input[type=range]').forEach((r) => {
    r.oninput = () => { r.nextElementSibling.textContent = r.value + (r.nextElementSibling.textContent.replace(/[-\d.]/g, '')); apply(r.dataset.k, Number(r.value), true); };
    r.onchange = () => apply(r.dataset.k, Number(r.value), false);
  });
}
// the text target of an action: the element, or the shape's text object
const textOf = (el, p) => (p ? el.text : el);

function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  runAction(b.dataset.act, b);
}
function runAction(a, b) {
  const el = selected()[0];
  const editing = !!state.editingId;
  const exec = (cmd) => { document.execCommand(cmd); const n = document.querySelector('.el.editing .txt'); if (n && el) { if (el.type === 'text') el.html = sanitizeHtml(n.innerHTML); else if (el.text) el.text.html = sanitizeHtml(n.innerHTML); } };
  const p = a.startsWith('st-') ? 'st-' : '';
  const act = p ? a.slice(3) : a;
  const T = (x) => (p ? x.text : x);
  switch (act) {
    case 'slidebg': { const bg = curSlide().bg; openColorPopover(b, bg.type === 'color' ? bg.value : '#FFFFFF', (c) => { curSlide().bg = c.includes('gradient') ? { type: 'gradient', value: c } : { type: 'color', value: c }; emit('canvas'); }, () => commit(), { gradients: true }); break; }
    case 'bgpanel': openTab('background'); break;
    case 'slide-dup': document.dispatchEvent(new Event('deckly-slide-dup')); break;
    case 'slide-del': document.dispatchEvent(new Event('deckly-slide-del')); break;
    case 'draw': startDraw('pen'); break;
    case 'drawdone': stopDraw(); break;
    case 'toolcolor': openColorPopover(b, state.tool.color, (c) => { state.tool.color = c; }, () => render()); break;
    // text (element or shape text)
    case 'font': fontPopover(b, T(el), (f) => set((x) => (T(x).font = f))); break;
    case 'size-': case 'size+': set((x) => { const t = T(x); t.size = Math.max(6, Math.round(t.size + (act === 'size+' ? 1 : -1) * Math.max(1, Math.round(t.size * 0.08)))); }); break;
    case 'sizes': popover(b, `<div class="pop-list cols">${[12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 110, 128, 144, 160, 200].map((s) => `<button data-s="${s}" class="${Math.round(T(el).size) === s ? 'on' : ''}">${s}</button>`).join('')}</div>`, (pp) => pp.querySelectorAll('[data-s]').forEach((x) => (x.onclick = () => { set((y) => (T(y).size = +x.dataset.s)); closePopover(); })), { width: 220 }); break;
    case 'tcolor': openColorPopover(b, T(el).color, (c) => { if (editing && window.getSelection().toString()) { document.execCommand('foreColor', false, c); } else set((x) => (T(x).color = c), true); }, () => { if (editing) { const n = document.querySelector('.el.editing .txt'); if (n) { if (el.type === 'text') el.html = sanitizeHtml(n.innerHTML); else el.text.html = sanitizeHtml(n.innerHTML); } } commit(); emit('canvas'); }); break;
    case 'bold': case 'italic': case 'underline': case 'strike':
      if (editing && window.getSelection().toString()) { exec({ bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough' }[act]); commit(); }
      else set((x) => (T(x)[act] = !T(x)[act]));
      break;
    case 'upper': set((x) => (T(x).upper = !T(x).upper)); break;
    case 'align': set((x) => (T(x).align = { left: 'center', center: 'right', right: p ? 'left' : 'justify', justify: 'left' }[T(x).align || 'left'])); break;
    case 'valign': set((x) => (x.text.valign = { middle: 'top', top: 'bottom', bottom: 'middle' }[x.text.valign || 'middle'])); break;
    case 'list': set((x) => { const lines = (x.html || '').split(/<br\s*\/?>/i); const on = lines.every((l) => /^\s*(•|&bull;)/.test(l.replace(/<[^>]+>/g, ''))); x.html = lines.map((l) => (on ? l.replace(/^(\s*)(•|&bull;)\s?/, '$1') : /^\s*(•|&bull;)/.test(l.replace(/<[^>]+>/g, '')) ? l : '• ' + l)).join('<br>'); }); break;
    case 'spacing': popover(b, range('Letter spacing', 'spacing', -10, 80, T(el).spacing || 0) + range('Line height', 'lh', 80, 250, Math.round((T(el).lineHeight || 1.25) * 100), '%'),
      (pp) => wireRanges(pp, (k, v, live) => set((x) => { if (k === 'spacing') T(x).spacing = v; else T(x).lineHeight = v / 100; }, live))); break;
    case 'effects': effectsPopover(b, el); break;
    // lines & shapes
    case 'stroke': openColorPopover(b, el.stroke, (c) => set((x) => (x.stroke = c), true), () => { commit(); emit('canvas'); }); break;
    case 'sw-': case 'sw+': set((x) => { if (x.type === 'line') { x.strokeWidth = Math.max(1, x.strokeWidth + (act === 'sw+' ? 2 : -2)); } else x.strokeWidth = Math.max(1, (x.strokeWidth || 6) + (act === 'sw+' ? 2 : -2)); }); break;
    case 'fill': if (el.gradient) gradientPopover(b, el); else openColorPopover(b, el.fill, (c) => set((x) => { if (c.includes('gradient')) { const cs = c.match(/#[0-9a-f]{6}/gi) || ['#6C4CF5', '#FF6B8B']; x.gradient = { type: 'linear', angle: 135, stops: cs.map((col, i) => [col, Math.round((i / (cs.length - 1)) * 100)]) }; } else { delete x.gradient; x.fill = c; } }, true), () => { commit(); emit('canvas'); }, { gradients: true }); break;
    case 'border': popover(b, range('Thickness', 'bw', 0, 40, el.strokeWidth || 0) + `<button class="btn ghost block" data-bc style="margin-top:6px">${tr('Border colour')}</button>`, (pp) => {
      wireRanges(pp, (k, v, live) => set((x) => { x.strokeWidth = v; x.stroke = x.stroke || '#1E1F2B'; }, live));
      pp.querySelector('[data-bc]').onclick = (ev) => openColorPopover(ev.currentTarget, el.stroke || '#1E1F2B', (c) => set((x) => { x.stroke = c; if (!x.strokeWidth) x.strokeWidth = 4; }, true), () => { commit(); emit('canvas'); });
    }); break;
    case 'radius': popover(b, range('Rounding', 'r', 0, 50, el.radius ?? (el.shape === 'rounded' ? 18 : 0)), (pp) => wireRanges(pp, (k, v, live) => set((x) => { x.radius = v; if (x.shape === 'rect') x.shape = 'rounded'; }, live))); break;
    case 'shapeswap': shapePopover(b, (k) => set((y) => { y.shape = k; if (SHAPES[k].css && y.shape !== 'rounded') y.radius = y.radius ?? 0; })); break;
    case 'shapetext': editShapeText(el.id); break;
    case 'icolor': openColorPopover(b, el.color, (c) => set((x) => (x.color = c), true), () => { commit(); emit('canvas'); }); break;
    case 'isw-': case 'isw+': set((x) => (x.sw = Math.max(0.5, Math.min(4, Math.round(((x.sw || 2) + (act === 'isw+' ? 0.25 : -0.25)) * 100) / 100)))); break;
    // images
    case 'replace': toast('Click or drop any photo — it replaces the selected one'); set((x) => (x.placeholder = true)); openTab('photos'); break;
    case 'filters': filtersPopover(b, el); break;
    case 'frame': framePopover(b, el); break;
    case 'framecolor': openColorPopover(b, el.frameColor || '#1E1F2B', (c) => set((x) => (x.frameColor = c), true), () => { commit(); emit('canvas'); }); break;
    case 'focus': popover(b, `<h4>${tr('Which part of the photo to keep')}</h4>` + range('Left ↔ right', 'fx', 0, 100, el.focusX ?? 50) + range('Top ↕ bottom', 'fy', 0, 100, el.focusY ?? 50),
      (pp) => wireRanges(pp, (k, v, live) => set((x) => { if (k === 'fx') x.focusX = v; else x.focusY = v; }, live))); break;
    case 'flip': set((x) => (x.flipX = !x.flipX)); break;
    case 'flipv': set((x) => (x.flipY = !x.flipY)); break;
    case 'removebg': doRemoveBg(el, b); break;
    case 'restorebg': set((x) => { x.src = x.origSrc; delete x.origSrc; }); toast('Original photo restored'); break;
    case 'asbg': curSlide().bg = { type: 'image', value: el.src }; removeSel(); toast('Photo set as background'); break;
    // tables
    case 'tstyle': popover(b, `<h4>${tr('Table style')}</h4><div class="grid g2 tables">${Object.entries(TABLE_PRESETS).map(([k, pr]) => `<button class="tile wide ${el.style.preset === k ? 'on' : ''}" data-tp="${k}" title="${tr(pr.name)}"><div class="mini-table"><div style="background:${pr.headerFill === 'transparent' ? '#fff' : pr.headerFill};border-bottom:2px solid ${pr.border === 'none' ? 'transparent' : pr.borderColor}"></div>${[0, 1, 2].map((i) => `<div style="background:${pr.banded && i % 2 === 0 ? pr.bandFill : pr.fill === 'transparent' ? '#fff' : pr.fill};border-bottom:1px solid ${pr.border === 'none' || pr.border === 'outer' ? 'transparent' : pr.borderColor}"></div>`).join('')}</div></button>`).join('')}</div>${range('Cell padding', 'pad', 0, 80, el.style.pad || 16)}${range('Rounded corners', 'trad', 0, 60, el.style.radius || 0)}<button class="btn ghost block" data-hc style="margin-top:6px">${tr('Header colour')}</button>`, (pp) => {
      pp.querySelectorAll('[data-tp]').forEach((x) => (x.onclick = () => { set((y) => applyPreset(y, x.dataset.tp)); pp.querySelectorAll('[data-tp]').forEach((z) => z.classList.toggle('on', z === x)); }));
      wireRanges(pp, (k, v, live) => set((x) => { if (k === 'pad') x.style.pad = v; else x.style.radius = v; }, live));
      pp.querySelector('[data-hc]').onclick = (ev) => openColorPopover(ev.currentTarget, el.style.headerFill, (c) => set((x) => (x.style.headerFill = c), true), () => { commit(); emit('canvas'); });
    }, { width: 320 }); break;
    case 'theader': set((x) => (x.style.header = !x.style.header)); break;
    case 'tbanded': set((x) => (x.style.banded = !x.style.banded)); break;
    case 'tbcolor': openColorPopover(b, el.style.borderColor, (c) => set((x) => { x.style.borderColor = c; if (!x.style.borderWidth) x.style.borderWidth = 2; }, true), () => { commit(); emit('canvas'); }); break;
    case 'trow+': set((x) => addRow(x, state.cell?.id === x.id ? state.cell.r + 1 : x.rows)); break;
    case 'trow-': set((x) => delRow(x, state.cell?.id === x.id ? state.cell.r : x.rows - 1)); if (state.cell) { state.cell = null; emit('sel'); } break;
    case 'tcol+': set((x) => addCol(x, state.cell?.id === x.id ? state.cell.c + 1 : x.cols)); break;
    case 'tcol-': set((x) => delCol(x, state.cell?.id === x.id ? state.cell.c : x.cols - 1)); if (state.cell) { state.cell = null; emit('sel'); } break;
    case 'tcellfill': { const cl = el.cells[state.cell.r][state.cell.c]; openColorPopover(b, cl.fill || '#FFFFFF', (c) => set((x) => (x.cells[state.cell.r][state.cell.c].fill = c), true), () => { commit(); emit('canvas'); }); break; }
    case 'tfont': fontPopover(b, { font: el.style.font }, (f) => set((x) => (x.style.font = f))); break;
    case 'tsize-': case 'tsize+': set((x) => (x.style.size = Math.max(8, Math.round((x.style.size || 32) + (act === 'tsize+' ? 2 : -2))))); break;
    case 'tcolor': { const cell = state.cell?.id === el.id ? el.cells[state.cell.r][state.cell.c] : null; openColorPopover(b, cell?.color || el.style.color, (c) => set((x) => { if (cell) x.cells[state.cell.r][state.cell.c].color = c; else x.style.color = c; }, true), () => { commit(); emit('canvas'); }); break; }
    case 'tbold': set((x) => { if (state.cell?.id === x.id) { const cl = x.cells[state.cell.r][state.cell.c]; cl.bold = !(cl.bold ?? (x.style.header && state.cell.r === 0)); } else x.cells.forEach((r) => r.forEach((cl) => (cl.bold = !cl.bold))); }); break;
    case 'talign': set((x) => { const nx = (v) => ({ left: 'center', center: 'right', right: 'left' }[v || 'left']); if (state.cell?.id === x.id) { const cl = x.cells[state.cell.r][state.cell.c]; cl.align = nx(cl.align || x.style.align); } else x.style.align = nx(x.style.align); }); break;
    // charts
    case 'ctype': popover(b, `<div class="grid g3">${CHART_KINDS.map(([k, l]) => `<button class="tile tall ${el.kind === k ? 'on' : ''}" data-ck="${k}">${ic({ column: 'chart-column', bar: 'chart-bar', line: 'chart-line', area: 'chart-area', pie: 'chart-pie', donut: 'circle-dot-dashed' }[k], 'ic big')}<span>${tr(l)}</span></button>`).join('')}</div>`, (pp) => pp.querySelectorAll('[data-ck]').forEach((x) => (x.onclick = () => { set((y) => (y.kind = x.dataset.ck)); closePopover(); render(); })), { width: 300 }); break;
    case 'data': dataPopover(b, el); break;
    case 'cpalette': popover(b, `<h4>${tr('Colours')}</h4>${Object.entries(PALETTES).map(([k, cs]) => `<button class="palette-row ${el.opts.palette === k && !el.opts.colors?.length ? 'on' : ''}" data-pal="${k}">${cs.slice(0, 6).map((c) => `<i style="background:${c}"></i>`).join('')}</button>`).join('')}<h4 style="margin-top:10px">${tr('One colour per series')}</h4><div class="chips">${(el.kind === 'pie' || el.kind === 'donut' ? el.labels : el.series.map((s) => s.name)).map((n, i) => `<button class="chip" data-ci="${i}"><i class="color-dot" style="background:${colorOf(el, i)};width:14px;height:14px;margin-right:4px"></i>${esc(n || i + 1)}</button>`).join('')}</div>`, (pp) => {
      pp.querySelectorAll('[data-pal]').forEach((x) => (x.onclick = () => { set((y) => { y.opts.palette = x.dataset.pal; y.opts.colors = []; }); closePopover(); }));
      pp.querySelectorAll('[data-ci]').forEach((x) => (x.onclick = (ev) => openColorPopover(ev.currentTarget, colorOf(el, +x.dataset.ci), (c) => set((y) => { y.opts.colors = y.opts.colors || []; y.opts.colors[+x.dataset.ci] = c; }, true), () => { commit(); emit('canvas'); })));
    }, { width: 300 }); break;
    case 'c-legend': set((x) => (x.opts.legend = !x.opts.legend)); break;
    case 'c-values': set((x) => (x.opts.values = !x.opts.values)); break;
    case 'c-grid': set((x) => (x.opts.grid = !x.opts.grid)); break;
    case 'c-smooth': set((x) => (x.opts.smooth = !x.opts.smooth)); break;
    case 'c-stacked': set((x) => (x.opts.stacked = !x.opts.stacked)); break;
    case 'c-rounded': set((x) => (x.opts.rounded = !x.opts.rounded)); break;
    case 'csize-': case 'csize+': set((x) => (x.opts.size = Math.max(8, Math.round((x.opts.size || 28) + (act === 'csize+' ? 2 : -2))))); break;
    case 'ccolor': openColorPopover(b, el.opts.color || '#1E1F2B', (c) => set((x) => (x.opts.color = c), true), () => { commit(); emit('canvas'); }); break;
    // QR
    case 'qrtext': popover(b, `<h4>${tr('Link or text')}</h4><textarea class="name-input" id="qrT" style="height:90px;padding:8px 12px;resize:vertical">${esc(el.text)}</textarea><p class="hint">${tr('The code updates as you type. Works offline.')}</p>`, (pp) => { const t = pp.querySelector('#qrT'); t.focus(); t.oninput = () => set((x) => (x.text = t.value.slice(0, 1500)), true); t.onchange = () => { commit(); emit('canvas'); render(); }; }, { width: 320 }); break;
    case 'qrfg': openColorPopover(b, el.fg, (c) => set((x) => (x.fg = c), true), () => { commit(); emit('canvas'); }); break;
    case 'qrbg': openColorPopover(b, el.bg, (c) => set((x) => (x.bg = c), true), () => { commit(); emit('canvas'); }); break;
    // drawings
    case 'dcolor': openColorPopover(b, el.fill && el.fill !== 'none' ? el.fill : el.stroke, (c) => set((x) => { if (x.fill && x.fill !== 'none') x.fill = c; else x.stroke = c; }, true), () => { commit(); emit('canvas'); }); break;
    case 'dsw-': case 'dsw+': set((x) => (x.strokeWidth = Math.max(1, x.strokeWidth + (act === 'dsw+' ? 2 : -2)))); break;
    // common
    case 'position': positionPopover(b); break;
    case 'animate': case 'transition': openTab('animate'); break;
    case 'opacity': popover(b, range('Transparency', 'op', 0, 100, Math.round((el.opacity ?? 1) * 100), '%'), (pp) => wireRanges(pp, (k, v, live) => set((x) => (x.opacity = v / 100), live))); break;
    case 'shadowbox': { const v = !selected().every((x) => x.shadowBox); set((x) => (x.shadowBox = v)); break; }
    case 'dup': duplicate(); break;
    case 'lock': { const v = !selected().every((x) => x.locked); set((x) => (x.locked = v)); break; }
    case 'del': removeSel(); break;
    case 'dist-h': case 'dist-v': distribute(act === 'dist-h' ? 'x' : 'y'); break;
    case 'group': groupSel(); break;
    case 'ungroup': ungroupSel(); break;
    default:
      if (act.startsWith('al-')) align(act.slice(3));
      if (act.startsWith('dash-')) set((x) => (x.dash = act.slice(5)));
      if (act.startsWith('kind-')) { set((x) => (x.kind = act.slice(5))); render(); }
      if (act.startsWith('qrstyle-')) set((x) => (x.style = act.slice(8)));
      if (act.startsWith('tool-')) { state.tool.name = act.slice(5); state.tool.size = DRAW_TOOLS[state.tool.name].size; render(); }
  }
}
function onChange(e) {
  const i = e.target.closest('[data-in]');
  if (i) {
    const v = Number(i.value); if (!isFinite(v)) return;
    const k = i.dataset.in;
    if (k === 'size') set((x) => (x.size = Math.max(6, Math.min(800, v))));
    if (k === 'st-size') set((x) => (x.text.size = Math.max(6, Math.min(800, v))));
    if (k === 'sw') set((x) => (x.strokeWidth = Math.max(1, Math.min(120, v))));
    if (k === 'isw') set((x) => (x.sw = Math.max(0.5, Math.min(4, v))));
    if (k === 'tsize') set((x) => (x.style.size = Math.max(8, Math.min(200, v))));
    if (k === 'csize') set((x) => (x.opts.size = Math.max(8, Math.min(200, v))));
    if (k === 'dsw') set((x) => (x.strokeWidth = Math.max(1, Math.min(200, v))));
    return;
  }
  const s = e.target.closest('[data-sel]');
  if (s) { const k = s.dataset.sel, v = s.value; if (k === 'capStart' || k === 'capEnd') set((x) => (x[k] = v)); if (k === 'tborder') set((x) => { x.style.border = v; if (v !== 'none' && !x.style.borderWidth) x.style.borderWidth = 2; }); return; }
  const r = e.target.closest('.tb-range');
  if (r) { if (r.dataset.k === 'bend') set((x) => (x.bend = +r.value / 100)); if (r.dataset.k === 'toolsize') state.tool.size = +r.value; }
}
bar?.addEventListener?.('input', () => {});
document.addEventListener('input', (e) => { const r = e.target.closest?.('#ctxBar .tb-range'); if (!r) return; if (r.dataset.k === 'bend') set((x) => (x.bend = +r.value / 100), true); if (r.dataset.k === 'toolsize') state.tool.size = +r.value; });

function fontPopover(b, t, apply) {
  const cats = [['all', 'All'], ['sans', 'Sans'], ['serif', 'Serif'], ['display', 'Display'], ['script', 'Handwriting'], ['mono', 'Mono'], ['custom', 'My fonts']];
  let cat = 'all', q = '';
  const draw = (pp) => {
    const list = packs.fonts.filter((f) => (!q || f.toLowerCase().includes(q)) && (cat === 'all' || fontCat(f) === cat));
    pp.querySelector('.pop-list').innerHTML = list.slice(0, 200).map((f) => `<button class="font-item ${f === t.font ? 'on' : ''}" data-f="${esc(f)}" style="font-family:'${esc(f)}'">${esc(f)}</button>`).join('') || `<div class="empty-note">${tr('Nothing found.')}</div>`;
    pp.querySelectorAll('[data-f]').forEach((x) => (x.onclick = () => { apply(x.dataset.f); closePopover(); }));
  };
  popover(b, `<div class="search sm"><input id="fontQ" placeholder="${tr('Search fonts')}"></div><div class="chips">${cats.map(([k, l]) => `<button class="chip small ${k === cat ? 'on' : ''}" data-fc="${k}">${tr(l)}</button>`).join('')}</div><div class="pop-list fonts"></div>`, (pp) => {
    draw(pp);
    const qi = pp.querySelector('#fontQ'); qi.focus(); qi.oninput = () => { q = qi.value.toLowerCase(); draw(pp); };
    pp.querySelectorAll('[data-fc]').forEach((c) => (c.onclick = () => { cat = c.dataset.fc; pp.querySelectorAll('[data-fc]').forEach((z) => z.classList.toggle('on', z === c)); draw(pp); }));
    pp.querySelector('.font-item.on')?.scrollIntoView({ block: 'center' });
  }, { width: 300 });
}
function effectsPopover(b, el) {
  const fx = [['none', 'None'], ['shadow', 'Shadow'], ['lift', 'Lift'], ['hollow', 'Hollow'], ['splice', 'Splice'], ['echo', 'Echo'], ['neon', 'Neon'], ['outline', 'Outline'], ['highlight', 'Highlight']];
  const cur = el.effect || (el.shadow ? 'shadow' : el.outline ? 'outline' : el.highlight ? 'highlight' : 'none');
  popover(b, `<h4>${tr('Text effects')}</h4><div class="grid g3">${fx.map(([k, l]) => `<button class="tile fx ${cur === k ? 'on' : ''}" data-fx="${k}"><span class="fx-${k}">Aa</span><small>${tr(l)}</small></button>`).join('')}</div>
    <button class="btn ghost block" data-hc style="margin-top:10px">${tr('Effect colour')}</button>`, (p) => {
    p.querySelectorAll('[data-fx]').forEach((s) => (s.onclick = () => {
      const k = s.dataset.fx;
      set((x) => { x.shadow = k === 'shadow'; x.outline = k === 'outline'; x.highlight = k === 'highlight' ? (x.hlColor || '#FFE066') : null; x.effect = ['lift', 'hollow', 'splice', 'echo', 'neon'].includes(k) ? k : null; });
      p.querySelectorAll('[data-fx]').forEach((z) => z.classList.toggle('on', z === s));
    }));
    p.querySelector('[data-hc]').onclick = (ev) => openColorPopover(ev.currentTarget, el.glowColor || el.highlight || el.outlineColor || '#FFE066', (c) => set((x) => { if (x.highlight) { x.hlColor = c; x.highlight = c; } else if (x.outline) x.outlineColor = c; else x.glowColor = c; }, true), () => { commit(); emit('canvas'); });
  }, { width: 300 });
}
function gradientPopover(b, el) {
  const g = el.gradient;
  popover(b, `<h4>${tr('Gradient')}</h4><div class="chips"><button class="chip ${g.type !== 'radial' ? 'on' : ''}" data-gt="linear">${tr('Linear')}</button><button class="chip ${g.type === 'radial' ? 'on' : ''}" data-gt="radial">${tr('Radial')}</button></div>${range('Angle', 'angle', 0, 360, g.angle || 135, '°')}<div class="chips">${g.stops.map((s, i) => `<button class="chip" data-gs="${i}"><i class="color-dot" style="background:${s[0]};width:14px;height:14px;margin-right:4px"></i>${tr('Colour')} ${i + 1}</button>`).join('')}</div><button class="btn ghost block" data-plain style="margin-top:8px">${tr('Plain colour instead')}</button>`, (p) => {
    p.querySelectorAll('[data-gt]').forEach((x) => (x.onclick = () => set((y) => (y.gradient.type = x.dataset.gt))));
    wireRanges(p, (k, v, live) => set((x) => (x.gradient.angle = v), live));
    p.querySelectorAll('[data-gs]').forEach((x) => (x.onclick = (ev) => openColorPopover(ev.currentTarget, g.stops[+x.dataset.gs][0], (c) => set((y) => (y.gradient.stops[+x.dataset.gs][0] = c), true), () => { commit(); emit('canvas'); })));
    p.querySelector('[data-plain]').onclick = () => { set((x) => { x.fill = x.gradient.stops[0][0]; delete x.gradient; }); closePopover(); render(); };
  });
}
function shapePopover(b, onPick) {
  let cat = 'basic';
  const draw = (p) => { p.querySelector('.grid').innerHTML = Object.keys(SHAPES).filter((k) => SHAPES[k].cat === cat).map((k) => `<button class="tile" data-s="${k}" title="${tr(SHAPES[k].name)}">${shapeSvg(k, '#B9A8FF')}</button>`).join(''); p.querySelectorAll('[data-s]').forEach((x) => (x.onclick = () => onPick(x.dataset.s))); };
  popover(b, `<div class="chips scroll">${SHAPE_CATS.map(([k, l]) => `<button class="chip small ${k === cat ? 'on' : ''}" data-sc="${k}">${tr(l)}</button>`).join('')}</div><div class="grid g5"></div>`, (p) => { draw(p); p.querySelectorAll('[data-sc]').forEach((c) => (c.onclick = () => { cat = c.dataset.sc; p.querySelectorAll('[data-sc]').forEach((z) => z.classList.toggle('on', z === c)); draw(p); })); }, { width: 320 });
}
function framePopover(b, el) {
  let cat = (el.frame || '').startsWith('glyph:') ? 'letters' : (el.frame || '').startsWith('device:') ? 'devices' : 'shapes';
  const tile = (f) => f.startsWith('glyph:') ? `<button class="tile" data-f="${f}"><svg viewBox="0 0 100 100"><path d="${lib.glyphs?.[f.slice(6)] || ''}" fill="#D9DBE6" fill-rule="evenodd"/></svg></button>` : f.startsWith('device:') ? `<button class="tile" data-f="${f}" title="${f.slice(7)}">${ic('smartphone')}</button>` : `<button class="tile" data-f="${f}" title="${tr(SHAPES[f]?.name || f)}">${shapeSvg(f, '#D9DBE6')}</button>`;
  const draw = (p) => { const list = cat === 'letters' ? Object.keys(lib.glyphs || {}).map((g) => 'glyph:' + g) : cat === 'devices' ? DEVICE_FRAMES.map((d) => 'device:' + d) : FRAME_SHAPES; p.querySelector('.grid').innerHTML = list.map(tile).join(''); p.querySelectorAll('[data-f]').forEach((x) => (x.onclick = () => set((y) => (y.frame = x.dataset.f)))); };
  popover(b, `<div class="chips">${[['shapes', 'Shapes'], ['letters', 'Letters'], ['devices', 'Devices']].map(([k, l]) => `<button class="chip small ${k === cat ? 'on' : ''}" data-fc="${k}">${tr(l)}</button>`).join('')}</div><div class="grid g5"></div>` + range('Rounded corners', 'r', 0, 50, el.radius || 0), (p) => {
    draw(p);
    p.querySelectorAll('[data-fc]').forEach((c) => (c.onclick = () => { cat = c.dataset.fc; p.querySelectorAll('[data-fc]').forEach((z) => z.classList.toggle('on', z === c)); draw(p); }));
    wireRanges(p, (k, v, live) => set((x) => { x.radius = v; x.frame = 'rect'; }, live));
  }, { width: 320 });
}
function filtersPopover(b, el) {
  const f = el.filters || {};
  const presets = [['Original', {}], ['B&W', { grayscale: 100, contrast: 110 }], ['Warm', { sepia: 30, saturate: 120 }], ['Cool', { hue: 190, saturate: 80, sepia: 20 }], ['Vivid', { saturate: 150, contrast: 110 }], ['Faded', { contrast: 80, brightness: 110, saturate: 80 }], ['Dramatic', { contrast: 135, brightness: 90, saturate: 110 }], ['Soft', { blur: 1, brightness: 105 }]];
  popover(b, `<h4>${tr('Quick looks')}</h4><div class="chips">${presets.map(([n], i) => `<button class="chip" data-p="${i}">${tr(n)}</button>`).join('')}</div>`
    + range('Brightness', 'brightness', 30, 170, f.brightness ?? 100) + range('Contrast', 'contrast', 30, 170, f.contrast ?? 100) + range('Saturation', 'saturate', 0, 200, f.saturate ?? 100)
    + range('Black & white', 'grayscale', 0, 100, f.grayscale ?? 0) + range('Blur', 'blur', 0, 20, f.blur ?? 0), (p) => {
    wireRanges(p, (k, v, live) => set((x) => { x.filters = { ...(x.filters || {}), [k]: v }; }, live));
    p.querySelectorAll('[data-p]').forEach((c) => (c.onclick = () => { set((x) => (x.filters = { ...presets[c.dataset.p][1] })); filtersPopover(b, selected()[0]); }));
  });
}
function positionPopover(b) {
  const els = selected(), el = els[0];
  const one = els.length === 1;
  const inp = (k, v, label) => `<label class="pos-field"><span>${label}</span><input type="number" data-pos="${k}" value="${Math.round(v)}"></label>`;
  const all = curSlide().elements;
  const name = (e) => ({ text: (e.html || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 22) || tr('Text'), shape: tr(SHAPES[e.shape]?.name || 'Shape'), image: e.sticker ? tr('Sticker') : tr('Photo'), icon: tr('Icon'), sticker: tr('Sticker'), logo: tr('Logo'), line: tr('Line'), table: tr('Table'), chart: tr('Chart'), qr: tr('QR code'), draw: tr('Drawing'), svg: tr('Icon') }[e.type] || e.type);
  popover(b, `${one ? `<h4>${tr('Position & size')}</h4><div class="pos-grid">${inp('x', el.x, 'X')}${inp('y', el.y, 'Y')}${inp('w', el.w, tr('W'))}${inp('h', el.h, tr('H'))}${inp('rot', el.rot || 0, '°')}</div>` : ''}
    <h4>${tr('Order')}</h4><div class="grid g4">${[['top', 'bring-to-front', 'Bring to front'], ['up', 'arrow-up', 'Forward'], ['down', 'arrow-down', 'Backward'], ['bottom', 'send-to-back', 'Send to back']].map(([k, i, l]) => `<button class="cb" data-l="${k}" title="${tr(l)}">${ic(i)}</button>`).join('')}</div>
    <h4 style="margin-top:10px">${tr('Align on the slide')}</h4><div class="grid g6">
      ${[['left', 'align-start-vertical'], ['center', 'align-center-vertical'], ['right', 'align-end-vertical'], ['top', 'align-start-horizontal'], ['middle', 'align-center-horizontal'], ['bottom', 'align-end-horizontal']].map(([k, i]) => `<button class="cb" data-a="${k}" title="${k}">${ic(i)}</button>`).join('')}</div>
    <h4 style="margin-top:10px">${tr('Layers')}</h4><div class="layers">${[...all].reverse().map((e) => `<div class="layer ${state.sel.includes(e.id) ? 'on' : ''}" data-id="${e.id}"><span class="ic">${ic({ text: 'type', shape: 'shapes', image: 'image', icon: 'smile', sticker: 'sticker', logo: 'badge-check', line: 'minus', table: 'table', chart: 'chart-column', qr: 'qr-code', draw: 'pen-tool', svg: 'smile' }[e.type] || 'square')}</span><span class="nm">${esc(name(e))}</span><button data-eye="${e.id}" title="${tr(e.hidden ? 'Show' : 'Hide')}">${ic(e.hidden ? 'eye-off' : 'eye')}</button><button data-lk="${e.id}" title="${tr(e.locked ? 'Unlock' : 'Lock')}">${ic(e.locked ? 'lock' : 'lock-open')}</button></div>`).join('')}</div>`, (p) => {
    p.querySelectorAll('[data-l]').forEach((x) => (x.onclick = () => { layer(x.dataset.l); positionPopover(b); }));
    p.querySelectorAll('[data-a]').forEach((x) => (x.onclick = () => align(x.dataset.a)));
    p.querySelectorAll('[data-pos]').forEach((x) => (x.onchange = () => { const v = +x.value; if (!isFinite(v)) return; set((y) => { if (x.dataset.pos === 'w' && y.type === 'text') { y.w = Math.max(12, v); } else if (x.dataset.pos === 'w' || x.dataset.pos === 'h') { const k = x.dataset.pos; const old = y[k]; y[k] = Math.max(12, v); if (y.type === 'table' && k === 'h') y.rowH = y.rowH.map((r) => (r * y.h) / old); } else y[x.dataset.pos] = v; }); }));
    p.querySelectorAll('.layer').forEach((row) => (row.onclick = (ev) => {
      const id = row.dataset.id, e = all.find((x) => x.id === id);
      if (ev.target.closest('[data-eye]')) { e.hidden = !e.hidden; commit(); emit('canvas'); positionPopover(b); return; }
      if (ev.target.closest('[data-lk]')) { e.locked = !e.locked; commit(); emit('canvas'); positionPopover(b); return; }
      state.sel = [id]; emit('sel'); positionPopover(b);
    }));
  }, { width: 300 });
}
function dataPopover(b, el) {
  const draw = (p) => {
    const L = el.labels, S = el.series;
    p.querySelector('.data-grid').innerHTML = `<table class="data-table"><tr><th></th>${S.map((s, j) => `<th><input data-sn="${j}" value="${esc(s.name)}" placeholder="${tr('Series')}"><button data-rs="${j}" title="${tr('Remove')}" ${S.length < 2 ? 'disabled' : ''}>${ic('x')}</button></th>`).join('')}</tr>${L.map((l, i) => `<tr><th><input data-lb="${i}" value="${esc(l)}"></th>${S.map((s, j) => `<td><input type="number" step="any" data-v="${j},${i}" value="${s.values[i] ?? ''}"></td>`).join('')}<td><button data-rl="${i}" title="${tr('Remove')}" ${L.length < 2 ? 'disabled' : ''}>${ic('x')}</button></td></tr>`).join('')}</table>`;
    const upd = (fn) => { fn(); set(() => {}, true); };
    p.querySelectorAll('[data-sn]').forEach((x) => (x.oninput = () => upd(() => (S[+x.dataset.sn].name = x.value))));
    p.querySelectorAll('[data-lb]').forEach((x) => (x.oninput = () => upd(() => (L[+x.dataset.lb] = x.value))));
    p.querySelectorAll('[data-v]').forEach((x) => (x.oninput = () => upd(() => { const [j, i] = x.dataset.v.split(',').map(Number); S[j].values[i] = parseFloat(x.value) || 0; })));
    p.querySelectorAll('[data-rs]').forEach((x) => (x.onclick = () => { S.splice(+x.dataset.rs, 1); set(() => {}); draw(p); }));
    p.querySelectorAll('[data-rl]').forEach((x) => (x.onclick = () => { const i = +x.dataset.rl; L.splice(i, 1); S.forEach((s) => s.values.splice(i, 1)); set(() => {}); draw(p); }));
    p.querySelectorAll('input').forEach((x) => (x.onchange = () => { commit(); emit('canvas'); }));
  };
  popover(b, `<h4>${tr('Data')}</h4><div class="data-grid"></div><div class="chips" style="margin-top:8px"><button class="chip" data-addl>${ic('plus')} ${tr('Row')}</button><button class="chip" data-adds>${ic('plus')} ${tr('Series')}</button><button class="chip" data-pastex>${ic('clipboard-paste')} ${tr('Paste from Excel')}</button></div><textarea class="name-input hidden" id="pasteBox" placeholder="${tr('Paste cells copied from Excel or a CSV here')}" style="height:80px;margin-top:8px;padding:8px"></textarea>`, (p) => {
    draw(p);
    p.querySelector('[data-addl]').onclick = () => { el.labels.push(`${tr('Item')} ${el.labels.length + 1}`); el.series.forEach((s) => s.values.push(0)); set(() => {}); draw(p); };
    p.querySelector('[data-adds]').onclick = () => { el.series.push({ name: `${tr('Series')} ${el.series.length + 1}`, values: el.labels.map(() => 0) }); set(() => {}); draw(p); };
    const box = p.querySelector('#pasteBox');
    p.querySelector('[data-pastex]').onclick = () => { box.classList.toggle('hidden'); box.focus(); };
    box.onpaste = () => setTimeout(() => { const d = parseTable(box.value); if (d && d.labels.length) { el.labels = d.labels; el.series = d.series; set(() => {}); draw(p); box.value = ''; box.classList.add('hidden'); toast('Data pasted'); } }, 10);
  }, { width: 420 });
}

async function doRemoveBg(el, b) {
  if (el.placeholder) return;
  b.disabled = true; const old = b.innerHTML; b.innerHTML = ic('loader') + tr('Removing the background…');
  try {
    const out = await removeBackground(el.src);
    el.origSrc = el.src; el.src = out; patchNode(el); commit(); emit('canvas'); toast('Background removed');
  } catch (e) { console.error(e); toast('Could not remove the background'); b.innerHTML = old; b.disabled = false; }
}
// colours used in the design, for the colour picker
on((w) => { if (['all', 'slide', 'history'].includes(w) && state.doc) { const cs = new Set(); for (const s of state.doc.slides) { if (s.bg.type === 'color') cs.add(s.bg.value); for (const e of s.elements) for (const k of ['fill', 'color', 'stroke']) if (/^#[0-9a-f]{6}$/i.test(e[k] || '')) cs.add(e[k].toUpperCase()); } docColors.list = [...cs]; } });
