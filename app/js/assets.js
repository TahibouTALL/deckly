// The built-in element library (all stored locally in app/assets) + UI icon helper.
// The big packs (60+ of them) are loaded on demand by library.js.
import { SHAPES, FRAMES, shapeSvg, clipPathFor } from './shapes.js';
export { SHAPES, FRAMES, shapeSvg, clipPathFor };

export const packs = { lucide: {}, stickers: {}, stickerCats: {}, logos: {}, fonts: [], fontMeta: [], photos: [], allPhotos: [] };

export async function loadPacks() {
  const j = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [lucide, fonts, photos] = await Promise.all([
    j('assets/icons/lucide.json'), j('assets/fonts/fonts.json'), j('assets/photos/photos.json'),
  ]);
  packs.lucide = lucide || {}; packs.allPhotos = photos || []; packs.photos = packs.allPhotos.filter((p) => !p.legacy);
  const meta = Array.isArray(fonts) ? fonts.map((f) => (typeof f === 'string' ? { name: f, cat: 'sans' } : f)) : [{ name: 'Inter', cat: 'sans' }];
  packs.fontMeta = meta; packs.fonts = meta.map((f) => f.name);
  // The bigger packs load in the background.
  j('assets/icons/stickers.json').then((d) => { packs.stickers = d || {}; document.dispatchEvent(new Event('packs')); });
  j('assets/icons/logos.json').then((d) => { packs.logos = d || {}; document.dispatchEvent(new Event('packs')); });
}
export const fontCat = (name) => packs.fontMeta.find((f) => f.name === name)?.cat || 'custom';

