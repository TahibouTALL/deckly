// Draws the Deckly icon (desktop/icon.png, 512 px) from SVG. Run: npm run icon
import fs from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6C4CF5"/><stop offset=".55" stop-color="#B455E8"/><stop offset="1" stop-color="#FF6B8B"/></linearGradient></defs>
  <rect x="16" y="16" width="480" height="480" rx="120" fill="url(#g)"/>
  <rect x="112" y="136" width="288" height="196" rx="34" fill="#fff"/>
  <rect x="152" y="180" width="130" height="24" rx="12" fill="#6C4CF5"/>
  <rect x="152" y="224" width="200" height="16" rx="8" fill="#D9D0FF"/>
  <rect x="152" y="256" width="160" height="16" rx="8" fill="#FFD0DA"/>
  <rect x="186" y="364" width="140" height="28" rx="14" fill="#fff" opacity=".85"/>
</svg>`;
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } }).render().asPng();
fs.writeFileSync(new URL('./icon.png', import.meta.url), png);
console.log('desktop/icon.png written');

// The icon of .dkly files in Windows Explorer: a page with a folded corner and the Deckly slide mark.
// Saved as desktop/dkly.ico (PNG images at 256, 64, 48, 32 and 16 px inside one .ico file).
const docSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6C4CF5"/><stop offset=".55" stop-color="#B455E8"/><stop offset="1" stop-color="#FF6B8B"/></linearGradient></defs>
  <path d="M52 12 H168 L212 56 V230 Q212 244 198 244 H52 Q38 244 38 230 V26 Q38 12 52 12 Z" fill="#fff" stroke="#D9DBE6" stroke-width="4"/>
  <path d="M168 12 V44 Q168 56 180 56 H212 Z" fill="#E3DBFF"/>
  <rect x="62" y="92" width="132" height="92" rx="16" fill="url(#g)"/>
  <rect x="80" y="112" width="58" height="12" rx="6" fill="#fff"/>
  <rect x="80" y="134" width="90" height="8" rx="4" fill="#fff" opacity=".8"/>
  <rect x="80" y="150" width="70" height="8" rx="4" fill="#fff" opacity=".6"/>
  <text x="128" y="222" font-family="Arial, sans-serif" font-weight="700" font-size="30" text-anchor="middle" fill="#6C4CF5">DKLY</text>
</svg>`;
const sizes = [256, 64, 48, 32, 16];
const pngs = sizes.map((s) => new Resvg(docSvg, { fitTo: { mode: 'width', value: s }, font: { loadSystemFonts: true } }).render().asPng());
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
fs.writeFileSync(new URL('./dkly.ico', import.meta.url), Buffer.concat([head, ...pngs]));
fs.writeFileSync(new URL('./dkly-256.png', import.meta.url), pngs[0]);
console.log('desktop/dkly.ico written');
