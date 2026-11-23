// Deckly for Claude: the tools Claude Desktop / Claude Code can call through the desktop app's MCP server
// (desktop/mcp.cjs), and the window that sets the connection up. Deckly itself calls no online service:
// Claude drives Deckly, through the member's own Claude app.
import { state, emit, newDoc, newSlide, saveDoc, loadDoc, listDocs, deleteDoc, uid, clone, normalizeDoc, commit } from './store.js';
import { packs, photoBy, photoUrl, ic } from './assets.js';
import { TEMPLATES } from './templates.js';
import { lib, searchPackNames, loadNames, loadPack, sticker3dUrl, DEFAULT_PACKS, packInfo } from './library.js';
import { tableDefaults } from './elements/table.js';
import { chartDefaults } from './elements/chart.js';
import { qrDefaults } from './elements/qr.js';
import { makeLine } from './elements/line.js';
import { renderPng, exportPptx } from './output.js';
import { packDkly } from './dkly.js';
import { sanitizeHtml, escapeHtml } from './sanitize.js';
import { modal, closeModal, toast } from './ui.js';
import { t as tr } from './i18n.js';

let hooks = {};
export function initConnector(h) {
  hooks = h;
  const d = window.decklyDesktop;
  document.querySelectorAll('.desktop-only').forEach((n) => n.classList.toggle('hidden', !d));
  document.addEventListener('deckly-claude', openDialog);
  if (!d?.connector) return;
  d.connector.onCall(async (call) => {
    let result;
    try { result = { ok: true, value: await runTool(call.tool, call.args || {}) }; }
    catch (e) { result = { ok: false, error: String(e?.message || e) }; }
    d.connector.reply(call.id, result);
  });
}

// ---------- the setup window ----------
async function openDialog() {
  const d = window.decklyDesktop;
  if (!d?.connector) {
    modal(`<h3>${ic('plug-zap')} ${tr('Connect Claude to Deckly')}</h3><p>${tr('This works in the Deckly desktop app: Claude Desktop or Claude Code talk to Deckly on your computer and create or edit your presentations for you.')}</p><p class="hint">${tr('Install Deckly for Windows, then open File → Connect Claude.')}</p><div style="text-align:right"><button class="btn primary" data-close>${tr('Close')}</button></div>`);
    return;
  }
  const info = await d.connector.info();
  const draw = (info) => {
    modal(`<h3>${ic('plug-zap')} ${tr('Connect Claude to Deckly')}</h3>
      <div class="claude-box">${ic('sparkles')}<div><b>${tr('Claude becomes your assistant inside Deckly.')}</b><br><small>${tr('Ask it “make me a 10-slide presentation about…”: it builds the slides here, with your templates, photos, tables and charts, then you polish them. Deckly sends nothing online by itself — it is your Claude app that talks to Deckly, on this computer.')}</small></div></div>
      <div class="claude-steps">
        <div><div><b>${tr('Claude Desktop')}</b><br>${info.claudeDesktop ? (info.installed ? `<span style="color:var(--ok);font-weight:600">${tr('Connected.')}</span> ${tr('Restart Claude Desktop once, then ask it: “Create a presentation in Deckly about…”.')}` : tr('Click Connect: Deckly adds itself to Claude Desktop’s connectors (one line in its settings file). Then restart Claude Desktop.')) : tr('Claude Desktop is not installed on this computer (claude.ai/download). Once it is, come back here and click Connect.')}<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">${info.claudeDesktop && !info.installed ? `<button class="btn primary sm" id="ccInstall">${ic('plug-zap')} ${tr('Connect')}</button>` : ''}${info.installed ? `<button class="btn ghost sm" id="ccRemove">${tr('Disconnect')}</button>` : ''}</div></div></div>
        <div><div><b>${tr('Claude Code')}</b><br>${tr('Run this once in a terminal:')}<div class="code-line" style="margin-top:6px"><span id="ccCmd">${escapeHtml(info.codeCommand)}</span><button class="cb" id="ccCopy" title="${tr('Copy')}">${ic('copy')}</button></div></div></div>
        <div><div><b>${tr('Try it')}</b><br>${tr('“Make a 6-slide presentation in Deckly about our quarterly results, with a chart and a table.” Claude builds it; it appears in Your designs and opens here.')}</div></div>
      </div>
      <p class="hint">${tr('Claude can: list, create and edit presentations, add slides (title, bullets, two columns, image, quote, table, chart, statistics…), use your templates and the built-in photos, stickers and icons, export to PowerPoint or PDF, and look at a slide to check its work. It cannot read anything else on your computer through Deckly.')}</p>
      <div style="text-align:right;margin-top:8px"><button class="btn primary" data-close>${tr('Close')}</button></div>`, { width: 640 });
    const card = document.querySelector('#modalCard');
    card.querySelector('#ccCopy').onclick = () => { navigator.clipboard?.writeText(info.codeCommand); toast('Copied'); };
    card.querySelector('#ccInstall')?.addEventListener('click', async () => { const r = await d.connector.install(true); if (r.ok) { toast('Deckly is now a Claude Desktop connector — restart Claude Desktop'); draw(await d.connector.info()); } else toast(tr('Could not write Claude Desktop’s settings: {e}', { e: r.error })); });
    card.querySelector('#ccRemove')?.addEventListener('click', async () => { const r = await d.connector.install(false); if (r.ok) { toast('Disconnected'); draw(await d.connector.info()); } });
  };
  draw(info);
}

