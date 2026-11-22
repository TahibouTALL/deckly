// The built-in element library (all stored locally in app/assets) + UI icon helper.
export const packs = { lucide: {}, stickers: {}, logos: {}, fonts: [], photos: [] };

export async function loadPacks() {
  const j = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [lucide, fonts, photos] = await Promise.all([
    j('assets/icons/lucide.json'), j('assets/fonts/fonts.json'), j('assets/photos/photos.json'),
  ]);
  packs.lucide = lucide || {}; packs.fonts = fonts || ['Inter']; packs.photos = photos || [];
  // The bigger packs load in the background.
  j('assets/icons/stickers.json').then((d) => { packs.stickers = d || {}; document.dispatchEvent(new Event('packs')); });
  j('assets/icons/logos.json').then((d) => { packs.logos = d || {}; document.dispatchEvent(new Event('packs')); });
}

// UI icons (Lucide)
export function ic(name, cls = 'ic') {
  const i = packs.lucide[name] || packs.lucide['circle'];
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${i ? i.b : ''}</svg>`;
}
export function hydrateIcons(root = document) {
  root.querySelectorAll('i[data-ic]').forEach((n) => { n.outerHTML = ic(n.dataset.ic); });
}

export const lucideSvg = (name, color = '#1E1F2B', sw = 2) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" preserveAspectRatio="none">${packs.lucide[name]?.b || ''}</svg>`;
export const iconifySvg = (it) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${it.w || 32} ${it.h || 32}" preserveAspectRatio="xMidYMid meet">${it.b}</svg>`;

// ---------- shapes (viewBox 0 0 100 100) ----------
const poly = (n, r = 50, rot = -90, cx = 50, cy = 50) =>
  Array.from({ length: n }, (_, i) => { const a = (rot + (360 / n) * i) * Math.PI / 180; return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`; }).join(' ');
const star = (n, ro = 50, ri = 22) =>
  Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? ri : ro; const a = (-90 + (180 / n) * i) * Math.PI / 180; return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`; }).join(' ');

export const SHAPES = {
  rect: { name: 'Square', css: true },
  rounded: { name: 'Rounded square', css: true, radius: 18 },
  circle: { name: 'Circle', css: true, circle: true },
  triangle: { name: 'Triangle', d: 'M50 2 L98 98 L2 98 Z' },
  rtriangle: { name: 'Right triangle', d: 'M2 2 L98 98 L2 98 Z' },
  diamond: { name: 'Diamond', d: 'M50 1 L99 50 L50 99 L1 50 Z' },
  pentagon: { name: 'Pentagon', pts: poly(5) },
  hexagon: { name: 'Hexagon', pts: poly(6, 50, 0) },
  octagon: { name: 'Octagon', pts: poly(8, 50, 22.5) },
  star5: { name: 'Star', pts: star(5, 50, 21) },
  star4: { name: 'Sparkle', d: 'M50 0 C54 38 62 46 100 50 C62 54 54 62 50 100 C46 62 38 54 0 50 C38 46 46 38 50 0 Z' },
  burst: { name: 'Burst', pts: star(12, 50, 38) },
  heart: { name: 'Heart', d: 'M50 92 C20 70 2 52 2 30 C2 14 14 4 28 4 C38 4 46 10 50 18 C54 10 62 4 72 4 C86 4 98 14 98 30 C98 52 80 70 50 92 Z' },
  arrowR: { name: 'Arrow', d: 'M2 34 L60 34 L60 10 L98 50 L60 90 L60 66 L2 66 Z' },
  arrowL: { name: 'Arrow left', d: 'M98 34 L40 34 L40 10 L2 50 L40 90 L40 66 L98 66 Z' },
  chevron: { name: 'Chevron', d: 'M2 2 L70 2 L98 50 L70 98 L2 98 L30 50 Z' },
  pentArrow: { name: 'Tag', d: 'M2 2 L75 2 L98 50 L75 98 L2 98 Z' },
  plus: { name: 'Plus', d: 'M36 2 H64 V36 H98 V64 H64 V98 H36 V64 H2 V36 H36 Z' },
  parallelogram: { name: 'Parallelogram', d: 'M25 2 L98 2 L75 98 L2 98 Z' },
  trapezoid: { name: 'Trapezoid', d: 'M22 2 L78 2 L98 98 L2 98 Z' },
  bubble: { name: 'Speech bubble', d: 'M12 4 H88 Q98 4 98 14 V62 Q98 72 88 72 H40 L18 96 L22 72 H12 Q2 72 2 62 V14 Q2 4 12 4 Z' },
  cloudy: { name: 'Thought cloud', d: 'M27 80 C10 80 2 68 6 56 C-2 46 6 30 20 32 C22 14 42 8 54 18 C64 6 86 10 88 28 C100 32 102 52 90 58 C96 72 82 84 68 78 C60 90 38 92 27 80 Z' },
  arch: { name: 'Arch', d: 'M2 98 V50 A48 48 0 0 1 98 50 V98 Z' },
  half: { name: 'Half circle', d: 'M2 98 A48 48 0 0 1 98 98 Z' },
  quarter: { name: 'Quarter circle', d: 'M2 98 V2 A96 96 0 0 1 98 98 Z' },
  ring: { name: 'Ring', d: 'M50 2 A48 48 0 1 0 50.01 2 Z M50 26 A24 24 0 1 1 49.99 26 Z', evenodd: true },
  blob1: { name: 'Blob', d: 'M70 8 C88 16 98 36 94 56 C90 78 72 96 48 94 C24 92 6 76 4 52 C2 28 22 6 44 4 C54 3 62 4 70 8 Z' },
  blob2: { name: 'Pebble', d: 'M60 4 C84 6 100 28 96 52 C92 74 80 98 52 96 C26 94 2 82 4 54 C6 26 30 2 60 4 Z' },
  wave: { name: 'Wave band', d: 'M0 30 C20 10 40 10 50 30 C60 50 80 50 100 30 V100 H0 Z' },
  cross: { name: 'Cross', d: 'M20 2 L50 32 L80 2 L98 20 L68 50 L98 80 L80 98 L50 68 L20 98 L2 80 L32 50 L2 20 Z' },
  line: { name: 'Line', line: true },
  arrowLine: { name: 'Arrow line', line: true, arrow: true },
  dashLine: { name: 'Dashed line', line: true, dash: true },
  dotLine: { name: 'Dotted line', line: true, dot: true },
};
export const FRAMES = ['rect', 'rounded', 'circle', 'blob1', 'blob2', 'heart', 'hexagon', 'star5', 'arch', 'diamond', 'triangle', 'bubble'];

export function shapeSvg(key, fill, stroke = 'none', sw = 0, extra = '') {
  const s = SHAPES[key] || SHAPES.rect;
  const st = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" vector-effect="non-scaling-stroke" stroke-linejoin="round"`;
  let body;
  if (s.circle) body = `<ellipse cx="50" cy="50" rx="50" ry="50" ${st}/>`;
  else if (s.css) body = `<rect x="0" y="0" width="100" height="100" rx="${s.radius || 0}" ${st}/>`;
  else if (s.pts) body = `<polygon points="${s.pts}" ${st}/>`;
  else body = `<path d="${s.d}" ${st} ${s.evenodd ? 'fill-rule="evenodd"' : ''}/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" ${extra}>${body}</svg>`;
}
export function clipPathFor(key) {
  const s = SHAPES[key];
  if (!s || key === 'rect') return '';
  if (s.circle) return 'ellipse(50% 50% at 50% 50%)';
  if (s.css) return `inset(0 round ${s.radius || 0}%)`;
  if (s.pts) return `polygon(${s.pts.split(' ').map((p) => p.split(',').map((v) => v + '%').join(' ')).join(',')})`;
  return `path-${key}`; // handled with an SVG clipPath
}

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
