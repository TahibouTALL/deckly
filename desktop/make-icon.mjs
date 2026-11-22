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
