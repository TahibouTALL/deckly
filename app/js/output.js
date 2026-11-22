// Present mode + downloads (PNG, PDF, PowerPoint) + .deckly files.
import { state } from './store.js';
import { slideNode, elementNode, miniSlide } from './render.js';
import { SHAPES } from './assets.js';
import { toast } from './ui.js';
import { t as tr } from './i18n.js';
import { packDkly, unpackDkly, isDkly } from './dkly.js';
import { stepsOf, hideForClick, playIn, startLoop, playGroup, playOutAll, playTransition, slideTransition } from './anim.js';

const $ = (s) => document.querySelector(s);

// ---------- present ----------
// Each slide plays: its transition, then its automatic animations; every click shows the next "on click"
// element; leaving a slide plays the exit animations first.
let pi = 0, presenter = false, t0 = 0, timer = null, cur = null, clickIdx = 0, steps = null, scale = 1, busyT = null;
export function present(from = 0, withPresenter = false) {
  pi = from; presenter = withPresenter; t0 = Date.now(); cur = null;
  const p = $('#present'); p.classList.remove('hidden');
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
// built: show everything at once (going back, resizing) / animate: play transition + animations
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
  $('#pCount').textContent = `${pi + 1} / ${D.slides.length}${left > 0 ? ' · ' + tr('{n} click(s) left', { n: left }) : ''}`;
  $('#presenter').classList.toggle('hidden', !presenter);
  $('#pPresenter').classList.toggle('on', presenter);
  $('#present').classList.toggle('pv', presenter);
  if (presenter) {
    const notes = (D.slides[pi].notes || '').trim();
    $('#pvNotes').textContent = notes || tr('No notes for this slide.');
    $('#pvNotes').classList.toggle('empty', !notes);
    const nx = $('#pvNext'); nx.innerHTML = '';
    if (left > 0) nx.innerHTML = `<div class="pv-end">${tr('Next click: {n} more element(s) on this slide', { n: left })}</div>`;
    else if (pi + 1 < D.slides.length) nx.appendChild(miniSlide(D.slides[pi + 1], D, 340));
    else nx.innerHTML = `<div class="pv-end">${tr('End of presentation')}</div>`;
  }
}
function next() {
  if (busyT) return; // an exit animation is playing
  if (clickIdx < steps.clicks.length) { playGroup(cur, steps.clicks[clickIdx]); clickIdx++; updateHud(); return; }
  if (pi + 1 >= state.doc.slides.length) { exitP(); return; }
  const outEnd = playOutAll(cur, state.doc.slides[pi]);
  if (outEnd) busyT = setTimeout(() => { busyT = null; showSlide(pi + 1, { animate: true }); }, outEnd);
  else showSlide(pi + 1, { animate: true });
}
function prev() { clearTimeout(busyT); busyT = null; if (pi > 0) showSlide(pi - 1, { built: true }); }
// resizing (or entering full screen) only rescales what is on screen: running animations keep going
function onResize() { layout(); $('#presentStage').querySelectorAll('.slide-render').forEach((n) => (n.style.transform = `scale(${scale})`)); }
function pKey(e) {
  if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); next(); }
  if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prev(); }
  if (e.key === 'Home') showSlide(0, { animate: true }); if (e.key === 'End') showSlide(state.doc.slides.length - 1, { built: true });
  if (e.key === 'Escape') exitP();
  if (e.key === 'p' || e.key === 'P') { presenter = !presenter; onResize(); updateHud(); }
}
function onFs() { if (!document.fullscreenElement && !$('#present').classList.contains('hidden')) exitP(); }
function exitP() {
  $('#present').classList.add('hidden');
  clearInterval(timer); clearTimeout(busyT); busyT = null; cur = null;
  $('#presentStage').innerHTML = '';
  window.removeEventListener('keydown', pKey); window.removeEventListener('resize', onResize); document.removeEventListener('fullscreenchange', onFs);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  document.dispatchEvent(new Event('deckly-present-end'));
}

