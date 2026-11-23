// Document state, undo/redo history and local persistence (IndexedDB — works fully offline).
import { t as tr } from './i18n.js';
import { sanitizeHtml, safeColor } from './sanitize.js';
import { lineFromShape } from './elements/line.js';
export const uid = () => Math.random().toString(36).slice(2, 10);
export const clone = (o) => JSON.parse(JSON.stringify(o));

export const state = {
  doc: null,          // current design
  slide: 0,           // current slide index
  sel: [],            // selected element ids
  editingId: null,    // text element being edited
  cell: null,         // table cell being edited { id, r, c }
  tool: null,         // 'draw' while drawing
  zoom: 'fit',        // 'fit' or number
  scale: 1,           // current stage scale
  online: navigator.onLine,
  onlineEnabled: true, // user can force offline mode
};

const listeners = new Set();
export const on = (fn) => listeners.add(fn);
export const emit = (what = 'all', detail) => listeners.forEach((fn) => fn(what, detail));

export const curSlide = () => state.doc.slides[state.slide];
export const findEl = (id) => curSlide().elements.find((e) => e.id === id);
export const selected = () => state.sel.map(findEl).filter(Boolean);

export function newDoc(w = 1920, h = 1080, title = tr('Untitled presentation')) {
  return { id: uid(), title, w, h, created: Date.now(), updated: Date.now(), slides: [newSlide()] };
}
export function newSlide(bg = { type: 'color', value: '#FFFFFF' }) {
  return { id: uid(), bg, elements: [] };
}

// ---------- documents from outside (files, old versions, the clipboard, Claude) are checked and repaired ----------
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
export function normalizeDoc(doc) {
  if (!doc || typeof doc !== 'object') throw new Error('not a document');
  doc.id = typeof doc.id === 'string' ? doc.id : uid();
  doc.title = String(doc.title || tr('Untitled presentation')).slice(0, 200);
  doc.w = Math.min(8000, Math.max(100, num(doc.w, 1920))); doc.h = Math.min(8000, Math.max(100, num(doc.h, 1080)));
  if (!Array.isArray(doc.slides) || !doc.slides.length) doc.slides = [newSlide()];
  doc.slides = doc.slides.filter((s) => s && typeof s === 'object').map((s) => normalizeSlide(s));
  if (!doc.slides.length) doc.slides = [newSlide()];
  return doc;
}
function normalizeSlide(s) {
  s.id = typeof s.id === 'string' ? s.id : uid();
  if (!s.bg || typeof s.bg !== 'object') s.bg = { type: 'color', value: '#FFFFFF' };
  if (!['color', 'gradient', 'image', 'pattern'].includes(s.bg.type)) s.bg = { type: 'color', value: '#FFFFFF' };
  if (s.bg.type !== 'image') s.bg.value = safeColor(s.bg.value, '#FFFFFF');
  if (typeof s.notes !== 'string') delete s.notes;
  s.elements = (Array.isArray(s.elements) ? s.elements : []).filter((e) => e && typeof e === 'object' && typeof e.type === 'string').map(normalizeEl);
  return s;
}
function normalizeEl(e) {
  e.id = typeof e.id === 'string' ? e.id : uid();
  for (const k of ['x', 'y', 'w', 'h']) e[k] = num(e[k]);
  e.rot = num(e.rot); e.opacity = Math.min(1, Math.max(0, num(e.opacity, 1)));
  if (e.type === 'shape' && /^(line|arrowLine|dashLine|dotLine)$/.test(e.shape)) return lineFromShape(e);
  if (e.type === 'text') { e.html = sanitizeHtml(e.html ?? e.text ?? ''); e.size = Math.min(800, Math.max(4, num(e.size, 32))); }
  if (e.type === 'shape' && e.text) e.text.html = sanitizeHtml(e.text.html);
  if (e.type === 'table') {
    e.rows = Math.max(1, Math.min(60, num(e.rows, 1))); e.cols = Math.max(1, Math.min(20, num(e.cols, 1)));
    e.cells = Array.from({ length: e.rows }, (_, r) => Array.from({ length: e.cols }, (_, c) => ({ ...(e.cells?.[r]?.[c] || {}), h: sanitizeHtml(e.cells?.[r]?.[c]?.h || '') })));
    if (!Array.isArray(e.colW) || e.colW.length !== e.cols) e.colW = Array(e.cols).fill(1 / e.cols);
    if (!Array.isArray(e.rowH) || e.rowH.length !== e.rows) e.rowH = Array(e.rows).fill(e.h / e.rows || 60);
    e.style = e.style && typeof e.style === 'object' ? e.style : {};
  }
  if (e.type === 'chart') { e.labels = (Array.isArray(e.labels) ? e.labels : []).map((l) => String(l).slice(0, 80)); e.series = (Array.isArray(e.series) ? e.series : []).map((s) => ({ name: String(s?.name || '').slice(0, 80), values: (Array.isArray(s?.values) ? s.values : []).map((v) => num(v)), color: s?.color })); e.opts = e.opts && typeof e.opts === 'object' ? e.opts : {}; }
  if (e.type === 'qr') e.text = String(e.text || '').slice(0, 1500);
  if (e.type === 'draw') e.d = String(e.d || '').replace(/[^MLQCZmlqcz0-9 .,-]/g, '');
  if (e.type === 'line') { if (!Array.isArray(e.a)) e.a = [0, 0.5]; if (!Array.isArray(e.b)) e.b = [1, 0.5]; }
  return e;
}

