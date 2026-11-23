// Present mode + exports (PNG, JPG, PDF, PowerPoint, SVG) + .dkly files.
import { state, normalizeDoc } from './store.js';
import { slideNode, elementNode, miniSlide } from './render.js';
import { SHAPES } from './shapes.js';
import { toast } from './ui.js';
import { t as tr } from './i18n.js';
import { packDkly, unpackDkly, isDkly } from './dkly.js';
import { stepsOf, hideForClick, playIn, startLoop, playGroup, playOutAll, playTransition, slideTransition } from './anim.js';
import { plainCells } from './elements/table.js';
import { colorOf } from './elements/chart.js';
import { ends } from './elements/line.js';
import { plainText } from './sanitize.js';

const $ = (s) => document.querySelector(s);

// ---------- present ----------
// Each slide plays: its transition, then its automatic animations; every click shows the next "on click"
// element; leaving a slide plays the exit animations first.
let pi = 0, presenter = false, t0 = 0, timer = null, cur = null, clickIdx = 0, steps = null, scale = 1, busyT = null, black = false, typed = '';
const visible = () => state.doc.slides.map((s, i) => (s.hidden ? -1 : i)).filter((i) => i >= 0);
const nextVisible = (i, dir) => { const v = visible(); if (!v.length) return i; const k = v.indexOf(i); if (k < 0) return dir > 0 ? v.find((x) => x > i) ?? -1 : [...v].reverse().find((x) => x < i) ?? -1; return v[k + dir] ?? -1; };
export function present(from = 0, withPresenter = false) {
  pi = from; presenter = withPresenter; t0 = Date.now(); cur = null; black = false; typed = '';
  if (state.doc.slides[pi]?.hidden) { const n = nextVisible(pi, 1); pi = n >= 0 ? n : 0; }
  const p = $('#present'); p.classList.remove('hidden'); p.classList.remove('black');
  p.requestFullscreen?.().catch(() => {});
  showSlide(pi, { animate: true });
  window.addEventListener('keydown', pKey);
  window.addEventListener('resize', onResize);
  document.addEventListener('fullscreenchange', onFs);
  $('#pPrev').onclick = () => prev(); $('#pNext').onclick = () => next(); $('#pExit').onclick = exitP;
  $('#pPresenter').onclick = () => { presenter = !presenter; onResize(); updateHud(); };
  $('#presentStage').onclick = (e) => { if (!e.target.closest('a')) next(); };
  clearInterval(timer); timer = setInterval(tick, 1000); tick();
}
function tick() {
  const s = Math.floor((Date.now() - t0) / 1000);
  $('#pvTimer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  $('#pvClock').textContent = new Date().toLocaleTimeString(document.documentElement.lang === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
}
function layout() {
  const D = state.doc, st = $('#presentStage');
  const side = presenter ? 380 : 0;
  scale = Math.min((window.innerWidth - side) / D.w, window.innerHeight / D.h);
  st.style.width = D.w * scale + 'px'; st.style.height = D.h * scale + 'px';
  st.style.marginRight = side + 'px';
  return st;
}
function showSlide(i, { animate = false, built = false } = {}) {
  const D = state.doc, slide = D.slides[i], st = layout();
  const old = cur, oldSlide = old ? D.slides[+old.dataset.index] : null;
  const n = slideNode(slide, D); n.dataset.index = i;
  n.style.transform = `scale(${scale})`;
  steps = stepsOf(slide);
  clickIdx = built ? steps.clicks.length : 0;
  if (!built) hideForClick(n, slide);
  st.appendChild(n);
  cur = n; pi = i;
  let tdur = 0;
  if (animate && old) tdur = playTransition(old, n, slideTransition(slide), { accent: '#6C4CF5', oldSlide, newSlide: slide });
  if (old) setTimeout(() => old.remove(), tdur + 30);
  if (!old) st.querySelectorAll('.slide-render').forEach((x) => { if (x !== n) x.remove(); });
  if (animate) {
    const after = slideTransition(slide)?.type === 'morph' ? tdur : tdur * 0.6;
    for (const el of steps.auto) { const en = n.querySelector(`[data-id="${el.id}"]`); if (en) { const t = playIn(en, el, after); startLoop(en, el, t); } }
  } else for (const el of slide.elements) { const en = n.querySelector(`[data-id="${el.id}"]`); if (en) startLoop(en, el, 0); }
  updateHud();
}
function updateHud() {
  const D = state.doc;
  const left = steps.clicks.length - clickIdx;
  const v = visible(); $('#pCount').textContent = `${Math.max(1, v.indexOf(pi) + 1)} / ${v.length || D.slides.length}${left > 0 ? ' · ' + tr('{n} click(s) left', { n: left }) : ''}`;
  $('#presenter').classList.toggle('hidden', !presenter);
  $('#pPresenter').classList.toggle('on', presenter);
  $('#present').classList.toggle('pv', presenter);
  if (presenter) {
    const notes = (D.slides[pi].notes || '').trim();
    $('#pvNotes').textContent = notes || tr('No notes for this slide.');
    $('#pvNotes').classList.toggle('empty', !notes);
    const nx = $('#pvNext'); nx.innerHTML = '';
    if (left > 0) nx.innerHTML = `<div class="pv-end">${tr('Next click: {n} more element(s) on this slide', { n: left })}</div>`;
    else if (nextVisible(pi, 1) >= 0) nx.appendChild(miniSlide(D.slides[nextVisible(pi, 1)], D, 340));
    else nx.innerHTML = `<div class="pv-end">${tr('End of presentation')}</div>`;
  }
}
function next() {
  if (busyT) return; // an exit animation is playing
  if (clickIdx < steps.clicks.length) { playGroup(cur, steps.clicks[clickIdx]); clickIdx++; updateHud(); return; }
  const nx = nextVisible(pi, 1);
  if (nx < 0) { exitP(); return; }
  const outEnd = playOutAll(cur, state.doc.slides[pi]);
  if (outEnd) busyT = setTimeout(() => { busyT = null; showSlide(nx, { animate: true }); }, outEnd);
  else showSlide(nx, { animate: true });
}
function prev() { clearTimeout(busyT); busyT = null; const p = nextVisible(pi, -1); if (p >= 0) showSlide(p, { built: true }); }
function onResize() { layout(); $('#presentStage').querySelectorAll('.slide-render').forEach((n) => (n.style.transform = `scale(${scale})`)); }
function pKey(e) {
  if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(e.key)) { e.preventDefault(); next(); }
  if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prev(); }
  if (e.key === 'Home') showSlide(visible()[0] ?? 0, { animate: true }); if (e.key === 'End') showSlide(visible().at(-1) ?? state.doc.slides.length - 1, { built: true });
  if (e.key === 'Escape') exitP();
  if (e.key === 'p' || e.key === 'P') { presenter = !presenter; onResize(); updateHud(); }
  if (e.key === 'b' || e.key === 'B' || e.key === '.') { black = !black; $('#present').classList.toggle('black', black); }
  if (/^[0-9]$/.test(e.key)) typed += e.key;
  if (e.key === 'Enter') { if (typed) { const n = Math.min(state.doc.slides.length, Math.max(1, +typed)); typed = ''; showSlide(n - 1, { built: true }); } else next(); }
}
function onFs() { if (!document.fullscreenElement && !$('#present').classList.contains('hidden')) exitP(); }
function exitP() {
  $('#present').classList.add('hidden'); $('#present').classList.remove('black');
  clearInterval(timer); clearTimeout(busyT); busyT = null; cur = null;
  $('#presentStage').innerHTML = '';
  window.removeEventListener('keydown', pKey); window.removeEventListener('resize', onResize); document.removeEventListener('fullscreenchange', onFs);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  document.dispatchEvent(new Event('deckly-present-end'));
}