// ---------- rendering slides to images ----------
async function renderPng(slide, scale = 1, transparent = false, jpeg = 0) {
  const D = state.doc;
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-${D.w + 100}px;top:0;width:${D.w}px;height:${D.h}px;`;
  const n = slideNode(slide, D); if (transparent) n.style.background = 'transparent';
  host.appendChild(n); document.body.appendChild(host);
  await document.fonts.ready;
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
export async function exportPdf() {
  const D = state.doc; toast('Preparing PDF…');
  try {
    const pdf = new jspdf.jsPDF({ orientation: D.w >= D.h ? 'landscape' : 'portrait', unit: 'px', format: [D.w, D.h], hotfixes: ['px_scaling'] });
    for (let i = 0; i < D.slides.length; i++) {
      if (i) pdf.addPage([D.w, D.h], D.w >= D.h ? 'landscape' : 'portrait');
      pdf.addImage(await renderPng(D.slides[i], 1), 'PNG', 0, 0, D.w, D.h, undefined, 'FAST');
    }
    pdf.save(fname('pdf')); toast('PDF downloaded');
  } catch (e) { console.error(e); toast('Could not create the PDF'); }
}

// PowerPoint: text stays editable, every other element becomes a crisp picture at its exact place.
let pptxScale = 2;
export async function exportPptx(scale = 2) {
  pptxScale = scale;
  const D = state.doc; toast('Preparing PowerPoint…');
  try {
    const pptx = new PptxGenJS();
    const inW = 13.333, inH = inW * D.h / D.w, k = inW / D.w;
    pptx.defineLayout({ name: 'DECK', width: inW, height: inH }); pptx.layout = 'DECK';
    pptx.title = D.title;
    for (const s of D.slides) {
      const ps = pptx.addSlide();
      if ((s.notes || '').trim()) ps.addNotes(s.notes);
      if (s.bg.type === 'color') ps.background = { color: s.bg.value.replace('#', '') };
      else ps.background = { data: await renderPng({ bg: s.bg, elements: [] }, 0.5) };
      for (const el of s.elements) {
        if (el.hidden) continue;
        const box = { x: el.x * k, y: el.y * k, w: el.w * k, h: el.h * k, rotate: el.rot || 0 };
        if (el.type === 'text') {
          const tmp = document.createElement('div'); tmp.innerHTML = (el.html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/div>\s*<div>/gi, '\n');
          let txt = tmp.textContent; if (el.upper) txt = txt.toUpperCase();
          ps.addText(txt, { ...box, fontFace: el.font, fontSize: el.size * k * 72, color: (el.color || '#000').replace('#', ''), bold: !!el.bold, italic: !!el.italic, underline: el.underline ? { style: 'sng' } : undefined, align: el.align === 'justify' ? 'justify' : el.align || 'left', valign: 'top', margin: 0, lineSpacingMultiple: el.lineHeight || 1.2, charSpacing: (el.spacing || 0) / 100 * el.size * k * 72, transparency: Math.round((1 - (el.opacity ?? 1)) * 100), highlight: el.highlight ? el.highlight.replace('#', '') : undefined });
        } else if (el.type === 'shape' && !SHAPES[el.shape]?.line && ['rect', 'rounded', 'circle'].includes(el.shape) && /^#/.test(el.fill || '')) {
          ps.addShape(el.shape === 'circle' ? pptx.ShapeType.ellipse : el.shape === 'rounded' ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, { ...box, fill: { color: el.fill.replace('#', ''), transparency: Math.round((1 - (el.opacity ?? 1)) * 100) }, line: el.strokeWidth ? { color: (el.stroke || '#000').replace('#', ''), width: el.strokeWidth * k * 72 } : { type: 'none' }, rectRadius: el.shape === 'rounded' ? ((el.radius ?? 18) / 100) : undefined });
        } else {
          const data = await elementPng(el);
          if (data) ps.addImage({ data, ...box });
        }
      }
    }
    await pptx.writeFile({ fileName: fname('pptx') }); toast('PowerPoint downloaded');
  } catch (e) { console.error(e); toast('Could not create the PowerPoint file'); }
}
async function elementPng(el) {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-5000px;top:0;width:${el.w}px;height:${el.h}px`;
  const n = elementNode({ ...el, x: 0, y: 0, rot: 0 }); host.appendChild(n); document.body.appendChild(host);
  try { return await htmlToImage.toPng(n, { width: el.w, height: el.h, pixelRatio: Math.max(2, pptxScale) }); } catch { return null; } finally { host.remove(); }
}

// ---------- .deckly files ----------
// Saves the design as one .dkly file (design, animations, photos, fonts). In the desktop app: Windows' own "Save as" window.
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
// Opens a .dkly file (or an old .deckly one). Returns { doc, manifest }.
export async function readFile(fileOrBytes) {
  const buf = fileOrBytes instanceof ArrayBuffer ? fileOrBytes : fileOrBytes.buffer instanceof ArrayBuffer && !(fileOrBytes instanceof Blob) ? fileOrBytes.buffer.slice(fileOrBytes.byteOffset, fileOrBytes.byteOffset + fileOrBytes.byteLength) : await fileOrBytes.arrayBuffer();
  if (await isDkly(buf)) return unpackDkly(buf);
  const j = JSON.parse(new TextDecoder().decode(buf)); // version 1.0 / 1.1 files
  const doc = j.doc || j; if (!doc.slides) throw new Error('not a Deckly file');
  return { doc, manifest: {} };
}

