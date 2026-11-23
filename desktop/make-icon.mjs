// The Deckly brand, drawn from one source of truth: the mark (a geometric D made of stacked slides — a deck)
// and the wordmark (Plus Jakarta Sans ExtraBold, SIL OFL, converted to outlines so no font is needed).
// Writes: app/assets/brand/*.svg, desktop/icon.png (app icon), desktop/dkly.ico (.dkly files), docs/img/logo-*.png
// Run: npm run icon
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const brandDir = path.join(root, 'app', 'assets', 'brand');
fs.mkdirSync(brandDir, { recursive: true });
const opentype = createRequire(path.join(root, 'tools', 'package.json'))('opentype.js');

// ---------- the mark ----------
export const GRAD = ['#6C4CF5', '#9A4FEF', '#FF6B8B'];
const grad = (id = 'dg') => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${GRAD[0]}"/><stop offset=".55" stop-color="${GRAD[1]}"/><stop offset="1" stop-color="${GRAD[2]}"/></linearGradient>`;
const Dout = 'M0 0 H150 A126 126 0 0 1 150 252 H0 Z';
const Dfull = 'M0 0 H150 A126 126 0 0 1 150 252 H0 Z M66 66 V186 H146 A60 60 0 0 0 146 66 Z';
// the D with two slide edges peeking out behind it (a deck); `ink` = colour of the D, `edge` = colour of the edges
function deckD(ink, edge, p = '') {
  return `<defs><mask id="m1${p}"><rect width="512" height="512" fill="#fff"/><path transform="translate(150 130)" d="${Dout}" fill="#000"/></mask><mask id="m2${p}"><rect width="512" height="512" fill="#fff"/><path transform="translate(150 130)" d="${Dout}" fill="#000"/><path transform="translate(170 110)" d="${Dout}" fill="#000"/></mask></defs>`
    + `<path transform="translate(190 90)" d="${Dout}" fill="${edge}" opacity=".28" mask="url(#m2${p})"/><path transform="translate(170 110)" d="${Dout}" fill="${edge}" opacity=".58" mask="url(#m1${p})"/><path transform="translate(150 130)" d="${Dfull}" fill="${ink}" fill-rule="evenodd"/>`;
}
// app icon: gradient tile + white deck-D
export const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${grad()}</defs><rect width="512" height="512" rx="118" fill="url(#dg)"/>${deckD('#fff', '#fff')}</svg>`;
// the mark alone, in the brand gradient, for light backgrounds (no tile)
export const markFlatSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="60 40 420 420"><defs>${grad()}</defs>${deckD('url(#dg)', GRAD[0], 'f')}</svg>`;
// one-colour version (currentColor) for small UI uses
export const markMonoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="60 40 420 420">${deckD('currentColor', 'currentColor', 'm')}</svg>`;

// ---------- the wordmark ----------
const fb = fs.readFileSync(path.join(root, 'tools', 'fonts', 'PlusJakartaSans-800.ttf'));
const font = opentype.parse(fb.buffer.slice(fb.byteOffset, fb.byteOffset + fb.byteLength));
function textPath(text, size, ls) {
  const k = size / font.unitsPerEm; let x = 0; const parts = []; let prev = null;
  for (const ch of text) { const g = font.charToGlyph(ch); if (prev) x += font.getKerningValue(prev, g) * k; parts.push(g.getPath(x, 0, size).toPathData(2)); x += g.advanceWidth * k + ls * size; prev = g; }
  return { d: parts.join(' '), w: x - ls * size, asc: font.ascender * k, desc: -font.descender * k, cap: (font.tables.os2?.sCapHeight || font.ascender * 0.7) * k };
}
const W = textPath('Deckly', 100, -0.03);
// wordmark on its own (cap height 70 in a 100-high box)
const wmH = 100, wmBase = 82;
export const wordmarkSvg = (fill = '#14152B') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(W.w) + 4} ${wmH}"><path transform="translate(2 ${wmBase})" d="${W.d}" fill="${fill}"/></svg>`;
// horizontal lock-up: mark (tile) + wordmark, mark height = 100, gap 26
export const logoSvg = (fill = '#14152B') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(W.w) + 134} 100"><defs>${grad('lg')}</defs><g transform="scale(${100 / 512})"><rect width="512" height="512" rx="118" fill="url(#lg)"/>${deckD('#fff', '#fff', 'l')}</g><path transform="translate(128 ${wmBase - 1})" d="${W.d}" fill="${fill}"/></svg>`;

// ---------- files ----------
const png = (svg, w) => new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng();
fs.writeFileSync(path.join(brandDir, 'mark.svg'), markSvg);
fs.writeFileSync(path.join(brandDir, 'mark-flat.svg'), markFlatSvg);
fs.writeFileSync(path.join(brandDir, 'mark-mono.svg'), markMonoSvg);
fs.writeFileSync(path.join(brandDir, 'wordmark.svg'), wordmarkSvg());
fs.writeFileSync(path.join(brandDir, 'wordmark-white.svg'), wordmarkSvg('#FFFFFF'));
fs.writeFileSync(path.join(brandDir, 'logo.svg'), logoSvg());
fs.writeFileSync(path.join(brandDir, 'logo-white.svg'), logoSvg('#FFFFFF'));
fs.writeFileSync(path.join(here, 'icon.png'), png(markSvg, 512));
fs.writeFileSync(path.join(brandDir, 'mark-256.png'), png(markSvg, 256));
const docsImg = path.join(root, 'docs', 'img');
if (fs.existsSync(docsImg)) {
  fs.writeFileSync(path.join(docsImg, 'icon.png'), png(markSvg, 512));
  fs.writeFileSync(path.join(docsImg, 'logo.png'), png(logoSvg(), 1200));
  fs.writeFileSync(path.join(docsImg, 'logo-white.png'), png(logoSvg('#FFFFFF'), 1200));
}
console.log('brand: mark, wordmark, logo written');

// The icon of .dkly files in Windows Explorer: a page with a folded corner and the Deckly mark on it.
// Saved as desktop/dkly.ico (PNG images at 256, 64, 48, 32 and 16 px inside one .ico file).
const docSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs>${grad('fg')}</defs>
  <path d="M52 12 H168 L212 56 V230 Q212 244 198 244 H52 Q38 244 38 230 V26 Q38 12 52 12 Z" fill="#fff" stroke="#D9DBE6" stroke-width="4"/>
  <path d="M168 12 V44 Q168 56 180 56 H212 Z" fill="#E3DBFF"/>
  <g transform="translate(70 78) scale(${116 / 512})"><rect width="512" height="512" rx="118" fill="url(#fg)"/>${deckD('#fff', '#fff', 'd')}</g>
  <path transform="translate(70 206) scale(0.22)" d="${W.d}" fill="#4B2FD6"/>
</svg>`;
const sizes = [256, 64, 48, 32, 16];
const pngs = sizes.map((s) => png(docSvg, s));
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, i) => {
  const e = 6 + i * 16;
  head.writeUInt8(s >= 256 ? 0 : s, e); head.writeUInt8(s >= 256 ? 0 : s, e + 1);
  head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(pngs[i].length, e + 8); head.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
fs.writeFileSync(path.join(here, 'dkly.ico'), Buffer.concat([head, ...pngs]));
fs.writeFileSync(path.join(here, 'dkly-256.png'), pngs[0]);
if (fs.existsSync(docsImg)) fs.writeFileSync(path.join(docsImg, 'dkly-file.png'), png(docSvg, 512));
// a preview sheet for checking
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="420"><rect width="100%" height="100%" fill="#F3F4F8"/>
  <image href="data:image/png;base64,${png(markSvg, 160).toString('base64')}" x="30" y="30" width="160" height="160"/>
  <image href="data:image/png;base64,${png(markSvg, 32).toString('base64')}" x="30" y="210" width="32" height="32"/>
  <image href="data:image/png;base64,${png(markSvg, 16).toString('base64')}" x="72" y="218" width="16" height="16"/>
  <image href="data:image/png;base64,${png(logoSvg(), 560).toString('base64')}" x="220" y="60" width="560" height="${560 * 100 / (Math.ceil(W.w) + 134)}"/>
  <rect x="220" y="200" width="560" height="110" rx="14" fill="#14152B"/>
  <image href="data:image/png;base64,${png(logoSvg('#FFFFFF'), 440).toString('base64')}" x="280" y="215" width="440" height="${440 * 100 / (Math.ceil(W.w) + 134)}"/>
  <image href="data:image/png;base64,${png(docSvg, 128).toString('base64')}" x="30" y="260" width="128" height="128"/>
  <image href="data:image/png;base64,${png(docSvg, 32).toString('base64')}" x="170" y="300" width="32" height="32"/>
  <image href="data:image/png;base64,${png(markFlatSvg, 100).toString('base64')}" x="240" y="320" width="100" height="100"/>
</svg>`;
fs.writeFileSync(path.join(here, 'brand-preview.png'), new Resvg(sheet).render().asPng());
console.log('desktop/icon.png, desktop/dkly.ico, brand-preview.png written');
