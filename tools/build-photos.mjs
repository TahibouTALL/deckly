// Re-encodes the photo library for the installer: at most 1400 px wide, JPEG 80, progressive.
// Keeps photos.json in sync (sizes). Run: node tools/build-photos.mjs   (needs sharp)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const sharp = createRequire(import.meta.url)('sharp');
const dir = path.join(here, '..', 'app', 'assets', 'photos');
const indexFile = path.join(dir, 'photos.json');
const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
const MAX = 1400;
// ShareAlike photos would bind the member's own presentation: they are no longer offered in the panel,
// but their files stay so that designs made with them before 1.3 keep their pictures.
for (const p of index) if (/-sa/i.test(p.license)) p.legacy = true; else delete p.legacy;
let before = 0, after = 0, n = 0;
for (const p of index) {
  const file = path.join(dir, p.file);
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file); const size = src.length; before += size;
  const m = await sharp(src).metadata();
  if (m.width <= MAX && size < 260000) { after += size; p.w = m.width; p.h = m.height; continue; }
  const buf = await sharp(src).resize({ width: MAX, withoutEnlargement: true }).jpeg({ quality: 80, progressive: true, mozjpeg: true }).toBuffer();
  fs.writeFileSync(file, buf);
  const m2 = await sharp(buf).metadata();
  p.w = m2.width; p.h = m2.height; after += buf.length; n++;
}
fs.writeFileSync(indexFile, JSON.stringify(index, null, 1));
console.log(`photos: ${index.length}, re-encoded ${n}, ${(before / 1048576).toFixed(0)} MB -> ${(after / 1048576).toFixed(0)} MB`);
