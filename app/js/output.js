// Present mode + downloads (PNG, PDF, PowerPoint) + .deckly files.
import { state } from './store.js';
import { slideNode, elementNode } from './render.js';
import { SHAPES } from './assets.js';
import { toast } from './ui.js';
import { t as tr } from './i18n.js';

const $ = (s) => document.querySelector(s);

// ---------- present ----------
let pi = 0;
export function present(from = 0) {
  pi = from;
  const p = $('#present'); p.classList.remove('hidden');
  p.requestFullscreen?.().catch(() => {});
  showP();
  window.addEventListener('keydown', pKey);
  window.addEventListener('resize', showP);
  document.addEventListener('fullscreenchange', onFs);
  $('#pPrev').onclick = () => step(-1); $('#pNext').onclick = () => step(1); $('#pExit').onclick = exitP;
  $('#presentStage').onclick = (e) => { if (!e.target.closest('a')) step(1); };
}
function showP() {
  const D = state.doc, st = $('#presentStage');
  const s = Math.min(window.innerWidth / D.w, window.innerHeight / D.h);
  st.style.width = D.w * s + 'px'; st.style.height = D.h * s + 'px';
  const n = slideNode(D.slides[pi], D); n.style.transform = `scale(${s})`;
  st.innerHTML = ''; st.appendChild(n);
  $('#pCount').textContent = `${pi + 1} / ${D.slides.length}`;
}
function step(d) { const n = pi + d; if (n < 0) return; if (n >= state.doc.slides.length) { exitP(); return; } pi = n; showP(); }
function pKey(e) {
  if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); step(1); }
  if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); step(-1); }
  if (e.key === 'Home') { pi = 0; showP(); } if (e.key === 'End') { pi = state.doc.slides.length - 1; showP(); }
  if (e.key === 'Escape') exitP();
}
function onFs() { if (!document.fullscreenElement && !$('#present').classList.contains('hidden')) exitP(); }
function exitP() {
  $('#present').classList.add('hidden');
  window.removeEventListener('keydown', pKey); window.removeEventListener('resize', showP); document.removeEventListener('fullscreenchange', onFs);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

// ---------- rendering slides to images ----------
async function renderPng(slide, scale = 1) {
  const D = state.doc;
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-${D.w + 100}px;top:0;width:${D.w}px;height:${D.h}px;`;
  const n = slideNode(slide, D); host.appendChild(n); document.body.appendChild(host);
  await document.fonts.ready;
  await Promise.all([...n.querySelectorAll('image')].map((im) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = im.getAttribute('href'); })));
  try { return await htmlToImage.toPng(n, { width: D.w, height: D.h, pixelRatio: scale, cacheBust: false }); }
  finally { host.remove(); }
}
const fname = (ext) => (state.doc.title || tr('presentation')).replace(/[\\/:*?"<>|]+/g, '').trim() + '.' + ext;
function download(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

export async function exportPng() {
  toast('Preparing image…');
  try { download(await renderPng(state.doc.slides[state.slide], 1), fname('png').replace('.png', ` - ${tr('slide')} ${state.slide + 1}.png`)); }
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
export async function exportPptx() {
  const D = state.doc; toast('Preparing PowerPoint…');
  try {
    const pptx = new PptxGenJS();
    const inW = 13.333, inH = inW * D.h / D.w, k = inW / D.w;
    pptx.defineLayout({ name: 'DECK', width: inW, height: inH }); pptx.layout = 'DECK';
    pptx.title = D.title;
    for (const s of D.slides) {
      const ps = pptx.addSlide();
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
  try { return await htmlToImage.toPng(n, { width: el.w, height: el.h, pixelRatio: 2 }); } catch { return null; } finally { host.remove(); }
}

// ---------- .deckly files ----------
export function saveFile() {
  const blob = new Blob([JSON.stringify({ app: 'deckly', v: 1, doc: state.doc })], { type: 'application/json' });
  const url = URL.createObjectURL(blob); download(url, fname('deckly')); setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Saved as a file');
}
export async function readFile(file) {
  const j = JSON.parse(await file.text());
  const doc = j.doc || j; if (!doc.slides) throw new Error('not a Deckly file');
  return doc;
}