// ---------- rendering slides to images ----------
// custom fonts are loaded from the page's own @font-face (data: URLs survive in the picture)
async function fontsReady(node) {
  await document.fonts.ready;
  const fams = new Set([...node.querySelectorAll('[style*="font-family"]')].map((n) => n.style.fontFamily).filter(Boolean));
  await Promise.all([...fams].map((f) => document.fonts.load(`700 20px ${f}`).catch(() => {})));
}
export async function renderPng(slide, scale = 1, transparent = false, jpeg = 0) {
  const D = state.doc;
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-${D.w + 100}px;top:0;width:${D.w}px;height:${D.h}px;`;
  const n = slideNode(slide, D); if (transparent) n.style.background = 'transparent';
  host.appendChild(n); document.body.appendChild(host);
  await fontsReady(n);
  await Promise.all([...n.querySelectorAll('image')].map((im) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = im.getAttribute('href'); })));
  try {
    const o = { width: D.w, height: D.h, pixelRatio: scale, cacheBust: false };
    return jpeg ? await htmlToImage.toJpeg(n, { ...o, quality: jpeg, backgroundColor: '#FFFFFF' }) : await htmlToImage.toPng(n, o);
  } finally { host.remove(); }
}
const fname = (ext) => (state.doc.title || tr('presentation')).replace(/[\\/:*?"<>|]+/g, '').trim() + '.' + ext;
function download(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

export async function exportPng(transparent = false) {
  toast('Preparing image…');
  try { download(await renderPng(state.doc.slides[state.slide], 1, transparent), fname('png').replace('.png', ` - ${tr('slide')} ${state.slide + 1}.png`)); }
  catch (e) { console.error(e); toast('Could not create the image'); }
}
export async function exportPdf() { return exportPdfQ(1, 0.85); }

// PowerPoint: text, tables, charts, lines and plain shapes stay editable; every other element becomes a crisp picture at its exact place.
let pptxScale = 2;
const hex = (c, fb = '000000') => (/^#[0-9a-f]{6}$/i.test(c || '') ? c.slice(1).toUpperCase() : fb);
export async function exportPptx(scale = 2, asBase64 = false) {
  pptxScale = scale;
  const D = state.doc; if (!asBase64) toast('Preparing PowerPoint…');
  try {
    const pptx = new PptxGenJS();
    const inW = 13.333, inH = inW * D.h / D.w, k = inW / D.w;
    pptx.defineLayout({ name: 'DECK', width: inW, height: inH }); pptx.layout = 'DECK';
    pptx.title = D.title;
    const pt = (px) => px * k * 72; // font size in points
    for (const s of D.slides) {
      const ps = pptx.addSlide();
      if ((s.notes || '').trim()) ps.addNotes(s.notes);
      if (s.bg.type === 'color' && /^#[0-9a-f]{6}$/i.test(s.bg.value)) ps.background = { color: hex(s.bg.value) };
      else ps.background = { data: await renderPng({ bg: s.bg, elements: [] }, 0.5) };
      for (const el of s.elements) {
        if (el.hidden) continue;
        const box = { x: el.x * k, y: el.y * k, w: el.w * k, h: el.h * k, rotate: el.rot || 0 };
        const tr = Math.round((1 - (el.opacity ?? 1)) * 100);
        try {
          if (el.type === 'text') {
            let txt = plainText(el.html || ''); if (el.upper) txt = txt.toUpperCase();
            ps.addText(txt, { ...box, fontFace: el.font, fontSize: pt(el.size), color: hex(el.color), bold: !!el.bold, italic: !!el.italic, underline: el.underline ? { style: 'sng' } : undefined, strike: el.strike ? 'sngStrike' : undefined, align: el.align === 'justify' ? 'justify' : el.align || 'left', valign: 'top', margin: 0, lineSpacingMultiple: el.lineHeight || 1.2, charSpacing: (el.spacing || 0) / 100 * pt(el.size), transparency: tr, highlight: el.highlight ? hex(el.highlight, 'FFE066') : undefined });
          } else if (el.type === 'table') {
            const st = el.style, rows = plainCells(el);
            const data = rows.map((r, ri) => r.map((txt, ci) => {
              const cl = el.cells[ri][ci], header = st.header && ri === 0;
              const fill = cl.fill || (header ? st.headerFill : st.banded && ri % 2 === 0 ? st.bandFill : st.fill);
              const bw = st.borderWidth ? Math.max(0.5, st.borderWidth * k * 72 * 0.5) : 0;
              const line = { color: hex(st.borderColor, 'E6E7EF'), pt: bw };
              const none = { type: 'none' };
              const border = st.border === 'all' && bw ? line : st.border === 'horizontal' && bw ? [none, none, line, none] : st.border === 'outer' && bw ? [ri === 0 ? line : none, ci === el.cols - 1 ? line : none, ri === el.rows - 1 ? line : none, ci === 0 ? line : none] : none;
              return { text: txt, options: { fill: fill && fill !== 'transparent' ? { color: hex(fill, 'FFFFFF') } : undefined, color: hex(cl.color || (header ? st.headerColor : st.color), '1E1F2B'), bold: cl.bold ?? header, italic: !!cl.italic, align: cl.align || st.align || 'left', valign: 'middle', fontFace: st.font, fontSize: pt(cl.size || st.size || 32), margin: (st.pad || 16) * k * 72 * 0.5, border } };
            }));
            ps.addTable(data, { x: box.x, y: box.y, w: box.w, colW: el.colW.map((f) => f * box.w), rowH: el.rowH.map((h) => h * k), fontFace: st.font, autoPage: false });
          } else if (el.type === 'chart') {
            const type = { column: pptx.ChartType.bar, bar: pptx.ChartType.bar, line: pptx.ChartType.line, area: pptx.ChartType.area, pie: pptx.ChartType.pie, donut: pptx.ChartType.doughnut }[el.kind] || pptx.ChartType.bar;
            const data = el.series.map((sr) => ({ name: sr.name || '', labels: el.labels, values: sr.values.map((v) => +v || 0) }));
            const o = el.opts || {};
            const colors = (el.kind === 'pie' || el.kind === 'donut' ? el.labels : el.series).map((_, i) => hex(colorOf(el, i), '6C4CF5'));
            ps.addChart(type, data, { ...box, rotate: undefined, barDir: el.kind === 'bar' ? 'bar' : 'col', barGrouping: o.stacked ? 'stacked' : 'clustered', chartColors: colors, showValue: !!o.values, showLegend: o.legend && (el.series.length > 1 || el.kind === 'pie' || el.kind === 'donut'), legendPos: el.kind === 'pie' || el.kind === 'donut' ? 'r' : 't', holeSize: el.kind === 'donut' ? (o.hole || 55) : undefined, catAxisLabelFontSize: pt(o.size || 28) * 0.9, valAxisLabelFontSize: pt(o.size || 28) * 0.8, dataLabelFontSize: pt(o.size || 28) * 0.8, legendFontSize: pt(o.size || 28) * 0.9, catAxisLabelFontFace: o.font, valAxisLabelFontFace: o.font, dataLabelFontFace: o.font, legendFontFace: o.font, valGridLine: o.grid ? { color: 'E6E7EF', style: 'solid', size: 0.5 } : { style: 'none' }, catGridLine: { style: 'none' }, lineSize: el.kind === 'line' || el.kind === 'area' ? Math.max(1, (o.lineWidth || 8) * k * 72 * 0.5) : undefined, lineSmooth: !!o.smooth, lineDataSymbol: 'circle', dataLabelColor: el.kind === 'pie' || el.kind === 'donut' ? 'FFFFFF' : hex(o.color, '1E1F2B'), catAxisLabelColor: hex(o.color, '1E1F2B'), valAxisLabelColor: hex(o.color, '1E1F2B'), legendColor: hex(o.color, '1E1F2B'), dataLabelFormatCode: el.kind === 'pie' || el.kind === 'donut' ? '0%' : undefined, showPercent: el.kind === 'pie' || el.kind === 'donut' });
          } else if (el.type === 'line' && el.kind === 'straight' && !el.rot) {
            const e = ends(el);
            const arrow = (c) => ({ none: 'none', arrow: 'arrow', triangle: 'triangle', circle: 'oval', square: 'diamond', bar: 'stealth', diamond: 'diamond' }[c] || 'none');
            ps.addShape(pptx.ShapeType.line, { x: Math.min(e.x1, e.x2) * k, y: Math.min(e.y1, e.y2) * k, w: Math.abs(e.x2 - e.x1) * k, h: Math.abs(e.y2 - e.y1) * k, flipH: e.x2 < e.x1, flipV: e.y2 < e.y1, line: { color: hex(el.stroke, '1E1F2B'), width: Math.max(0.5, el.strokeWidth * k * 72 * 0.5), dashType: el.dash === 'dashed' ? 'dash' : el.dash === 'dotted' ? 'sysDot' : 'solid', beginArrowType: arrow(el.capStart), endArrowType: arrow(el.capEnd), transparency: tr } });
          } else if (el.type === 'shape' && ['rect', 'rounded', 'circle', 'process', 'connector', 'triangle', 'diamond', 'decision', 'hexagon', 'pentagon', 'octagon', 'pill', 'terminator', 'star5', 'heart', 'parallelogram', 'data', 'trapezoid'].includes(el.shape) && /^#[0-9a-f]{6}$/i.test(el.fill || '') && !el.gradient) {
            const st = { rect: 'rect', process: 'rect', rounded: 'roundRect', circle: 'ellipse', connector: 'ellipse', triangle: 'triangle', diamond: 'diamond', decision: 'diamond', hexagon: 'hexagon', pentagon: 'pentagon', octagon: 'octagon', pill: 'roundRect', terminator: 'roundRect', star5: 'star5', heart: 'heart', parallelogram: 'parallelogram', data: 'parallelogram', trapezoid: 'trapezoid' }[el.shape];
            const opts = { ...box, fill: { color: hex(el.fill), transparency: tr }, line: el.strokeWidth ? { color: hex(el.stroke), width: el.strokeWidth * k * 72 * 0.5 } : { type: 'none' }, rectRadius: el.shape === 'rounded' ? ((el.radius ?? 18) / 100) * Math.min(el.w, el.h) * k : el.shape === 'pill' || el.shape === 'terminator' ? Math.min(el.w, el.h) * k / 2 : undefined };
            if (el.text?.html) ps.addText(plainText(el.text.html), { ...opts, shape: pptx.ShapeType[st], fontFace: el.text.font, fontSize: pt(el.text.size || 32), color: hex(el.text.color, 'FFFFFF'), bold: !!el.text.bold, align: el.text.align || 'center', valign: 'middle' });
            else ps.addShape(pptx.ShapeType[st], opts);
          } else {
            const data = await elementPng(el);
            if (data) ps.addImage({ data, ...box });
          }
        } catch (err) { console.warn('pptx element', el.type, err); const data = await elementPng(el); if (data) ps.addImage({ data, ...box }); }
      }
    }
    if (asBase64) return await pptx.write({ outputType: 'base64' });
    await pptx.writeFile({ fileName: fname('pptx') }); toast('PowerPoint downloaded');
  } catch (e) { console.error(e); if (asBase64) throw e; toast('Could not create the PowerPoint file'); }
}
async function elementPng(el) {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-5000px;top:0;width:${el.w}px;height:${el.h}px`;
  const n = elementNode({ ...el, x: 0, y: 0, rot: 0 }); host.appendChild(n); document.body.appendChild(host);
  try { await fontsReady(n); return await htmlToImage.toPng(n, { width: el.w, height: el.h, pixelRatio: Math.max(2, pptxScale) }); } catch { return null; } finally { host.remove(); }
}

