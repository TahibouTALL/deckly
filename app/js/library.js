// The element library: 60+ packs (icons, graphics, stickers, flags, logos) loaded one by one when needed,
// the 3D stickers, the letter frames, the "recently used" list, and search across everything.
import { packs } from './assets.js';
import { queryTerms, matches, score } from './search.js';

export const lib = { index: [], names: null, samples: null, loaded: new Map(), loading: new Map(), st3d: null, glyphs: null, emojiFr: null };
const j = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);

export async function initLibrary() {
  const [index, st3d, glyphs] = await Promise.all([j('assets/packs/index.json'), j('assets/stickers3d/index.json'), j('assets/frames/glyphs.json')]);
  lib.index = index || []; lib.st3d = st3d || {}; lib.glyphs = glyphs || {};
  j('assets/packs/samples.json').then((d) => { lib.samples = d || {}; document.dispatchEvent(new Event('packs')); });
}
export const packInfo = (id) => lib.index.find((p) => p.id === id);
export const packsOf = (kind) => lib.index.filter((p) => p.kind === kind);

// French / English labels of the pack styles (the pack ids are technical)
const STYLE_LABELS = {
  'withicons-sticker': 'Stickers', 'withicons-clay': 'Clay', 'withicons-soft3d': 'Soft 3D', 'withicons-plush': 'Plush', 'withicons-pastel': 'Pastel', 'withicons-kawaii': 'Kawaii',
  'withicons-retro': 'Retro', 'withicons-glass': 'Glass', 'withicons-suite': 'Blue', 'withicons-skeuo': 'Realistic', 'withicons-bento': 'Bento', 'withicons-liquid': 'Liquid',
  'withicons-chrome': 'Chrome', 'withicons-luxe': 'Gold', 'withicons-christmas': 'Christmas', 'withicons-halloween': 'Halloween', 'withicons-valentine': 'Valentine',
  'fluent-color': 'Fluent colour', 'flat-color-icons': 'Flat colour', 'glyphs-poly': 'Poly', 'icon-park': 'Two-tone', marketeq: 'Blue line', 'streamline-plump-color': 'Plump',
  'streamline-freehand-color': 'Hand-drawn', 'streamline-ultimate-color': 'Colour line', 'streamline-kameleon-color': 'Kameleon', 'streamline-color': 'Streamline', meteocons: 'Weather',
  tabler: 'Tabler', ph: 'Phosphor', solar: 'Solar', 'material-symbols': 'Material', fluent: 'Fluent', mingcute: 'MingCute', hugeicons: 'Huge', ri: 'Remix', bi: 'Bootstrap',
  iconoir: 'Iconoir', heroicons: 'Hero', carbon: 'Carbon', mynaui: 'Myna', tdesign: 'TDesign', 'icon-park-outline': 'IconPark line', 'icon-park-solid': 'IconPark solid',
  pixelarticons: 'Pixel', healthicons: 'Health', 'game-icons': 'Games & fantasy', pinhead: 'Map pins', temaki: 'Places', maki: 'Map', wi: 'Weather line', lucide: 'Lucide',
  noto: 'Google', twemoji: 'Twitter', 'streamline-emojis': 'Streamline', fxemoji: 'Firefox', 'circle-flags': 'Round flags', flag: 'Flags', 'tabler-flags': 'Flags 2',
  'thesvg-color': 'Brands (colour)', 'simple-icons': 'Brands (one colour)', 'skill-icons': 'Tech', devicon: 'Dev tools', 'cryptocurrency-color': 'Crypto', logos: 'Logos',
};
export const styleLabel = (id) => STYLE_LABELS[id] || packInfo(id)?.name || id;

