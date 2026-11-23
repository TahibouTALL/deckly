// App entry: home screen, opening designs, top bar, online/offline switch, Claude connector, credits.
import { state, emit, on, newDoc, resetHistory, saveDoc, loadDoc, listDocs, deleteDoc, undo, redo, canUndo, canRedo, commit, uid, flushSave, normalizeDoc } from './store.js';
import { loadPacks, hydrateIcons, ic } from './assets.js';
import { initLibrary } from './library.js';
import { initEditor, setZoom, fit, select, stopEditing } from './editor.js';
import { initPanels, openTab, renderPanel, applyTemplate } from './panels.js';
import { initToolbar } from './toolbar.js';
import { initSlides } from './slides.js';
import { TEMPLATES } from './templates.js';
import { miniSlide } from './render.js';
import { present, exportPng, exportPdf, exportPptx, saveFile, readFile, downloadDialog } from './output.js';
import { toast, shortcutsModal, popover, closePopover, modal, closeModal, confirmPopover } from './ui.js';
import { initUpdates, askChoice, checkNow } from './updates.js';
import { t as tr, translateDom, lang, LANGS, setLang } from './i18n.js';
import { loadBrand, resizeDialog, versionsDialog, snapshotVersion, userTemplates, saveAsTemplate, getFolders, addFolder, deleteFolder, askName } from './pro.js';
import { initConnector } from './connector.js';
let homeFolder = null;

const $ = (s) => document.querySelector(s);
const SIZES = [
  ['Presentation', '16:9 · 1920 × 1080', 1920, 1080], ['Classic slides', '4:3 · 1600 × 1200', 1600, 1200],
  ['Square post', '1:1 · 1080 × 1080', 1080, 1080], ['Story / mobile', '9:16 · 1080 × 1920', 1080, 1920], ['A4 document', 'Portrait · 1240 × 1754', 1240, 1754],
];

await Promise.all([loadPacks(), initLibrary()]);
await loadBrand();
hydrateIcons();
translateDom(document.body);
document.querySelectorAll('.lang-btn').forEach((b) => (b.onclick = (e) => langMenu(e.currentTarget)));
initEditor(); initPanels(); initToolbar(); initSlides();
wireTopbar();
updateNet();
initUpdates();
initConnector({ openDoc, showHome });
window.addEventListener('online', () => { state.online = true; updateNet(); });
window.addEventListener('offline', () => { state.online = false; updateNet(); });
try { state.onlineEnabled = localStorage.getItem('deckly-online') !== 'off'; } catch { /* */ }
updateNet();

const hashId = location.hash.slice(1);
const first = hashId && (await loadDoc(hashId));
if (first) openDoc(first); else showHome();