// ---------- .dkly files ----------
export async function saveFile(presentOnOpen = false) {
  toast('Preparing the Deckly file…');
  try {
    const info = window.decklyDesktop ? await window.decklyDesktop.info() : null;
    const blob = await packDkly(state.doc, { presentOnOpen, appVersion: info?.version || '' });
    const name = fname('dkly');
    if (window.decklyDesktop?.saveFile) {
      const where = await window.decklyDesktop.saveFile(name, new Uint8Array(await blob.arrayBuffer()));
      if (where) toast(tr('Saved: {name}', { name: where.split(/[\\/]/).pop() }));
      return;
    }
    const url = URL.createObjectURL(blob); download(url, name); setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast('Saved as a file');
  } catch (e) { console.error(e); toast('Could not create the Deckly file'); }
}
export async function readFile(fileOrBytes) {
  const buf = fileOrBytes instanceof ArrayBuffer ? fileOrBytes : fileOrBytes.buffer instanceof ArrayBuffer && !(fileOrBytes instanceof Blob) ? fileOrBytes.buffer.slice(fileOrBytes.byteOffset, fileOrBytes.byteOffset + fileOrBytes.byteLength) : await fileOrBytes.arrayBuffer();
  if (buf.byteLength > 600e6) throw new Error('too big');
  if (await isDkly(buf)) { const r = await unpackDkly(buf); normalizeDoc(r.doc); return r; }
  const j = JSON.parse(new TextDecoder().decode(buf)); // version 1.0 / 1.1 files
  const doc = j.doc || j; if (!doc.slides) throw new Error('not a Deckly file');
  return { doc: normalizeDoc(doc), manifest: {} };
}