// ---------- tools ----------
const THEMES = {
  deckly: { bg: '#FFFFFF', text: '#1E1F2B', muted: '#5B5E73', accent: '#6C4CF5', accent2: '#FF6B8B', soft: '#F4F1FF', font: 'Inter', heading: 'Poppins', dark: '#0F1B3D' },
  night: { bg: '#0F1B3D', text: '#FFFFFF', muted: '#C9CCDD', accent: '#8D74FF', accent2: '#FF6B8B', soft: '#1C2A55', font: 'Inter', heading: 'Poppins', dark: '#070D22' },
  minimal: { bg: '#FFFFFF', text: '#111111', muted: '#666666', accent: '#111111', accent2: '#999999', soft: '#F3F3F3', font: 'Inter', heading: 'DM Serif Display', dark: '#111111' },
  warm: { bg: '#FFF8F0', text: '#2B1D14', muted: '#7A5C48', accent: '#E8632B', accent2: '#FFC83D', soft: '#FFE9D6', font: 'Nunito', heading: 'Poppins', dark: '#2B1D14' },
  forest: { bg: '#F3FBF7', text: '#0E3B2E', muted: '#3F6B5B', accent: '#127A4C', accent2: '#2EC27E', soft: '#CFF5E2', font: 'Inter', heading: 'Montserrat', dark: '#0E3B2E' },
  ocean: { bg: '#F4F8FF', text: '#0B1F4D', muted: '#4A5B8A', accent: '#1C4FA8', accent2: '#1FB5A6', soft: '#D4E5FF', font: 'Inter', heading: 'Poppins', dark: '#0B1F4D' },
};
const docSummary = (d) => ({ id: d.id, title: d.title, width: d.w, height: d.h, slides: d.slides.length, updated: new Date(d.updated).toISOString() });
const slideSummary = (s, i) => ({ index: i, id: s.id, hidden: !!s.hidden, notes: s.notes || '', background: s.bg, elements: s.elements.map((e) => ({ id: e.id, type: e.type, x: Math.round(e.x), y: Math.round(e.y), w: Math.round(e.w), h: Math.round(e.h), text: e.type === 'text' ? plain(e.html) : e.type === 'shape' && e.text ? plain(e.text.html) : undefined, rows: e.type === 'table' ? e.cells.map((r) => r.map((c) => plain(c.h))) : undefined, chart: e.type === 'chart' ? { kind: e.kind, labels: e.labels, series: e.series } : undefined, src: e.type === 'image' ? (e.src || '').slice(0, 60) : undefined })) });
const plain = (h) => { const d = document.createElement('div'); d.innerHTML = sanitizeHtml(h || ''); return d.textContent; };
const html = (s) => escapeHtml(String(s ?? '')).replace(/\n/g, '<br>');
async function getDoc(id) {
  if (state.doc && (!id || state.doc.id === id)) return state.doc;
  const d = id ? await loadDoc(id) : null;
  if (!d) throw new Error('No presentation with this id. Call deckly_list_presentations first.');
  return normalizeDoc(d);
}
// save a document and refresh the editor if it is the open one
async function keep(d, show = false) {
  d.updated = Date.now();
  normalizeDoc(d);
  if (state.doc && state.doc.id === d.id) { state.doc = d; state.slide = Math.min(state.slide, d.slides.length - 1); state.sel = []; commit(); emit('all'); }
  else { await saveDoc(d); if (show) hooks.openDoc?.(d); }
  if (show && state.doc?.id === d.id) { /* already open */ }
}