// a pack's icons: { name: {b, w, h} } — loaded once, kept in memory
export async function loadPack(id) {
  if (id === 'lucide') return packs.lucide;
  if (id === 'stickers') return packs.stickers;
  if (id === 'logos') return packs.logos;
  if (lib.loaded.has(id)) return lib.loaded.get(id);
  if (lib.loading.has(id)) return lib.loading.get(id);
  const p = packInfo(id); if (!p) return {};
  const pr = j('assets/' + p.file).then((d) => { const icons = d?.icons || {}; lib.loaded.set(id, icons); lib.loading.delete(id); if (d?.cats) p.cats = d.cats; return icons; });
  lib.loading.set(id, pr);
  return pr;
}
export const packLoaded = (id) => id === 'lucide' || id === 'stickers' || id === 'logos' || lib.loaded.has(id);
export const iconOf = (id, name) => (id === 'lucide' ? packs.lucide[name] : id === 'stickers' ? packs.stickers[name] : id === 'logos' ? packs.logos[name] : lib.loaded.get(id)?.[name] || lib.samples?.[id]?.[name]);
// the SVG of a pack icon: mono icons take the colour, others are drawn as they are
export function packSvg(id, it, color) {
  if (!it) return '';
  const w = it.w || 24, h = it.h || 24;
  const mono = isMono(id);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${it.x || 0} ${it.y || 0} ${w} ${h}" preserveAspectRatio="xMidYMid meet"${mono ? ` style="color:${String(color || '#1E1F2B').replace(/[^#\w(),.% -]/g, '')}"` : ''}>${it.b}</svg>`;
}
export const isMono = (id) => { const p = packInfo(id); return id === 'lucide' || (p && !p.palette); };

// names index for search (1.6 MB, loaded on the first search)
let namesP = null;
export function loadNames() {
  if (lib.names) return Promise.resolve(lib.names);
  if (!namesP) namesP = Promise.all([j('assets/packs/names.json'), j('assets/packs/emoji-fr.json')]).then(([d, fr]) => { lib.names = d || {}; lib.emojiFr = fr || {}; return lib.names; });
  return namesP;
}
// search a pack by query: returns names sorted by score (bodies may not be loaded yet)
export function searchPackNames(id, q, limit = 60) {
  const terms = queryTerms(q); if (!terms.length) return [];
  const extraFor = (n) => (lib.emojiFr && (id === 'stickers' || id === 'stickers3d' || packInfo(id)?.kind === 'stickers') ? lib.emojiFr[n] || '' : id === 'lucide' ? packs.lucide[n]?.t || '' : '');
  let names;
  if (id === 'lucide') names = Object.keys(packs.lucide);
  else if (id === 'stickers' || id === 'stickers3d') names = Object.keys(id === 'stickers' ? packs.stickers : lib.st3d || {});
  else if (id === 'logos') names = Object.keys(packs.logos);
  else names = (lib.names?.[id] || '').split(' ');
  const out = [];
  for (const n of names) if (n && matches(n, terms, extraFor(n))) { out.push([n, score(n, terms, extraFor(n))]); }
  out.sort((a, b) => b[1] - a[1]);
  return out.slice(0, limit).map((x) => x[0]);
}
// the packs searched by default for each kind (the others on demand: a pack costs 1-7 MB to load)
export const DEFAULT_PACKS = { icons: ['lucide', 'tabler', 'ph', 'solar', 'material-symbols'], graphics: ['withicons-sticker', 'fluent-color', 'flat-color-icons', 'withicons-clay'], stickers: ['stickers', 'stickers3d', 'noto'], flags: ['circle-flags', 'flag'], logos: ['logos', 'thesvg-color', 'simple-icons'] };

// ---------- 3D stickers ----------
export const sticker3dUrl = (name) => `assets/stickers3d/${name}.webp`;
export const sticker3dCats = () => [...new Set(Object.values(lib.st3d || {}))];

// ---------- recently used ----------
const RK = 'deckly-recent';
export function recent() { try { return JSON.parse(localStorage.getItem(RK) || '[]'); } catch { return []; } }
export function remember(item) {
  if (!item || item.k === 'text' || item.k === 'combo') return;
  try {
    const key = JSON.stringify({ ...item, data: undefined });
    const list = recent().filter((x) => JSON.stringify({ ...x, data: undefined }) !== key);
    list.unshift(item);
    localStorage.setItem(RK, JSON.stringify(list.slice(0, 24)));
  } catch { /* storage full or blocked */ }
}
