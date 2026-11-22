// Document state, undo/redo history and local persistence (IndexedDB — works fully offline).
import { t as tr } from './i18n.js';
export const uid = () => Math.random().toString(36).slice(2, 10);
export const clone = (o) => JSON.parse(JSON.stringify(o));

export const state = {
  doc: null,          // current design
  slide: 0,           // current slide index
  sel: [],            // selected element ids
  editingId: null,    // text element being edited
  zoom: 'fit',        // 'fit' or number
  scale: 1,           // current stage scale
  online: navigator.onLine,
  onlineEnabled: true, // user can force offline mode
};

const listeners = new Set();
export const on = (fn) => listeners.add(fn);
export const emit = (what = 'all') => listeners.forEach((fn) => fn(what));

export const curSlide = () => state.doc.slides[state.slide];
export const findEl = (id) => curSlide().elements.find((e) => e.id === id);
export const selected = () => state.sel.map(findEl).filter(Boolean);

export function newDoc(w = 1920, h = 1080, title = tr('Untitled presentation')) {
  return { id: uid(), title, w, h, created: Date.now(), updated: Date.now(), slides: [newSlide()] };
}
export function newSlide(bg = { type: 'color', value: '#FFFFFF' }) {
  return { id: uid(), bg, elements: [] };
}

// ---------- history ----------
let past = [], future = [], lastSnap = null;
export function resetHistory() { past = []; future = []; lastSnap = JSON.stringify(state.doc); }
export function commit() {
  const snap = JSON.stringify(state.doc);
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
  state.doc = JSON.parse(snap);
  state.slide = Math.min(state.slide, state.doc.slides.length - 1);
  state.sel = state.sel.filter((id) => findEl(id));
  state.editingId = null;
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
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode); const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => res(out?.result ?? out); t.onerror = () => rej(t.error);
  });
}
export const saveDoc = (doc) => tx('docs', 'readwrite', (s) => s.put(doc));
export const loadDoc = (id) => tx('docs', 'readonly', (s) => s.get(id));
export const deleteDoc = (id) => tx('docs', 'readwrite', (s) => s.delete(id));
export const listDocs = () => tx('docs', 'readonly', (s) => s.getAll());
export const libPut = (item) => tx('library', 'readwrite', (s) => s.put(item));
export const libAll = () => tx('library', 'readonly', (s) => s.getAll());
export const libDel = (id) => tx('library', 'readwrite', (s) => s.delete(id));

let saveTimer;
export function scheduleSave() {
  emit('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!state.doc) return;
    try { await saveDoc(state.doc); emit('saved'); } catch (e) { console.error(e); emit('savefail'); }
  }, 500);
}