export async function runTool(name, a) {
  switch (name) {
    case 'deckly_list_presentations': return { presentations: (await listDocs()).sort((x, y) => y.updated - x.updated).map(docSummary), open: state.doc ? state.doc.id : null };
    case 'deckly_get_presentation': { const d = await getDoc(a.id); return { ...docSummary(d), theme: d.theme || null, slides: d.slides.map(slideSummary) }; }
    case 'deckly_list_templates': return { templates: TEMPLATES.map((t) => ({ id: t.id, name: tr(t.name), category: tr(t.tag), slides: t.build().length })), themes: Object.keys(THEMES), layouts: Object.keys(LAYOUTS) };
    case 'deckly_create_presentation': {
      const d = newDoc(a.width || 1920, a.height || 1080, String(a.title || tr('Untitled presentation')).slice(0, 120));
      d.theme = themeOf(a.theme);
      if (a.template) { const t = TEMPLATES.find((x) => x.id === a.template); if (!t) throw new Error('Unknown template. Call deckly_list_templates.'); d.slides = t.build(); }
      if (Array.isArray(a.slides) && a.slides.length) { const built = a.slides.map((s) => buildSlide(s, d)); d.slides = a.template ? [...d.slides, ...built] : built; }
      await saveDoc(d);
      if (a.open !== false) hooks.openDoc?.(d);
      return { ...docSummary(d), message: 'Presentation created' + (a.open !== false ? ' and opened in Deckly' : '') };
    }
    case 'deckly_delete_presentation': { if (state.doc?.id === a.id) hooks.showHome?.(); await deleteDoc(a.id); return { deleted: a.id }; }
    case 'deckly_open_presentation': { const d = await getDoc(a.id); hooks.openDoc?.(d); if (Number.isInteger(a.slide)) { state.slide = Math.max(0, Math.min(d.slides.length - 1, a.slide)); emit('slide'); } return { opened: d.id }; }
    case 'deckly_add_slide': {
      const d = await getDoc(a.id);
      const specs = Array.isArray(a.slides) ? a.slides : [a.slide || a];
      const built = specs.map((s) => buildSlide(s, d));
      const at = Number.isInteger(a.at) ? Math.max(0, Math.min(d.slides.length, a.at)) : d.slides.length;
      d.slides.splice(at, 0, ...built);
      await keep(d);
      if (state.doc?.id === d.id) { state.slide = at; emit('slide'); }
      return { added: built.length, at, slides: d.slides.length };
    }
    case 'deckly_replace_slide': {
      const d = await getDoc(a.id); const i = slideIndex(d, a.slide);
      const s = buildSlide(a.content || a, d); s.id = d.slides[i].id; if (d.slides[i].notes && !a.content?.notes) s.notes = d.slides[i].notes;
      d.slides[i] = s; await keep(d); return { replaced: i };
    }
    case 'deckly_delete_slide': { const d = await getDoc(a.id); const i = slideIndex(d, a.slide); if (d.slides.length === 1) d.slides[0] = newSlide(); else d.slides.splice(i, 1); await keep(d); return { slides: d.slides.length }; }
    case 'deckly_move_slide': { const d = await getDoc(a.id); const i = slideIndex(d, a.slide); const [s] = d.slides.splice(i, 1); const to = Math.max(0, Math.min(d.slides.length, a.to | 0)); d.slides.splice(to, 0, s); await keep(d); return { moved: i, to }; }
    case 'deckly_set_notes': { const d = await getDoc(a.id); const i = slideIndex(d, a.slide); d.slides[i].notes = String(a.notes || '').slice(0, 5000); await keep(d); return { ok: true }; }
    case 'deckly_set_background': { const d = await getDoc(a.id); const idx = a.slide == null ? d.slides.map((_, i) => i) : [slideIndex(d, a.slide)]; const bg = await backgroundOf(a, d.theme); for (const i of idx) d.slides[i].bg = bg; await keep(d); return { ok: true, slides: idx }; }
    case 'deckly_set_theme': { const d = await getDoc(a.id); d.theme = themeOf(a.theme, a.colors, a.fonts); if (a.apply !== false) applyTheme(d); await keep(d); return { theme: d.theme }; }
    case 'deckly_update_text': {
      const d = await getDoc(a.id); const i = slideIndex(d, a.slide); const el = d.slides[i].elements.find((e) => e.id === a.element);
      if (!el) throw new Error('No element with this id on that slide (see deckly_get_presentation).');
      if (el.type === 'text') el.html = html(a.text); else if (el.type === 'shape') { el.text = el.text || { color: '#fff', size: 40, font: 'Inter', align: 'center', valign: 'middle' }; el.text.html = html(a.text); } else if (el.type === 'table' && a.rows) { setTableRows(el, a.rows); } else throw new Error('This element holds no text.');
      if (a.size) el.size = +a.size; if (a.color) el.color = String(a.color);
      await keep(d); return { ok: true };
    }
    case 'deckly_add_element': {
      const d = await getDoc(a.id); const i = slideIndex(d, a.slide);
      const el = await buildElement(a.element || a, d);
      d.slides[i].elements.push(el); await keep(d); return { id: el.id, type: el.type };
    }
    case 'deckly_delete_element': { const d = await getDoc(a.id); const i = slideIndex(d, a.slide); const n = d.slides[i].elements.length; d.slides[i].elements = d.slides[i].elements.filter((e) => e.id !== a.element); if (n === d.slides[i].elements.length) throw new Error('No element with this id.'); await keep(d); return { ok: true }; }
    case 'deckly_search_library': return searchLibrary(a.query, a.kind, a.limit);
    case 'deckly_screenshot_slide': {
      const d = await getDoc(a.id); const i = slideIndex(d, a.slide);
      const keepDoc = state.doc; state.doc = d; // renderPng reads the open document
      try { const png = await renderPng(d.slides[i], a.scale || 0.5); return { image: png.split(',')[1], mimeType: 'image/png', slide: i }; } finally { state.doc = keepDoc; }
    }
    case 'deckly_export': {
      const d = await getDoc(a.id); const fmt = a.format || 'pptx';
      const keepDoc = state.doc; state.doc = d;
      try {
        if (fmt === 'dkly') { const blob = await packDkly(d, { presentOnOpen: !!a.presentOnOpen, appVersion: (await window.decklyDesktop.info()).version }); return { file: await window.decklyDesktop.connector.writeFile(a.path, await toB64(blob), 'dkly', d.title) }; }
        if (fmt === 'png') { const png = await renderPng(d.slides[slideIndex(d, a.slide || 0)], a.scale || 1); return { file: await window.decklyDesktop.connector.writeFile(a.path, png.split(',')[1], 'png', d.title) }; }
        if (fmt === 'pdf') { const { jsPDF } = window.jspdf; const pdf = new jsPDF({ orientation: d.w >= d.h ? 'landscape' : 'portrait', unit: 'px', format: [d.w, d.h], hotfixes: ['px_scaling'], compress: true }); for (let i = 0; i < d.slides.length; i++) { if (i) pdf.addPage([d.w, d.h], d.w >= d.h ? 'landscape' : 'portrait'); pdf.addImage(await renderPng(d.slides[i], 1, false, 0.9), 'JPEG', 0, 0, d.w, d.h, undefined, 'MEDIUM'); } return { file: await window.decklyDesktop.connector.writeFile(a.path, pdf.output('datauristring').split(',')[1], 'pdf', d.title) }; }
        // pptx: the exporter writes a file through the browser download; here we build it in memory instead
        const out = await exportPptx(2, true); return { file: await window.decklyDesktop.connector.writeFile(a.path, out, 'pptx', d.title) };
      } finally { state.doc = keepDoc; }
    }
    default: throw new Error(`Unknown tool ${name}`);
  }
}
const toB64 = async (blob) => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); };
function slideIndex(d, s) { const i = typeof s === 'string' ? d.slides.findIndex((x) => x.id === s) : (s | 0); if (i < 0 || i >= d.slides.length) throw new Error(`No slide ${s} (the presentation has ${d.slides.length} slides, numbered from 0).`); return i; }
function themeOf(name, colors = {}, fonts = {}) {
  const base = THEMES[name] || (name && typeof name === 'object' ? { ...THEMES.deckly, ...name } : THEMES.deckly);
  const t = { ...base, name: THEMES[name] ? name : 'custom' };
  for (const k of ['bg', 'text', 'muted', 'accent', 'accent2', 'soft', 'dark']) if (/^#[0-9a-f]{6}$/i.test(colors?.[k] || '')) t[k] = colors[k];
  if (fonts?.body && packs.fonts.includes(fonts.body)) t.font = fonts.body; if (fonts?.heading && packs.fonts.includes(fonts.heading)) t.heading = fonts.heading;
  return t;
}
function applyTheme(d) {
  const t = d.theme;
  for (const s of d.slides) { if (s.bg.type === 'color') s.bg.value = s.bg.value === '#FFFFFF' || s.bg.value === d._oldBg ? t.bg : s.bg.value; for (const e of s.elements) { if (e.type === 'text') { e.font = e.size >= 60 ? t.heading : t.font; if (/^#(1E1F2B|FFFFFF|111111)$/i.test(e.color)) e.color = t.text; } if (e.type === 'shape' && e.fill === '#6C4CF5') e.fill = t.accent; } }
}
async function backgroundOf(a, theme) {
  if (a.image) { const src = await resolveImage(a.image); if (src) return { type: 'image', value: src }; }
  if (a.gradient) return { type: 'gradient', value: String(a.gradient).slice(0, 300) };
  const c = a.color || a.background;
  if (/^#[0-9a-f]{6}$/i.test(c || '')) return { type: 'color', value: c };
  if (c === 'dark') return { type: 'color', value: theme?.dark || '#0F1B3D' }; if (c === 'accent') return { type: 'color', value: theme?.accent || '#6C4CF5' }; if (c === 'soft') return { type: 'color', value: theme?.soft || '#F4F1FF' };
  return { type: 'color', value: theme?.bg || '#FFFFFF' };
}
// a picture by built-in photo category / search words, a 3D sticker name, or a data: / https: URL
async function resolveImage(spec) {
  if (!spec) return null;
  if (typeof spec === 'string') spec = /^(data:|https?:)/.test(spec) ? { url: spec } : { query: spec };
  if (spec.url) { if (spec.url.startsWith('data:image/')) return spec.url; if (/^https:\/\//.test(spec.url)) { try { const b = await (await fetch(spec.url)).blob(); if (!b.type.startsWith('image/')) return null; return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); } catch { return null; } } return null; }
  if (spec.sticker) { const hit = lib.st3d?.[spec.sticker] != null ? spec.sticker : searchPackNames('stickers3d', spec.sticker, 1)[0]; return hit ? sticker3dUrl(hit) : null; }
  const q = String(spec.query || spec.photo || '').toLowerCase();
  const cat = packs.photos.find((p) => p.cat.toLowerCase() === q)?.cat;
  const list = packs.photos.filter((p) => (cat && p.cat === cat) || (!cat && (p.cat + ' ' + p.title).toLowerCase().includes(q)));
  const pick = list[(spec.index || 0) % Math.max(1, list.length)] || packs.photos[Math.floor(Math.random() * packs.photos.length)];
  return pick ? photoUrl(pick) : null;
}
async function searchLibrary(query, kind = 'all', limit = 20) {
  await loadNames();
  const out = {};
  const q = String(query || '');
  if (kind === 'all' || kind === 'photos') out.photos = packs.photos.filter((p) => (p.cat + ' ' + p.title).toLowerCase().includes(q.toLowerCase())).slice(0, limit).map((p) => ({ category: p.cat, title: p.title, use: { query: p.title } }));
  if (kind === 'all' || kind === 'stickers') out.stickers = searchPackNames('stickers3d', q, limit).map((n) => ({ name: n, use: { sticker: n } }));
  if (kind === 'all' || kind === 'icons') out.icons = searchPackNames('lucide', q, limit).map((n) => ({ name: n, use: { icon: n } }));
  if (kind === 'all' || kind === 'graphics') { const id = 'withicons-sticker'; await loadPack(id); out.graphics = searchPackNames(id, q, limit).map((n) => ({ name: `${id}:${n}`, use: { graphic: `${id}:${n}` } })); }
  out.photoCategories = [...new Set(packs.photos.map((p) => p.cat))];
  return out;
}
function setTableRows(el, rows) {
  rows = rows.map((r) => (Array.isArray(r) ? r : [r]).map((c) => html(c)));
  el.rows = rows.length; el.cols = Math.max(...rows.map((r) => r.length));
  el.cells = rows.map((r) => Array.from({ length: el.cols }, (_, c) => ({ h: r[c] || '' })));
  el.colW = Array(el.cols).fill(1 / el.cols); el.rowH = Array(el.rows).fill(el.rowH?.[0] || 90); el.h = el.rowH.reduce((a, b) => a + b, 0);
}

// ---------- slide layouts (1920 x 1080, scaled to the document) ----------
const T = (htmlText, x, y, w, size, o = {}) => ({ id: uid(), type: 'text', html: htmlText, x, y, w, h: size * 1.3, size, font: o.font || 'Inter', color: o.color || '#1E1F2B', bold: !!o.bold, align: o.align || 'left', lineHeight: o.lh || 1.2, rot: 0, opacity: o.op ?? 1 });
const R = (shape, x, y, w, h, fill, o = {}) => ({ id: uid(), type: 'shape', shape, x, y, w, h, fill, radius: o.r, strokeWidth: 0, rot: 0, opacity: o.op ?? 1 });
// a font size that keeps a one-line heading inside its box (Poppins is wide), never under the minimum
const fit = (text, maxW, size, min = 56) => Math.max(min, Math.min(size, Math.floor(maxW / (Math.max(1, String(text || '').length) * 0.58))));
const lines = (text, maxW, size) => Math.max(1, Math.ceil((String(text || '').length * 0.58 * size) / maxW));
const bullets = (list) => (Array.isArray(list) ? list : String(list || '').split('\n')).filter((x) => String(x).trim()).map((b) => '• ' + html(b)).join('<br>');
const LAYOUTS = {
  title: (s, t) => { const sz = fit(s.title, 1500, 150, 80), n = lines(s.title, 1500, sz), y = n > 1 ? 260 : 360; return [R('rect', 0, 0, 1920, 1080, t.accent, {}), R('blob1', 1240, -160, 900, 900, '#FFFFFF', { op: 0.12 }), T(html(s.title), 140, y, 1500, sz, { font: t.heading, color: '#FFFFFF', bold: true, lh: 1.05 }), ...(s.subtitle ? [T(html(s.subtitle), 140, y + n * sz * 1.05 + 60, 1300, 52, { color: '#FFFFFF', op: 0.92 })] : [])]; },
  section: (s, t) => { const sz = fit(s.title, 1500, 130, 72), n = lines(s.title, 1500, sz); return [R('rect', 0, 0, 1920, 1080, t.dark), R('rect', 140, 400, 120, 12, t.accent2), T(html(s.title), 140, 450, 1500, sz, { font: t.heading, color: '#FFFFFF', bold: true, lh: 1.05 }), ...(s.subtitle ? [T(html(s.subtitle), 140, 450 + n * sz * 1.05 + 50, 1300, 46, { color: '#FFFFFF', op: 0.8 })] : [])]; },
  'title-bullets': (s, t) => [T(html(s.title), 140, 110, 1640, fit(s.title, 1640, 84, 48), { font: t.heading, color: t.text, bold: true }), R('rect', 140, 225, 120, 10, t.accent), T(bullets(s.bullets || s.text), 140, 300, 1640, 44, { color: t.text, lh: 1.7 })],
  text: (s, t) => [T(html(s.title), 140, 110, 1640, fit(s.title, 1640, 84, 48), { font: t.heading, color: t.text, bold: true }), T(html(s.text), 140, 280, 1640, 40, { color: t.muted, lh: 1.6 })],
  'two-column': (s, t) => [T(html(s.title), 140, 100, 1640, fit(s.title, 1640, 80, 48), { font: t.heading, color: t.text, bold: true }), ...[[s.left, 140], [s.right, 1000]].flatMap(([c, x]) => (c ? [R('rounded', x, 260, 780, 660, t.soft, { r: 6 }), T(html(c.title || ''), x + 50, 310, 680, 46, { font: t.heading, color: t.accent, bold: true }), T(bullets(c.bullets || c.text), x + 50, 400, 680, 36, { color: t.text, lh: 1.65 })] : []))],
  'image-text': (s, t) => [{ id: uid(), type: 'image', src: '', x: 1000, y: 0, w: 920, h: 1080, frame: 'rect', filters: {}, rot: 0, opacity: 1, _img: s.image || s.title }, T(html(s.title), 140, 200, 760, fit(s.title, 760, 84, 44), { font: t.heading, color: t.text, bold: true, lh: 1.1 }), T(bullets(s.bullets) || html(s.text || ''), 140, 420, 760, 38, { color: t.muted, lh: 1.65 })],
  'image-full': (s, t) => [{ id: uid(), type: 'image', src: '', x: 0, y: 0, w: 1920, h: 1080, frame: 'rect', filters: { brightness: 70 }, rot: 0, opacity: 1, _img: s.image || s.title }, T(html(s.title), 140, 760, 1640, fit(s.title, 1640, 110, 64), { font: t.heading, color: '#FFFFFF', bold: true, lh: 1.05 }), ...(s.subtitle ? [T(html(s.subtitle), 140, 900, 1640, 44, { color: '#FFFFFF', op: 0.9 })] : [])],
  quote: (s, t) => [R('rect', 0, 0, 1920, 1080, t.soft), T('“', 140, 160, 300, 300, { font: t.heading, color: t.accent, bold: true }), T(html(s.quote || s.text || s.title), 240, 380, 1440, 72, { font: t.heading, color: t.text, lh: 1.25 }), ...(s.author ? [T('— ' + html(s.author), 240, 760, 1440, 40, { color: t.muted })] : [])],
  stats: (s, t) => [T(html(s.title), 140, 100, 1640, fit(s.title, 1640, 80, 48), { font: t.heading, color: t.text, bold: true }), ...(s.stats || []).slice(0, 4).flatMap((st, i, arr) => { const w = (1640 - 40 * (arr.length - 1)) / arr.length, x = 140 + i * (w + 40); return [R('rounded', x, 320, w, 460, t.soft, { r: 6 }), T(html(st.value), x + 40, 380, w - 80, 120, { font: t.heading, color: [t.accent, t.accent2, t.dark, t.accent][i % 4], bold: true }), T(html(st.label), x + 40, 560, w - 80, 36, { color: t.muted, lh: 1.4 })]; })],
  table: (s, t) => { const el = tableDefaults(2, 2, s.style || 'header', 1920); el.x = 140; el.y = 280; el.w = 1640; el.style.headerFill = t.accent; setTableRows(el, s.rows || s.table?.rows || [['', ''], ['', '']]); el.colW = Array(el.cols).fill(1 / el.cols); return [T(html(s.title), 140, 100, 1640, fit(s.title, 1640, 80, 48), { font: t.heading, color: t.text, bold: true }), el]; },
  chart: (s, t) => { const c = s.chart || s; const el = chartDefaults(c.kind || 'column', 1920); el.x = 140; el.y = 260; el.w = 1640; el.h = 700; if (c.labels) el.labels = c.labels.map(String); if (c.series) el.series = c.series.map((sr) => ({ name: String(sr.name || ''), values: (sr.values || []).map(Number) })); el.opts.font = t.font; el.opts.color = t.text; el.opts.colors = [t.accent, t.accent2, t.dark, '#2EC27E', '#FFC83D']; return [T(html(s.title), 140, 100, 1640, fit(s.title, 1640, 80, 48), { font: t.heading, color: t.text, bold: true }), el]; },
  blank: () => [],
};
function buildSlide(spec, d) {
  const t = d.theme || THEMES.deckly;
  const layout = LAYOUTS[spec.layout] || (spec.chart ? LAYOUTS.chart : spec.rows || spec.table ? LAYOUTS.table : spec.stats ? LAYOUTS.stats : spec.quote ? LAYOUTS.quote : spec.left || spec.right ? LAYOUTS['two-column'] : spec.image ? LAYOUTS['image-text'] : spec.bullets ? LAYOUTS['title-bullets'] : spec.text ? LAYOUTS.text : spec.title && !spec.subtitle ? LAYOUTS['title-bullets'] : LAYOUTS.title);
  const els = layout(spec, t).map((e) => ({ ...e, font: e.type === 'text' ? e.font : undefined }));
  const s = newSlide({ type: 'color', value: spec.layout === 'title' ? t.accent : t.bg });
  if (spec.background || spec.color) s.bg = { type: 'color', value: /^#[0-9a-f]{6}$/i.test(spec.background || spec.color) ? (spec.background || spec.color) : t.bg };
  if (spec.notes) s.notes = String(spec.notes).slice(0, 5000);
  // pictures: resolved from the built-in library (async, best effort)
  for (const e of els) if (e._img !== undefined) { const want = e._img; delete e._img; e.placeholder = true; e.src = PLACEHOLDER; resolveImage(want).then((src) => { if (src) { e.src = src; e.placeholder = false; if (state.doc?.id === d.id) { commit(); emit('canvas'); } else saveDoc(d); } }); }
  // scale from 1920 x 1080 to the document size
  const kx = d.w / 1920, ky = d.h / 1080, k = Math.min(kx, ky);
  for (const e of els) { e.x *= kx; e.y *= ky; e.w *= kx; e.h *= ky; if (e.size) e.size *= k; if (e.type === 'table') { e.rowH = e.rowH.map((r) => r * ky); e.style.size *= k; e.style.pad *= k; } if (e.type === 'chart') e.opts.size *= k; }
  if (Array.isArray(spec.elements)) els.push(...spec.elements.filter((x) => x && typeof x === 'object').map((x) => ({ ...x, id: uid() })));
  s.elements = els;
  return s;
}
const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#E6E7EF"/></svg>');
async function buildElement(e, d) {
  const t = d.theme || THEMES.deckly, base = Math.min(d.w, d.h);
  const x = +e.x || 100, y = +e.y || 100, w = +e.w || base * 0.4, h = +e.h || base * 0.2;
  switch (e.type) {
    case 'text': return T(html(e.text), x, y, w, +e.size || 40, { font: e.font || t.font, color: e.color || t.text, bold: !!e.bold, align: e.align });
    case 'shape': { const s = R(e.shape || 'rounded', x, y, w, h, e.color || t.accent, { r: 6 }); if (e.text) s.text = { html: html(e.text), color: '#FFFFFF', size: +e.size || base * 0.03, font: t.font, align: 'center', valign: 'middle', bold: true }; return s; }
    case 'image': { const src = await resolveImage(e.image || e.query || e.url || e.sticker); return { id: uid(), type: 'image', src: src || PLACEHOLDER, placeholder: !src, x, y, w, h, frame: e.frame || 'rect', filters: {}, rot: 0, opacity: 1 }; }
    case 'icon': { const n = packs.lucide[e.name] ? e.name : searchPackNames('lucide', e.name || 'star', 1)[0] || 'star'; return { id: uid(), type: 'icon', name: n, x, y, w: +e.w || base * 0.12, h: +e.h || base * 0.12, color: e.color || t.accent, sw: 2, rot: 0, opacity: 1 }; }
    case 'table': { const el = tableDefaults(2, 2, e.style || 'header', base * 1.78); el.x = x; el.y = y; el.w = w; el.style.headerFill = t.accent; setTableRows(el, e.rows || [['', '']]); return { ...el, id: uid(), rot: 0, opacity: 1 }; }
    case 'chart': { const el = chartDefaults(e.kind || 'column', base * 1.78); el.x = x; el.y = y; el.w = w; el.h = h; if (e.labels) el.labels = e.labels.map(String); if (e.series) el.series = e.series.map((sr) => ({ name: String(sr.name || ''), values: (sr.values || []).map(Number) })); el.opts.colors = [t.accent, t.accent2, t.dark]; return { ...el, id: uid(), rot: 0, opacity: 1 }; }
    case 'qr': return { ...qrDefaults(base), id: uid(), text: String(e.text || e.url || ''), x, y, rot: 0, opacity: 1 };
    case 'line': return { ...makeLine(x, y, x + w, y, { stroke: e.color || t.text, strokeWidth: +e.width || 6, capEnd: e.arrow ? 'arrow' : 'none' }), id: uid(), rot: 0, opacity: 1 };
    default: throw new Error('Unknown element type: text, shape, image, icon, table, chart, qr, line');
  }
}