// ---------- the Export window (formats, high resolution, which slides) ----------
const FORMATS = [
  ['dkly', 'sparkles', 'Deckly (.dkly)', 'Keeps animations, design and fonts. Opens in Deckly, even offline'],
  ['pptx', 'presentation', 'PowerPoint', 'Editable text, tables and charts; opens in PowerPoint'],
  ['pdf', 'file-text', 'PDF standard', 'Light file, for sharing on screen'],
  ['pdfprint', 'printer', 'PDF print', 'High quality, for printing'],
  ['png', 'image', 'PNG', 'Best for images with transparency and sharp text'],
  ['jpg', 'image', 'JPG', 'Smaller files, best for photos'],
  ['svg', 'pen-tool', 'SVG', 'Vector file, scales without blur'],
];
const QUALITIES = [[1, 'Standard'], [2, 'High resolution ×2'], [3, 'Very high ×3'], ['4k', '4K']];
let lastFmt = 'dkly';
export function downloadDialog(modal, closeModal, ic) {
  const D = state.doc;
  let fmt = lastFmt, q = 2, pages = 'all', transparent = false, jq = 92, showOnOpen = false;
  const dims = (k) => { const s = k === '4k' ? 3840 / Math.max(D.w, D.h) : k; return `${Math.round(D.w * s)} × ${Math.round(D.h * s)} px`; };
  const draw = () => {
    modal(`<h3>${ic('download')} ${tr('Export')}</h3>
      <div class="dl-sec">File type</div>
      <div class="dl-formats">${FORMATS.map(([k, i, n, d]) => `<button class="dl-fmt ${k === fmt ? 'on' : ''} ${k === 'dkly' ? 'wide' : ''}" data-fmt="${k}">${ic(i)}<b>${n}${k === 'dkly' ? ` <em class="rec">${tr('Recommended')}</em>` : ''}</b><small>${d}</small></button>`).join('')}</div>
      ${['png', 'jpg', 'pdfprint', 'pptx'].includes(fmt) ? `<div class="dl-sec">Size</div><div class="chips">${QUALITIES.map(([k, n]) => `<button class="chip ${k === q ? 'on' : ''}" data-q="${k}">${n}</button>`).join('')}</div><p class="hint">${dims(q)}</p>` : ''}
      ${fmt === 'dkly' ? `<div class="dl-sec">${tr('Deckly file')}</div><p class="hint" style="font-size:13px">${tr('One file with everything inside: slides, animations, transitions, photos and fonts. Send it, open it on another computer with Deckly, and present — even without internet.')}</p><div class="toggle-row"><span>${tr('Open straight in Present mode')}</span><button class="switch ${showOnOpen ? 'on' : ''}" id="dlShow"></button></div>` : ''}
      ${fmt === 'png' ? `<div class="toggle-row"><span>Transparent background</span><button class="switch ${transparent ? 'on' : ''}" id="dlTr"></button></div>` : ''}
      ${fmt === 'jpg' ? `<div class="range-row"><label>Quality</label><input type="range" id="dlJq" min="50" max="100" value="${jq}"><span class="v">${jq}%</span></div>` : ''}
      ${['png', 'jpg', 'svg'].includes(fmt) ? `<div class="dl-sec">Slides</div><div class="chips"><button class="chip ${pages === 'cur' ? 'on' : ''}" data-p="cur">${tr('This slide ({n})', { n: state.slide + 1 })}</button><button class="chip ${pages === 'all' ? 'on' : ''}" data-p="all">${tr('All slides ({n})', { n: D.slides.length })}</button></div>${pages === 'all' && D.slides.length > 1 ? '<p class="hint">Several slides are downloaded together in one .zip file.</p>' : ''}` : ''}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="dlGo">${ic('download')} ${tr('Export')}</button></div>`, { width: 600 });
    const c = document.querySelector('#modalCard');
    c.querySelectorAll('[data-fmt]').forEach((b) => (b.onclick = () => { fmt = b.dataset.fmt; lastFmt = fmt; if (fmt === 'pdfprint' && q === 1) q = 2; draw(); }));
    c.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { q = b.dataset.q === '4k' ? '4k' : +b.dataset.q; draw(); }));
    c.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { pages = b.dataset.p; draw(); }));
    c.querySelector('#dlTr')?.addEventListener('click', () => { transparent = !transparent; draw(); });
    c.querySelector('#dlShow')?.addEventListener('click', () => { showOnOpen = !showOnOpen; draw(); });
    const r = c.querySelector('#dlJq'); if (r) r.oninput = () => { jq = +r.value; r.nextElementSibling.textContent = jq + '%'; };
    c.querySelector('#dlGo').onclick = () => { closeModal(); fmt === 'dkly' ? saveFile(showOnOpen) : runDownload(fmt, q === '4k' ? 3840 / Math.max(D.w, D.h) : q, pages, transparent, jq / 100); };
  };
  draw();
}
async function runDownload(fmt, scale, pages, transparent, jq) {
  const D = state.doc;
  if (fmt === 'pdf') return exportPdfQ(1, 0.85);
  if (fmt === 'pdfprint') return exportPdfQ(Math.min(scale, 2), 0.95);
  if (fmt === 'pptx') return exportPptx(scale);
  const idx = pages === 'cur' ? [state.slide] : D.slides.map((_, i) => i);
  const ext = fmt === 'jpg' ? 'jpg' : fmt;
  toast(idx.length > 1 ? tr('Preparing {n} images…', { n: idx.length }) : 'Preparing image…');
  try {
    const files = [];
    for (const i of idx) {
      const url = fmt === 'svg' ? await renderSvg(D.slides[i]) : await renderPng(D.slides[i], scale, transparent && fmt === 'png', fmt === 'jpg' ? jq : 0);
      files.push([`${fname(ext).replace('.' + ext, '')} - ${tr('slide')} ${i + 1}.${ext}`, url]);
    }
    if (files.length === 1) { download(files[0][1], files[0][0]); toast('Downloaded'); return; }
    const zip = new JSZip();
    for (const [n, url] of files) {
      if (url.startsWith('data:image/svg')) zip.file(n, decodeURIComponent(url.slice(url.indexOf(',') + 1)));
      else zip.file(n, url.slice(url.indexOf(',') + 1), { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const u = URL.createObjectURL(blob); download(u, fname('zip')); setTimeout(() => URL.revokeObjectURL(u), 3000);
    toast('Downloaded');
  } catch (e) { console.error(e); toast('Could not create the image'); }
}
async function exportPdfQ(scale, jpegQ) {
  const D = state.doc; toast('Preparing PDF…');
  try {
    const pdf = new jspdf.jsPDF({ orientation: D.w >= D.h ? 'landscape' : 'portrait', unit: 'px', format: [D.w, D.h], hotfixes: ['px_scaling'], compress: true });
    for (let i = 0; i < D.slides.length; i++) {
      if (i) pdf.addPage([D.w, D.h], D.w >= D.h ? 'landscape' : 'portrait');
      const img = await renderPng(D.slides[i], scale, false, jpegQ);
      pdf.addImage(img, jpegQ ? 'JPEG' : 'PNG', 0, 0, D.w, D.h, undefined, jpegQ ? 'MEDIUM' : 'SLOW');
    }
    pdf.save(fname('pdf')); toast('PDF downloaded');
  } catch (e) { console.error(e); toast('Could not create the PDF'); }
}
async function renderSvg(slide) {
  const D = state.doc;
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-${D.w + 100}px;top:0;width:${D.w}px;height:${D.h}px;`;
  const n = slideNode(slide, D); host.appendChild(n); document.body.appendChild(host);
  await fontsReady(n);
  try { return await htmlToImage.toSvg(n, { width: D.w, height: D.h }); } finally { host.remove(); }
}