// ---------- history ----------
// Snapshots are JSON of the document, with every big picture replaced by a short reference: the pictures live
// once in memory, so 120 undo steps of a design full of photos stay light.
const media = new Map(), mediaIds = new Map();
const isBig = (s) => typeof s === 'string' && s.length > 1500 && s.startsWith('data:');
const refOf = (s) => { let id = mediaIds.get(s); if (!id) { id = `@m${mediaIds.size + 1}@`; mediaIds.set(s, id); media.set(id, s); } return id; };
function packDoc(doc) {
  const light = { ...doc, slides: doc.slides.map((s) => ({
    ...s,
    bg: s.bg?.type === 'image' && isBig(s.bg.value) ? { ...s.bg, value: refOf(s.bg.value) } : s.bg,
    elements: s.elements.map((e) => (isBig(e.src) || isBig(e.origSrc) ? { ...e, src: isBig(e.src) ? refOf(e.src) : e.src, origSrc: isBig(e.origSrc) ? refOf(e.origSrc) : e.origSrc } : e)),
  })) };
  return JSON.stringify(light);
}
function unpackDoc(snap) {
  const d = JSON.parse(snap);
  const back = (v) => (typeof v === 'string' && v.startsWith('@m') && media.has(v) ? media.get(v) : v);
  for (const s of d.slides) { if (s.bg?.type === 'image') s.bg.value = back(s.bg.value); for (const e of s.elements) { if (e.src) e.src = back(e.src); if (e.origSrc) e.origSrc = back(e.origSrc); } }
  return d;
}
let past = [], future = [], lastSnap = null;
export function resetHistory() { past = []; future = []; lastSnap = packDoc(state.doc); }
export function commit() {
  const snap = packDoc(state.doc);
  if (snap === lastSnap) return;
  if (lastSnap) past.push(lastSnap);
  if (past.length > 120) past.shift();
  future = []; lastSnap = snap;
  state.doc.updated = Date.now();
  scheduleSave();
  emit('history');
}
export function undo() {
  if (!past.length) return;
  future.push(lastSnap); lastSnap = past.pop();
  restore(lastSnap);
}
export function redo() {
  if (!future.length) return;
  past.push(lastSnap); lastSnap = future.pop();
  restore(lastSnap);
}
function restore(snap) {
  state.doc = unpackDoc(snap);
  state.slide = Math.min(state.slide, state.doc.slides.length - 1);
  state.sel = state.sel.filter((id) => findEl(id));
  state.editingId = null; state.cell = null;
  scheduleSave();
  emit('all');
}
export const canUndo = () => past.length > 0;
export const canRedo = () => future.length > 0;

// ---------- IndexedDB ----------
let dbp;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open('deckly', 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('docs')) d.createObjectStore('docs', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('library')) d.createObjectStore('library', { keyPath: 'id' });
    };
    r.onsuccess = () => { const d = r.result; d.onversionchange = () => d.close(); res(d); };
    r.onerror = () => { dbp = null; rej(r.error); };
    r.onblocked = () => { dbp = null; rej(new Error('blocked')); };
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode); const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => res(out?.result ?? out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('aborted'));
  });
}
export const saveDoc = (doc) => tx('docs', 'readwrite', (s) => s.put(doc));
export const loadDoc = (id) => tx('docs', 'readonly', (s) => s.get(id));
export const deleteDoc = (id) => tx('docs', 'readwrite', (s) => s.delete(id));
export const listDocs = () => tx('docs', 'readonly', (s) => s.getAll());
export const libPut = (item) => tx('library', 'readwrite', (s) => s.put(item));
export const libAll = () => tx('library', 'readonly', (s) => s.getAll());
export const libDel = (id) => tx('library', 'readwrite', (s) => s.delete(id));

let saveTimer, pendingDoc = null;
export function scheduleSave() {
  emit('saving');
  clearTimeout(saveTimer);
  pendingDoc = state.doc;
  saveTimer = setTimeout(flushSave, 500);
}
// saves right away whatever is waiting (used before closing, switching document or installing an update)
export async function flushSave() {
  clearTimeout(saveTimer);
  const d = pendingDoc; pendingDoc = null;
  if (!d) return;
  try { await saveDoc(d); emit('saved'); } catch (e) { console.error(e); emit('savefail'); setTimeout(() => { if (!pendingDoc) { pendingDoc = d; saveTimer = setTimeout(flushSave, 3000); } }, 0); }
}
window.addEventListener('beforeunload', () => { if (pendingDoc) { try { saveDoc(pendingDoc); } catch { /* */ } } });
