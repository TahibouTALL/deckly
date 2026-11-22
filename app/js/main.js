// App entry: home screen, opening designs, top bar, online/offline switch.
import { state, emit, on, newDoc, resetHistory, saveDoc, loadDoc, listDocs, deleteDoc, undo, redo, canUndo, canRedo, commit, uid } from './store.js';
import { loadPacks, hydrateIcons, ic } from './assets.js';
import { initEditor, setZoom, fit, select, stopEditing } from './editor.js';
import { initPanels, openTab, renderPanel, applyTemplate } from './panels.js';
import { initToolbar } from './toolbar.js';
import { initSlides } from './slides.js';
import { TEMPLATES } from './templates.js';
import { miniSlide } from './render.js';
import { present, exportPng, exportPdf, exportPptx, saveFile, readFile } from './output.js';
import { toast, shortcutsModal, popover, closePopover } from './ui.js';
import { initUpdates, askChoice, checkNow } from './updates.js';
import { t as tr, translateDom, lang, LANGS, setLang } from './i18n.js';
import { loadBrand, resizeDialog, versionsDialog, snapshotVersion } from './pro.js';

const $ = (s) => document.querySelector(s);
const SIZES = [
  ['Presentation', '16:9 · 1920 × 1080', 1920, 1080], ['Classic slides', '4:3 · 1600 × 1200', 1600, 1200],
  ['Square post', '1:1 · 1080 × 1080', 1080, 1080], ['Story / mobile', '9:16 · 1080 × 1920', 1080, 1920], ['A4 document', 'Portrait · 1240 × 1754', 1240, 1754],
];

await loadPacks();
await loadBrand();
hydrateIcons();
translateDom(document.body);
document.querySelectorAll('.lang-btn').forEach((b) => (b.onclick = (e) => langMenu(e.currentTarget)));
initEditor(); initPanels(); initToolbar(); initSlides();
wireTopbar();
updateNet();
initUpdates();
window.addEventListener('online', () => { state.online = true; updateNet(); });
window.addEventListener('offline', () => { state.online = false; updateNet(); });
try { state.onlineEnabled = localStorage.getItem('deckly-online') !== 'off'; } catch { /* */ }
updateNet();

const hashId = location.hash.slice(1);
if (hashId && (await loadDoc(hashId))) openDoc(await loadDoc(hashId)); else showHome();