// ---------- home ----------
export async function showHome() {
  if (state.editingId) stopEditing();
  await flushSave();
  $('#editor').classList.add('hidden'); $('#home').classList.remove('hidden');
  history.replaceState(null, '', location.pathname);
  $('#sizeCards').innerHTML = SIZES.map(([n, d, w, h], i) => {
    const k = 64 / Math.max(w, h);
    return `<button class="size-card" data-size="${i}"><div class="shape" style="width:${w * k}px;height:${h * k}px"></div>${tr(n)}<small>${d.replace('Portrait', tr('Portrait'))}</small></button>`;
  }).join('');
  $('#sizeCards').onclick = (e) => { const b = e.target.closest('[data-size]'); if (!b) return; const [, , w, h] = SIZES[b.dataset.size]; openDoc(newDoc(w, h), true); };
  const tg = $('#homeTemplates'); tg.innerHTML = '';
  for (const t of [...(await userTemplates()), ...TEMPLATES]) {
    const slides = t.build();
    const c = document.createElement('button'); c.className = 'tpl-card';
    c.innerHTML = `<div class="thumb"></div><div class="meta">${t.mine ? escapeHtml(t.name) : tr(t.name)}<small>${tr(t.tag)}</small></div>`;
    const w = t.w || 1920, h = t.h || 1080;
    c.querySelector('.thumb').appendChild(miniSlide(slides[0], { w, h }, w / h >= 16 / 9 ? 300 : (300 / (16 / 9)) * (w / h)));
    c.querySelector('.thumb').style.cssText += ';display:flex;justify-content:center;background:#E9EAF1';
    c.onclick = () => { const d = newDoc(w, h, t.mine ? t.name : tr(t.name)); d.slides = slides; openDoc(d, true); };
    tg.appendChild(c);
  }
  const folders = await getFolders();
  if (homeFolder && !folders.some((f) => f.id === homeFolder)) homeFolder = null;
  $('#folderBar').innerHTML = [`<button class="chip ${!homeFolder ? 'on' : ''}" data-folder="">${ic('layout-grid')} ${tr('All')}</button>`,
    ...folders.map((f) => `<button class="chip ${homeFolder === f.id ? 'on' : ''}" data-folder="${f.id}">${ic('folder')} ${escapeHtml(f.name)}</button>`),
    `<button class="chip add" id="newFolder">${ic('folder-plus')} ${tr('New folder')}</button>`,
    homeFolder ? `<button class="chip danger" id="delFolder" title="${tr('Delete this folder (the designs stay)')}">${ic('trash-2')}</button>` : ''].join('');
  $('#folderBar').onclick = (e) => {
    const f = e.target.closest('[data-folder]'); if (f) { homeFolder = f.dataset.folder || null; showHome(); return; }
    if (e.target.closest('#newFolder')) askName(tr('New folder'), '', async (name) => { homeFolder = (await addFolder(name)).id; showHome(); });
    if (e.target.closest('#delFolder')) {
      (async () => { for (const d of await listDocs()) if (d.folder === homeFolder) { delete d.folder; await saveDoc(d); } await deleteFolder(homeFolder); homeFolder = null; showHome(); toast('Folder deleted — its designs are in All'); })();
    }
  };
  const docs = (await listDocs()).filter((d) => !homeFolder || d.folder === homeFolder).sort((a, b) => b.updated - a.updated);
  const rg = $('#recentGrid'); rg.innerHTML = docs.length ? '' : `<div class="empty-note">${tr(homeFolder ? 'This folder is empty. Move a design here with its folder button.' : 'Your designs will appear here. Everything is saved on this computer automatically.')}</div>`;
  for (const d of docs) {
    const c = document.createElement('div'); c.className = 'recent-card'; c.style.cursor = 'pointer'; c.tabIndex = 0;
    const ago = timeAgo(d.updated);
    c.innerHTML = `<div class="thumb" style="display:flex;align-items:center;justify-content:center;background:#E9EAF1"></div><div class="meta"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(d.title)}</span><small>${tr('{n} slides', { n: d.slides?.length || 1 })} · ${ago}</small></div><button class="del" title="${tr('Delete')}">${ic('trash-2')}</button><button class="del mv" title="${tr('More')}">${ic('ellipsis')}</button>`;
    const box = c.querySelector('.thumb');
    const ratio = d.w / d.h, bw = 300, bh = 300 / (16 / 9);
    const tw = ratio >= 16 / 9 ? bw : bh * ratio;
    try { box.appendChild(miniSlide(d.slides[0], d, tw)); } catch { /* a damaged design still shows its card */ }
    c.onkeydown = (e) => { if (e.key === 'Enter') openDoc(d); };
    c.onclick = (e) => {
      if (e.target.closest('.mv')) {
        e.stopPropagation();
        popover(e.target.closest('.mv'), `<div class="pop-list"><button data-o="rename">${ic('pencil')} ${tr('Rename')}</button><button data-o="dup">${ic('copy-plus')} ${tr('Duplicate')}</button><hr><h4>${tr('Move to a folder')}</h4>${[{ id: '', name: tr('No folder') }, ...folders].map((f) => `<button data-to="${f.id}" class="${(d.folder || '') === f.id ? 'on' : ''}">${ic(f.id ? 'folder' : 'layout-grid')} ${escapeHtml(f.name)}</button>`).join('')}</div>${folders.length ? '' : `<p class="hint">${tr('Create a folder first with “New folder”.')}</p>`}`, (p) => {
          p.onclick = async (ev) => {
            const o = ev.target.closest('[data-o]')?.dataset.o;
            if (o === 'rename') { closePopover(); askName(tr('Rename'), d.title, async (name) => { d.title = name; await saveDoc(d); showHome(); }); return; }
            if (o === 'dup') { closePopover(); const copy = JSON.parse(JSON.stringify(d)); copy.id = uid(); copy.title = `${d.title} (${tr('copy')})`; copy.updated = Date.now(); await saveDoc(copy); showHome(); toast('Design duplicated'); return; }
            const b = ev.target.closest('[data-to]'); if (!b) return; closePopover(); if (b.dataset.to) d.folder = b.dataset.to; else delete d.folder; await saveDoc(d); showHome(); toast('Design moved');
          };
        });
        return;
      }
      if (e.target.closest('.del')) {
        e.stopPropagation();
        confirmPopover(e.target.closest('.del'), tr('Delete “{name}”?', { name: escapeHtml(d.title) }) + `<div class="hint">${tr('This removes it from this computer. It cannot be undone.')}</div>`, async () => { await deleteDoc(d.id); showHome(); toast('Design deleted'); });
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

export async function openDoc(doc, isNew = false) {
  await flushSave();
  try { normalizeDoc(doc); } catch { toast('This design could not be opened'); return; }
  state.doc = doc; state.slide = 0; state.sel = []; state.editingId = null; state.cell = null; state.tool = null; state.zoom = 'fit';
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
  $('#presentBtn').onclick = () => { if (state.editingId) stopEditing(); present(state.slide, hasNotes()); };
  $('#titleInput').addEventListener('change', (e) => { state.doc.title = e.target.value.trim() || tr('Untitled presentation'); e.target.value = state.doc.title; commit(); });
  $('#titleInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  const menu = $('#fileMenu');
  $('#fileMenuBtn').onclick = (e) => { e.stopPropagation(); menu.classList.toggle('open'); };
  document.addEventListener('click', (e) => { if (!e.target.closest('.menu-wrap')) menu.classList.remove('open'); });
  menu.onclick = (e) => { const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return; menu.classList.remove('open'); fileAction(a); };
  $('#downloadBtn').onclick = () => downloadDialog(modal, closeModal, ic);
  $('#zoomVal').title = tr('Fit to screen');
  $('#zoomIn').onclick = () => setZoom(Math.min(4, state.scale * 1.2));
  $('#zoomOut').onclick = () => setZoom(Math.max(0.1, state.scale / 1.2));
  $('#zoomVal').onclick = (e) => popover(e.currentTarget, `<div class="pop-list cols">${['fit', 0.25, 0.5, 0.75, 1, 1.5, 2].map((z) => `<button data-z="${z}">${z === 'fit' ? tr('Fit') : Math.round(z * 100) + '%'}</button>`).join('')}</div>`, (p) => { p.onclick = (ev) => { const z = ev.target.closest('[data-z]')?.dataset.z; if (!z) return; closePopover(); setZoom(z === 'fit' ? 'fit' : +z); }; }, { width: 220 });
  $('#helpBtn').onclick = shortcutsModal;
  document.addEventListener('deckly-shortcuts', shortcutsModal);
  const notesBar = $('#notesBar'), notesText = $('#notesText');
  let notesT;
  $('#notesBtn').onclick = () => { notesBar.classList.toggle('hidden'); $('#notesBtn').classList.toggle('on', !notesBar.classList.contains('hidden')); if (!notesBar.classList.contains('hidden')) notesText.focus(); };
  notesText.addEventListener('input', () => { state.doc.slides[state.slide].notes = notesText.value; clearTimeout(notesT); notesT = setTimeout(commit, 600); });
  on((w) => { if (['all', 'slide', 'history'].includes(w) && state.doc && document.activeElement !== notesText) notesText.value = state.doc.slides[state.slide]?.notes || ''; });
  $('#openFileHome').onclick = () => $('#fileOpen').click();
  $('#homeUpdates').onclick = (e) => popover(e.currentTarget, `<div class="pop-list"><button data-u="check">${ic('refresh-cw')} ${tr('Check for updates')}</button><button data-u="settings">${ic('settings')} ${tr('Update settings…')}</button></div>`,
    (p) => { p.onclick = (ev) => { const u = ev.target.closest('[data-u]')?.dataset.u; if (!u) return; closePopover(); if (u === 'check') checkNow(); else askChoice(); }; });
  $('#homeClaude').onclick = () => document.dispatchEvent(new Event('deckly-claude'));
  $('#fileOpen').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    openFile(f);
  });
  window.decklyDesktop?.onOpenFile?.((bytes) => openFile(bytes));
  window.decklyDesktop?.onFlush?.(flushSave);
  $('#home').addEventListener('dragover', (e) => e.preventDefault());
  $('#home').addEventListener('drop', (e) => { const f = [...e.dataTransfer.files].find((x) => /\.(dkly|deckly)$/i.test(x.name)); if (f) { e.preventDefault(); openFile(f); } });
  document.addEventListener('keydown', (e) => {
    const inEditor = !$('#editor').classList.contains('hidden'), mod = e.ctrlKey || e.metaKey;
    if (e.key === 'F5' && inEditor) { e.preventDefault(); present(e.shiftKey ? state.slide : 0, hasNotes()); }
    if (mod && !e.altKey && inEditor && e.key.toLowerCase() === 's') { e.preventDefault(); saveFile(); }
    if (mod && !e.altKey && e.key.toLowerCase() === 'o') { e.preventDefault(); $('#fileOpen').click(); }
    if (mod && !e.altKey && inEditor && e.key.toLowerCase() === 'e') { e.preventDefault(); downloadDialog(modal, closeModal, ic); }
  });
  on((w) => {
    if (w === 'saving') { clearTimeout(wireTopbar.st); wireTopbar.st = setTimeout(() => { $('#saveState').innerHTML = `${ic('loader')}${tr('Saving…')}`; }, 400); }
    if (w === 'saved') { clearTimeout(wireTopbar.st); $('#saveState').innerHTML = `${ic('hard-drive')}${tr('Saved')}`; $('#saveState').title = tr('Saved on this computer'); snapshotVersion(); }
    if (w === 'savefail') { clearTimeout(wireTopbar.st); $('#saveState').innerHTML = `${ic('triangle-alert')}${tr('Not saved')}`; }
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
  if (a === 'save-show') saveFile(true);
  if (a === 'png') exportPng();
  if (a === 'download') downloadDialog(modal, closeModal, ic);
  if (a === 'resize') resizeDialog(openDoc);
  if (a === 'versions') versionsDialog();
  if (a === 'save-template') saveAsTemplate();
  if (a === 'pdf') exportPdf();
  if (a === 'pptx') exportPptx();
  if (a === 'check-updates') checkNow();
  if (a === 'update-settings') askChoice();
  if (a === 'language') langMenu($('#fileMenuBtn'));
  if (a === 'claude') document.dispatchEvent(new Event('deckly-claude'));
  if (a === 'credits') creditsDialog();
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
const hasNotes = () => state.doc.slides.some((s) => (s.notes || '').trim());

async function creditsDialog() {
  let list = [];
  try { list = await (await fetch('assets/credits-packs.json')).json(); } catch { /* */ }
  modal(`<h3>${ic('badge-info')} ${tr('Credits & licences')}</h3><p class="hint" style="font-size:13px">${tr('Every element built into Deckly comes from an open-licence project. Packs marked CC BY ask you to credit their author when you publish a design that uses them; the others ask nothing.')}</p>
    <div class="credits-list"><table>${list.map((c) => `<tr><td><b>${escapeHtml(c[0])}</b><br><a href="${escapeHtml(c[2])}" target="_blank" rel="noopener" style="color:var(--accent);font-size:12px">${escapeHtml(c[2])}</a></td><td>${escapeHtml(c[1])}<br>${(+c[3] || 0).toLocaleString('fr-FR')}</td></tr>`).join('')}</table></div>
    <p class="hint">${tr('Photos: each one shows its author and licence when you hover it in the Photos panel; your design keeps that credit (the ⓘ button of a selected photo).')}</p>
    <div style="text-align:right;margin-top:12px"><button class="btn primary" data-close>${tr('Close')}</button></div>`, { width: 640 });
}

// Opens a .dkly (or older .deckly) file: keeps a copy in "Your designs", and plays it right away if it was saved that way.
async function openFile(fileOrBytes) {
  try {
    const { doc, manifest } = await readFile(fileOrBytes);
    doc.id = uid(); doc.updated = Date.now();
    await saveDoc(doc);
    openDoc(doc);
    if (manifest.presentOnOpen) setTimeout(() => present(0, hasNotes()), 300);
    else toast('Design opened');
  } catch (e) {
    console.error(e);
    toast(String(e.message) === 'newer' ? 'This file was made with a newer Deckly: please update' : 'This file could not be opened');
  }
}
