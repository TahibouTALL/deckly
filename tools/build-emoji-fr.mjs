// French keywords for the emoji stickers, from Unicode CLDR (the official French emoji names and keywords).
// Input: the CLDR "fr" annotations (tools/cldr/*.json, Unicode licence) + each pack's chars.json (code point -> name).
// Output: app/assets/packs/emoji-fr.json  { "grinning-face": "visage souriant sourire …", … }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const nm = path.join(here, 'node_modules', '@iconify-json');
const cldrDir = path.join(here, 'cldr');
const ann = {};
for (const f of ['annotations-fr.json', 'annotationsDerived-fr.json']) {
  const p = path.join(cldrDir, f); if (!fs.existsSync(p)) continue;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const root = j.annotations?.annotations || j.annotationsDerived?.annotations || {};
  for (const [ch, v] of Object.entries(root)) ann[ch] = [...(v.tts || []), ...(v.default || [])].join(' ');
}
const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const out = {};
let hits = 0;
for (const pack of ['fluent-emoji-flat', 'fluent-emoji', 'noto', 'twemoji', 'streamline-emojis', 'fxemoji']) {
  const f = path.join(nm, pack, 'chars.json'); if (!fs.existsSync(f)) continue;
  const chars = JSON.parse(fs.readFileSync(f, 'utf8')); // "1f600" or "1f468-200d-1f4bb" -> name
  for (const [code, name] of Object.entries(chars)) {
    if (out[name]) continue;
    const ch = String.fromCodePoint(...code.split('-').map((h) => parseInt(h, 16)));
    const a = ann[ch] || ann[ch.replace(/️/g, '')] || ann[ch + '️'];
    if (a) { out[name] = [...new Set(strip(a).split(/[\s|,]+/).filter((w) => w.length > 1))].join(' '); hits++; }
  }
}
fs.mkdirSync(path.join(here, '..', 'app', 'assets', 'packs'), { recursive: true });
fs.writeFileSync(path.join(here, '..', 'app', 'assets', 'packs', 'emoji-fr.json'), JSON.stringify(out));
console.log('emoji with French keywords:', hits, 'example:', JSON.stringify(out['grinning-face'] || out['rocket']));