// ---------- home ----------
async function showHome() {
  if (state.editingId) stopEditing();
  $('#editor').classList.add('hidden'); $('#home').classList.remove('hidden');
  history.replaceState(null, '', location.pathname);
  $('#sizeCards').innerHTML = SIZES.map(([n, d, w, h], i) => {
    const k = 64 / Math.max(w, h);
    return `<button class="size-card" data-size="${i}"><div class="shape" style="width:${w * k}px;height:${h * k}px"></div>${tr(n)}<small>${d.replace('Portrait', tr('Portrait'))}</small></button>`;
  }).join('');
  $('#sizeCards').onclick = (e) => { const b = e.target.closest('[data-size]'); if (!b) return; const [, , w, h] = SIZES[b.dataset.size]; openDoc(newDoc(w, h), true); };
  const tg = $('#homeTemplates'); tg.innerHTML = '';
  const probe = newDoc();
  for (const t of TEMPLATES) {
    const slides = t.build();
    const c = document.createElement('button'); c.className = 'tpl-card';
    c.innerHTML = `<div class="thumb"></div><div class="meta">${tr(t.name)}<small>${tr(t.tag)}</small></div>`;
    c.querySelector('.thumb').appendChild(miniSlide(slides[0], probe, 300));
    c.onclick = () => { const d = newDoc(1920, 1080, tr(t.name)); d.slides = slides; openDoc(d, true); };
    tg.appendChild(c);
  }
  const docs = (await listDocs()).sort((a, b) => b.updated - a.updated);
  const rg = $('#recentGrid'); rg.innerHTML = docs.length ? '' : `<div class="empty-note">${tr('Your designs will appear here. Everything is saved on this computer automatically.')}</div>`;
  for (const d of docs) {
    const c = document.createElement('div'); c.className = 'recent-card'; c.style.cursor = 'pointer';
    const ago = timeAgo(d.updated);
    c.innerHTML = `<div class="thumb" style="display:flex;align-items:center;justify-content:center;background:#E9EAF1"></div><div class="meta"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(d.title)}</span><small>${ago}</small></div><button class="del" title="${tr('Delete')}">${ic('trash-2')}</button>`;
    const box = c.querySelector('.thumb');
    const ratio = d.w / d.h, bw = 300, bh = 300 / (16 / 9);
    const tw = ratio >= 16 / 9 ? bw : bh * ratio;
    box.appendChild(miniSlide(d.slides[0], d, tw));
    c.onclick = (e) => {
      if (e.target.closest('.del')) {
        e.stopPropagation();
        const b = e.target.closest('.del');
        popover(b, `<div style="font-weight:600;margin-bottom:6px">${tr('Delete “{name}”?', { name: escapeHtml(d.title) })}</div><div class="hint">This removes it from this computer. It cannot be undone.</div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost" data-no>Cancel</button><button class="btn primary" data-yes style="background:#C0354F;box-shadow:none">Delete</button></div>`, (p) => {
          p.querySelector('[data-no]').onclick = closePopover;
          p.querySelector('[data-yes]').onclick = async () => { closePopover(); await deleteDoc(d.id); showHome(); toast('Design deleted'); };
        });
        return;
      }
      openDoc(d);
    };
    rg.appendChild(c);
  }
}
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function timeAgo(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return tr('just now'); if (s < 3600) return tr('{n} min ago', { n: Math.round(s / 60) }); if (s < 86400) return tr('{n} h ago', { n: Math.round(s / 3600) });
  return new Date(t).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB');
}

function openDoc(doc, isNew = false) {
  state.doc = doc; state.slide = 0; state.sel = []; state.editingId = null; state.zoom = 'fit';
  resetHistory();
  $('#home').classList.add('hidden'); $('#editor').classList.remove('hidden');
  $('#titleInput').value = doc.title;
  history.replaceState(null, '', '#' + doc.id);
  if (isNew) saveDoc(doc);
  setTimeout(() => snapshotVersion(true), 1500);
  openTab(isNew && doc.slides.length === 1 && !doc.slides[0].elements.length ? 'design' : 'elements');
  emit('all');
  requestAnimationFrame(fit);
}