// UI icons (Lucide)
export function ic(name, cls = 'ic') {
  const i = packs.lucide[name] || packs.lucide['circle'];
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${i ? i.b : ''}</svg>`;
}
export function hydrateIcons(root = document) {
  root.querySelectorAll('i[data-ic]').forEach((n) => { n.outerHTML = ic(n.dataset.ic); });
}

const safe = (c) => String(c || '#1E1F2B').replace(/[^#\w(),.% -]/g, '');
export const lucideSvg = (name, color = '#1E1F2B', sw = 2) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${safe(color)}" stroke-width="${+sw || 2}" stroke-linecap="round" stroke-linejoin="round" preserveAspectRatio="none">${packs.lucide[name]?.b || ''}</svg>`;
export const iconifySvg = (it) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${it.x || 0} ${it.y || 0} ${it.w || 32} ${it.h || 32}" preserveAspectRatio="xMidYMid meet">${it.b}</svg>`;

// ---------- colours ----------
export const PALETTE = ['#FFFFFF', '#F3F4F8', '#D9DBE6', '#9295A8', '#5B5E73', '#2E3040', '#000000',
  '#FF5A5F', '#FF8A3D', '#FFC83D', '#2EC27E', '#1FB5A6', '#3D8BFF', '#6C4CF5',
  '#FFD6D8', '#FFE2CC', '#FFF1C2', '#CFF5E2', '#C8F1EC', '#D4E5FF', '#E3DBFF',
  '#B4232A', '#B85A12', '#9C7400', '#127A4C', '#0E6B62', '#1C4FA8', '#3D23A6',
  '#FF6B8B', '#E64CA3', '#B455E8', '#0F1B3D', '#F5EBDD', '#C8A97E', '#14213D'];
export const GRADIENTS = [
  'linear-gradient(135deg,#6C4CF5,#FF6B8B)', 'linear-gradient(135deg,#43CEA2,#185A9D)', 'linear-gradient(135deg,#FF9A8B,#FF6A88,#FF99AC)',
  'linear-gradient(135deg,#FDC830,#F37335)', 'linear-gradient(135deg,#0F2027,#203A43,#2C5364)', 'linear-gradient(135deg,#A8EDEA,#FED6E3)',
  'linear-gradient(135deg,#667EEA,#764BA2)', 'linear-gradient(135deg,#F6D365,#FDA085)', 'linear-gradient(135deg,#84FAB0,#8FD3F4)',
  'linear-gradient(135deg,#232526,#414345)', 'linear-gradient(135deg,#E0C3FC,#8EC5FC)', 'linear-gradient(135deg,#FA709A,#FEE140)',
  'linear-gradient(180deg,#141E30,#243B55)', 'linear-gradient(135deg,#FFECD2,#FCB69F)', 'radial-gradient(circle at 30% 30%,#FFFFFF,#E3DBFF)',
  'linear-gradient(135deg,#11998E,#38EF7D)', 'linear-gradient(135deg,#FC466B,#3F5EFB)', 'linear-gradient(135deg,#F5F7FA,#C3CFE2)',
  'linear-gradient(135deg,#1A2A6C,#B21F1F,#FDBB2D)', 'linear-gradient(160deg,#0B0B1A,#2A1B5C 60%,#6C4CF5)', 'linear-gradient(135deg,#FFF6E5,#FFE0E9)',
];
// background patterns (drawn in CSS, no file needed)
export const PATTERNS = [
  ['Dots', (c, b) => `background-color:${b};background-image:radial-gradient(${c} 2px, transparent 2.5px);background-size:28px 28px`],
  ['Grid', (c, b) => `background-color:${b};background-image:linear-gradient(${c} 1px, transparent 1px),linear-gradient(90deg, ${c} 1px, transparent 1px);background-size:48px 48px`],
  ['Stripes', (c, b) => `background:repeating-linear-gradient(45deg, ${b}, ${b} 18px, ${c} 18px, ${c} 20px)`],
  ['Lines', (c, b) => `background:repeating-linear-gradient(0deg, ${b}, ${b} 30px, ${c} 30px, ${c} 32px)`],
  ['Checks', (c, b) => `background-color:${b};background-image:linear-gradient(45deg, ${c} 25%, transparent 25%),linear-gradient(-45deg, ${c} 25%, transparent 25%),linear-gradient(45deg, transparent 75%, ${c} 75%),linear-gradient(-45deg, transparent 75%, ${c} 75%);background-size:60px 60px;background-position:0 0,0 30px,30px -30px,-30px 0`],
  ['Cross dots', (c, b) => `background-color:${b};background-image:radial-gradient(${c} 1.5px, transparent 2px),radial-gradient(${c} 1.5px, ${b} 2px);background-size:36px 36px;background-position:0 0,18px 18px`],
  ['Waves', (c, b) => `background-color:${b};background-image:radial-gradient(circle at 50% 120%, transparent 60%, ${c} 61%, ${c} 63%, transparent 64%);background-size:80px 40px`],
  ['Zigzag', (c, b) => `background:linear-gradient(135deg, ${c} 25%, transparent 25%) -20px 0, linear-gradient(225deg, ${c} 25%, transparent 25%) -20px 0, linear-gradient(315deg, ${c} 25%, transparent 25%), linear-gradient(45deg, ${c} 25%, transparent 25%);background-size:40px 40px;background-color:${b}`],
  ['Diagonal', (c, b) => `background:repeating-linear-gradient(-45deg, ${b}, ${b} 40px, ${c} 40px, ${c} 42px)`],
  ['Triangles', (c, b) => `background-color:${b};background-image:linear-gradient(60deg, ${c} 25%, transparent 25.5%, transparent 75%, ${c} 75%),linear-gradient(120deg, ${c} 25%, transparent 25.5%, transparent 75%, ${c} 75%);background-size:60px 104px`],
  ['Honeycomb', (c, b) => `background-color:${b};background-image:radial-gradient(circle farthest-side at 0% 50%, ${b} 23.5%, transparent 0) 21px 30px,radial-gradient(circle farthest-side at 0% 50%, ${c} 24%, transparent 0) 19px 30px,linear-gradient(${b} 14%, transparent 0, transparent 85%, ${b} 0) 0 0,linear-gradient(150deg, ${b} 24%, ${c} 0, ${c} 26%, transparent 0, transparent 74%, ${c} 0, ${c} 76%, ${b} 0) 0 0,linear-gradient(30deg, ${b} 24%, ${c} 0, ${c} 26%, transparent 0, transparent 74%, ${c} 0, ${c} 76%, ${b} 0) 0 0,linear-gradient(90deg, ${c} 2%, ${b} 0, ${b} 98%, ${c} 0%) 0 0;background-size:40px 60px`],
  ['Confetti', (c, b) => `background-color:${b};background-image:radial-gradient(${c} 3px, transparent 3.5px),radial-gradient(#FFC83D 3px, transparent 3.5px),radial-gradient(#FF6B8B 3px, transparent 3.5px);background-size:90px 90px,120px 120px,70px 70px;background-position:0 0,30px 40px,50px 10px`],
];
export const isLight = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return true;
  const n = parseInt(m[1], 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
};
export const photoUrl = (p) => `assets/photos/${p.file}`;
export function photoBy(cat, i = 0) {
  const list = packs.photos.filter((p) => p.cat === cat);
  const all = list.length ? list : packs.photos;
  return all.length ? photoUrl(all[i % all.length]) : null;
}