// ---------- the Download window (formats, high resolution, which slides) ----------
const FORMATS = [
  ['dkly', 'sparkles', 'Deckly (.dkly)', 'Keeps animations, design and fonts. Opens in Deckly, even offline'],
  ['png', 'image', 'PNG', 'Best for images with transparency and sharp text'],
  ['jpg', 'image', 'JPG', 'Smaller files, best for photos'],
  ['pdf', 'file-text', 'PDF standard', 'Light file, for sharing on screen'],
  ['pdfprint', 'printer', 'PDF print', 'High quality, for printing'],
  ['pptx', 'presentation', 'PowerPoint', 'Editable text, opens in PowerPoint'],
  ['svg', 'pen-tool', 'SVG', 'Vector file, scales without blur'],
];
const QUALITIES = [[1, 'Standard'], [2, 'High resolution ×2'], [3, 'Very high ×3'], ['4k', '4K']];
export function downloadDialog(modal, closeModal, ic) {
  const D = state.doc;
  let fmt = 'dkly', q = 2, pages = 'all', transparent = false, jq = 92, showOnOpen = false;
  const dims = (k) => { const s = k === '4k' ? 3840 / Math.max(D.w, D.h) : k; return `${Math.round(D.w * s)} × ${Math.round(D.h * s)} px`; };
  const draw = () => {
    modal(`<h3>${ic('download')} Download</h3>
      <div class="dl-sec">File type</div>
      <div class="dl-formats">${FORMATS.map(([k, i, n, d]) => `<button class="dl-fmt ${k === fmt ? 'on' : ''}" data-fmt="${k}">${ic(i)}<b>${n}</b><small>${d}</small></button>`).join('')}</div>
      ${['png', 'jpg', 'pdfprint', 'pptx'].includes(fmt) ? `<div class="dl-sec">Size</div><div class="chips">${QUALITIES.map(([k, n]) => `<button class="chip ${k === q ? 'on' : ''}" data-q="${k}">${n}</button>`).join('')}</div><p class="hint">${dims(q)}</p>` : ''}
      ${fmt === 'dkly' ? `<div class="dl-sec">${tr('Deckly file')}</div><p class="hint" style="font-size:13px">${tr('One file with everything inside: slides, animations, transitions, photos and fonts. Send it, open it on another computer with Deckly, and present — even without internet.')}</p><div class="toggle-row"><span>${tr('Open straight in Present mode')}</span><button class="switch ${showOnOpen ? 'on' : ''}" id="dlShow"></button></div>` : ''}
      ${fmt === 'png' ? `<div class="toggle-row"><span>Transparent background</span><button class="switch ${transparent ? 'on' : ''}" id="dlTr"></button></div>` : ''}
      ${fmt === 'jpg' ? `<div class="range-row"><label>Quality</label><input type="range" id="dlJq" min="50" max="100" value="${jq}"><span class="v">${jq}%</span></div>` : ''}
      ${['png', 'jpg', 'svg'].includes(fmt) ? `<div class="dl-sec">Slides</div><div class="chips"><button class="chip ${pages === 'cur' ? 'on' : ''}" data-p="cur">${tr('This slide ({n})', { n: state.slide + 1 })}</button><button class="chip ${pages === 'all' ? 'on' : ''}" data-p="all">${tr('All slides ({n})', { n: D.slides.length })}</button></div>${pages === 'all' && D.slides.length > 1 ? '<p class="hint">Several slides are downloaded together in one .zip file.</p>' : ''}` : ''}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="dlGo">${ic('download')} Download</button></div>`);
    const c = document.querySelector('#modalCard');
    c.querySelectorAll('[data-fmt]').forEach((b) => (b.onclick = () => { fmt = b.dataset.fmt; if (fmt === 'pdfprint' && q === 1) q = 2; draw(); }));
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
  if (fmt === 'pdfprint') return exportPdfQ(scale, 0);
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
  await document.fonts.ready;
  try { return await htmlToImage.toSvg(n, { width: D.w, height: D.h }); } finally { host.remove(); }
}
