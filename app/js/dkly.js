// The .dkly file: one self-contained Deckly presentation (design, animations, photos, fonts).
// Inside it is a ZIP package:
//   mimetype          "application/vnd.deckly.presentation" (stored first, uncompressed — the file's signature)
//   deckly.json       manifest: format version, title, size, slide count, "open in Present mode"
//   document.json     the slides, with every picture replaced by a "media/…" reference
//   media/…           every picture used (uploads, web photos AND built-in photos), stored once each
//   fonts/…           the custom fonts the design uses
import { libAll, libPut, uid, clone } from './store.js';
import { packs } from './assets.js';

export const MIME = 'application/vnd.deckly.presentation';
export const FORMAT_VERSION = 1;

const extOf = (mime) => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' }[mime] || 'bin');
async function hash(buf) {
  const h = await crypto.subtle.digest('SHA-1', buf);
  return [...new Uint8Array(h)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function toBytes(src) {
  const r = await fetch(src); // works for data: URLs and the app's own assets
  const blob = await r.blob();
  return { buf: await blob.arrayBuffer(), mime: blob.type || 'application/octet-stream' };
}
const b64 = (buf) => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };

// ---------- save ----------
export async function packDkly(doc, { presentOnOpen = false, appVersion = '' } = {}) {
  const zip = new JSZip();
  zip.file('mimetype', MIME, { compression: 'STORE' });
  const d = clone(doc);
  const media = new Map(); // src -> path
  const add = async (src) => {
    if (!src || src.startsWith('media/')) return src;
    if (media.has(src)) return media.get(src);
    const { buf, mime } = await toBytes(src);
    const path = `media/${await hash(buf)}.${extOf(mime)}`;
    if (!zip.file(path)) zip.file(path, buf, { compression: mime === 'image/png' || mime === 'image/svg+xml' ? 'DEFLATE' : 'STORE' });
    media.set(src, path);
    return path;
  };
  for (const s of d.slides) {
    if (s.bg?.type === 'image') s.bg.value = await add(s.bg.value);
    for (const el of s.elements) {
      if (el.type === 'image') { el.src = await add(el.src); if (el.origSrc) el.origSrc = await add(el.origSrc); }
    }
  }
  // custom fonts used by the design (the built-in ones are in every copy of Deckly)
  const used = new Set(d.slides.flatMap((s) => s.elements.filter((e) => e.type === 'text').map((e) => e.font)));
  const fonts = [];
  for (const f of (await libAll()).filter((x) => x.kind === 'font' && used.has(x.name))) {
    const { buf } = await toBytes(f.data);
    const path = `fonts/${f.name.replace(/[^\w\- ]+/g, '')}.font`;
    zip.file(path, buf); fonts.push({ name: f.name, file: path });
  }
  zip.file('deckly.json', JSON.stringify({
    format: 'dkly', formatVersion: FORMAT_VERSION, app: 'Deckly', appVersion, saved: new Date().toISOString(),
    title: d.title, width: d.w, height: d.h, slides: d.slides.length, presentOnOpen: !!presentOnOpen, fonts,
  }, null, 1));
  zip.file('document.json', JSON.stringify(d));
  return zip.generateAsync({ type: 'blob', mimeType: MIME, compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

// ---------- open ----------
// returns { doc, manifest } — the doc has a new id and every picture back inside it, ready to be saved
export async function unpackDkly(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const mt = await zip.file('mimetype')?.async('string');
  const manifest = JSON.parse((await zip.file('deckly.json')?.async('string')) || 'null');
  if (mt !== MIME || !manifest || manifest.format !== 'dkly') throw new Error('not a Deckly file');
  if (manifest.formatVersion > FORMAT_VERSION) throw new Error('newer');
  const doc = JSON.parse(await zip.file('document.json').async('string'));
  const cache = new Map();
  const back = async (ref) => {
    if (!ref || !ref.startsWith('media/')) return ref;
    if (cache.has(ref)) return cache.get(ref);
    const f = zip.file(ref); if (!f) return ref;
    const ext = ref.split('.').pop();
    const mime = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' }[ext] || 'application/octet-stream';
    const url = `data:${mime};base64,${b64(await f.async('arraybuffer'))}`;
    cache.set(ref, url); return url;
  };
  for (const s of doc.slides) {
    if (s.bg?.type === 'image') s.bg.value = await back(s.bg.value);
    for (const el of s.elements) if (el.type === 'image') { el.src = await back(el.src); if (el.origSrc) el.origSrc = await back(el.origSrc); }
  }
  // embedded fonts: install them in this copy of Deckly
  for (const f of manifest.fonts || []) {
    const file = zip.file(f.file); if (!file) continue;
    const data = `data:font/ttf;base64,${b64(await file.async('arraybuffer'))}`;
    try {
      const face = new FontFace(f.name, `url(${data})`); await face.load(); document.fonts.add(face);
      if (!packs.fonts.includes(f.name)) packs.fonts.push(f.name);
      await libPut({ id: 'font-' + f.name, kind: 'font', t: Date.now(), name: f.name, data });
    } catch { /* unreadable font: the text falls back to Inter */ }
  }
  doc.id = uid(); doc.updated = Date.now();
  return { doc, manifest };
}

// Is this file one of ours? (looks at the signature, not the name)
export async function isDkly(buffer) {
  const u = new Uint8Array(buffer.slice(0, 120));
  if (u[0] !== 0x50 || u[1] !== 0x4b) return false; // "PK"
  return new TextDecoder().decode(u).includes(MIME);
}