// ---------- top bar ----------
function wireTopbar() {
  $('#homeBtn').onclick = showHome;
  $('#undoBtn').onclick = undo; $('#redoBtn').onclick = redo;
  $('#presentBtn').onclick = () => { if (state.editingId) stopEditing(); present(state.slide); };
  $('#titleInput').addEventListener('change', (e) => { state.doc.title = e.target.value.trim() || tr('Untitled presentation'); e.target.value = state.doc.title; commit(); });
  $('#titleInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  const menu = $('#fileMenu');
  $('#fileMenuBtn').onclick = (e) => { e.stopPropagation(); menu.classList.toggle('open'); };
  document.addEventListener('click', (e) => { if (!e.target.closest('.menu-wrap')) menu.classList.remove('open'); });
  menu.onclick = (e) => { const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return; menu.classList.remove('open'); fileAction(a); };
  $('#downloadBtn').onclick = (e) => popover(e.currentTarget, `<h4>Download</h4><div class="pop-list">
      <button data-d="pptx">${ic('presentation')} PowerPoint (.pptx)<small style="margin-left:auto;color:var(--text-3)">editable text</small></button>
      <button data-d="pdf">${ic('file-text')} PDF — all slides</button><button data-d="png">${ic('image')} PNG — this slide</button>
      <button data-d="pngt">${ic('image-off')} PNG — transparent background</button>
      <button data-d="save">${ic('save')} Deckly file (.deckly)</button></div>`, (p) => { p.onclick = (ev) => { const d = ev.target.closest('[data-d]')?.dataset.d; if (d) { closePopover(); fileAction(d); } }; });
  $('#zoomVal').title = tr('Fit to screen');
  $('#zoomIn').onclick = () => setZoom(Math.min(4, state.scale * 1.2));
  $('#zoomOut').onclick = () => setZoom(Math.max(0.1, state.scale / 1.2));
  $('#zoomVal').onclick = () => setZoom('fit');
  $('#helpBtn').onclick = shortcutsModal;
  $('#openFileHome').onclick = () => $('#fileOpen').click();
  $('#homeUpdates').onclick = (e) => popover(e.currentTarget, `<div class="pop-list"><button data-u="check">${ic('refresh-cw')} Check for updates</button><button data-u="settings">${ic('settings')} Update settings…</button></div>`,
    (p) => { p.onclick = (ev) => { const u = ev.target.closest('[data-u]')?.dataset.u; if (!u) return; closePopover(); if (u === 'check') checkNow(); else askChoice(); }; });
  $('#fileOpen').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const d = await readFile(f); d.id = uid(); d.updated = Date.now(); await saveDoc(d); openDoc(d); toast('Design opened'); } catch { toast('This file could not be opened'); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'F5' && !$('#editor').classList.contains('hidden')) { e.preventDefault(); present(e.shiftKey ? state.slide : 0); } });
  on((w) => {
    if (w === 'saving') $('#saveState').innerHTML = `${ic('loader')}${tr('Saving…')}`;
    if (w === 'saved') { $('#saveState').innerHTML = `${ic('cloud-check')}${tr('Saved')}`; snapshotVersion(); }
    if (w === 'savefail') $('#saveState').innerHTML = `${ic('triangle-alert')}${tr('Not saved')}`;
    $('#undoBtn').disabled = !canUndo(); $('#redoBtn').disabled = !canRedo();
  });
  document.querySelectorAll('.net-pill').forEach((p) => (p.onclick = () => {
    state.onlineEnabled = !state.onlineEnabled;
    try { localStorage.setItem('deckly-online', state.onlineEnabled ? 'on' : 'off'); } catch { /* */ }
    updateNet(); renderPanel();
    toast(state.onlineEnabled ? (state.online ? 'Online search on' : 'No internet right now — the built-in library still works') : 'Offline mode: only the built-in library is used');
  }));
}
function fileAction(a) {
  if (a === 'new') showHome();
  if (a === 'open') $('#fileOpen').click();
  if (a === 'save') saveFile();
  if (a === 'png') exportPng();
  if (a === 'pngt') exportPng(true);
  if (a === 'resize') resizeDialog(openDoc);
  if (a === 'versions') versionsDialog();
  if (a === 'pdf') exportPdf();
  if (a === 'pptx') exportPptx();
  if (a === 'check-updates') checkNow();
  if (a === 'update-settings') askChoice();
  if (a === 'language') langMenu($('#fileMenuBtn'));
}
function langMenu(anchor) {
  popover(anchor, `<h4>${tr('Language')}</h4><div class="pop-list">${Object.entries(LANGS).map(([k, n]) => `<button data-l="${k}" class="${k === lang ? 'on' : ''}">${k === lang ? ic('check') : ic('languages')} ${n}</button>`).join('')}</div>`,
    (p) => { p.onclick = (e) => { const l = e.target.closest('[data-l]')?.dataset.l; if (l) { closePopover(); setLang(l); } }; });
}
function updateNet() {
  const on = state.online && state.onlineEnabled;
  document.querySelectorAll('.net-pill').forEach((p) => {
    p.className = 'net-pill ' + (on ? 'on' : 'off');
    p.innerHTML = `<span class="dot"></span>${tr(on ? 'Online' : state.onlineEnabled ? 'No internet' : 'Offline mode')}`;
    p.title = tr(on ? 'Searches also use the web. Click to work offline only.' : 'Only the built-in library is used. Click to allow web search.');
  });
}
