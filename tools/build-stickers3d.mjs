// 3D-look stickers: Microsoft Fluent Emoji (MIT), the "Color" style, drawn as small WebP pictures.
// The SVG sources are heavy (gradients, ~100 MB for 3 000 emoji); pictures of 192 px weigh ~3 KB each and
// show instantly. Run: node tools/build-stickers3d.mjs   (needs sharp; ~20 minutes)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { Resvg } = createRequire(path.join(here, '..', 'package.json'))('@resvg/resvg-js');
const sharp = require('sharp');
const nm = path.join(here, 'node_modules', '@iconify-json');
const out = path.join(here, '..', 'app', 'assets', 'stickers3d');
fs.mkdirSync(out, { recursive: true });

const data = JSON.parse(fs.readFileSync(path.join(nm, 'fluent-emoji', 'icons.json'), 'utf8'));
const cats = JSON.parse(fs.readFileSync(path.join(nm, 'fluent-emoji-flat', 'metadata.json'), 'utf8')).categories || {};
const catOf = {};
for (const [c, list] of Object.entries(cats)) for (const n of list) catOf[n] = c;
const tone = /-(light|medium-light|medium|medium-dark|dark)(-skin-tone)?$/;
const indexFile = path.join(out, 'index.json');
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {};
const SIZE = 192;
let n = 0, t0 = Date.now();
const names = Object.keys(data.icons).filter((k) => !tone.test(k) && !data.icons[k].hidden);
for (const name of names) {
  const file = path.join(out, name + '.webp');
  if (fs.existsSync(file)) { index[name] = catOf[name] || 'Other'; continue; }
  const ic = data.icons[name];
  const w = ic.width || data.width || 32, h = ic.height || data.height || 32;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${ic.body}</svg>`;
  try {
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: SIZE } }).render().asPng();
    await sharp(png).webp({ quality: 84, alphaQuality: 90, effort: 4 }).toFile(file);
    index[name] = catOf[name] || 'Other';
  } catch (e) { console.log('skip', name, e.message); }
  n++;
  if (n % 100 === 0) { fs.writeFileSync(indexFile, JSON.stringify(index)); console.log(n, '/', names.length, Math.round((Date.now() - t0) / 1000) + 's'); }
}
fs.writeFileSync(indexFile, JSON.stringify(index));
let bytes = 0; for (const f of fs.readdirSync(out)) bytes += fs.statSync(path.join(out, f)).size;
console.log('stickers 3D:', Object.keys(index).length, (bytes / 1048576).toFixed(1), 'MB');
