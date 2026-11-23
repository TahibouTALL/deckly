// packs/samples.json: 16 representative elements of every pack (with their SVG bodies), so the Elements panel
// can show a preview row of each pack without loading the whole pack. Run: node tools/build-samples.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packsDir = path.join(here, '..', 'app', 'assets', 'packs');
const index = JSON.parse(fs.readFileSync(path.join(packsDir, 'index.json'), 'utf8'));
// names that show a pack at its best, when it has them
const PREFERRED = ['rocket', 'heart', 'star', 'light-bulb', 'bulb', 'trophy', 'chart', 'camera', 'gift', 'music', 'calendar', 'globe', 'home', 'mail', 'fire', 'check', 'smile', 'sun', 'cloud', 'flag', 'book', 'coffee', 'leaf', 'car', 'phone', 'money', 'shopping', 'user', 'bell', 'lock', 'pizza', 'cat', 'dog', 'party', 'thumbs-up', 'medal'];
const N = 16;
export function buildSamples() {
  const samples = {};
  for (const P of index) {
    const data = JSON.parse(fs.readFileSync(path.join(packsDir, '..', P.file), 'utf8'));
    const names = Object.keys(data.icons);
    const picked = [];
    const isRe = (n) => /-(bold|fill|filled|solid|rounded|linear|duotone|line)$/.test(n);
    for (const pref of PREFERRED) {
      if (picked.length >= N) break;
      const hit = names.find((n) => (n === pref || n.startsWith(pref + '-') || n.includes('-' + pref)) && !picked.includes(n) && (P.kind !== 'icons' || !isRe(n) || n.endsWith('-linear') || n.endsWith('-rounded') || n.endsWith('-regular') || n.endsWith('-line')));
      if (hit) picked.push(hit);
    }
    const step = Math.max(1, Math.floor(names.length / N));
    for (let i = 0; picked.length < N && i < names.length; i += step) if (!picked.includes(names[i])) picked.push(names[i]);
    samples[P.id] = Object.fromEntries(picked.map((n) => [n, data.icons[n]]));
  }
  fs.writeFileSync(path.join(packsDir, 'samples.json'), JSON.stringify(samples));
  console.log('samples for', Object.keys(samples).length, 'packs', (fs.statSync(path.join(packsDir, 'samples.json')).size / 1024).toFixed(0), 'KB');
}
if (process.argv[1] && process.argv[1].endsWith('build-samples.mjs')) buildSamples();
