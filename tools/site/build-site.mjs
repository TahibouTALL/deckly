// Builds the download page: tools/site/index.src.html -> docs/index.html
// {{ic:name}} becomes the Lucide icon as inline SVG; {{version}} / {{installer}} / {{size}} / {{sha256}} / {{date}}
// come from package.json and from the built installer in dist/ (when it exists). Brand files are copied to docs/img.
// Run: node tools/site/build-site.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const icons = JSON.parse(fs.readFileSync(path.join(root, 'app', 'assets', 'icons', 'lucide.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const installer = `Deckly-Setup-${pkg.version}.exe`;
const exe = path.join(root, 'dist', installer);
let size = '—', sha = '—';
if (fs.existsSync(exe)) {
  const st = fs.statSync(exe);
  size = `${Math.round(st.size / 1048576)} Mo`;
  sha = crypto.createHash('sha256').update(fs.readFileSync(exe)).digest('hex');
} else console.log('note: dist/' + installer + ' not built yet — size and SHA-256 left blank');
const releases = JSON.parse(fs.readFileSync(path.join(here, 'releases.json'), 'utf8'));
// the library figures, counted from the assets so the page never lies
const packsIndex = JSON.parse(fs.readFileSync(path.join(root, 'app', 'assets', 'packs', 'index.json'), 'utf8'));
const sum = (kind) => packsIndex.filter((p) => p.kind === kind).reduce((a, p) => a + p.count, 0);
const count = (f) => Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'app', 'assets', f), 'utf8'))).length;
const nums = {
  icons: sum('icons') + count('icons/lucide.json'), graphics: sum('graphics'), stickers: sum('stickers') + count('icons/stickers.json') + count('stickers3d/index.json'),
  flags: sum('flags'), logos: sum('logos') + count('icons/logos.json'), fonts: JSON.parse(fs.readFileSync(path.join(root, 'app', 'assets', 'fonts', 'fonts.json'), 'utf8')).length,
  photos: JSON.parse(fs.readFileSync(path.join(root, 'app', 'assets', 'photos', 'photos.json'), 'utf8')).filter((p) => !p.legacy).length,
  shapes: (fs.readFileSync(path.join(root, 'app', 'js', 'shapes.js'), 'utf8').match(/^add\('/gm) || []).length,
};
nums.total = nums.icons + nums.graphics + nums.stickers + nums.flags + nums.logos + nums.shapes;
const k = (n) => (n >= 1000 ? Math.floor(n / 1000) * 1000 : n).toLocaleString('fr-FR').replace(/ | /g, ' ');
console.log('library:', JSON.stringify(nums));
const date = releases[0]?.date || new Date().toISOString().slice(0, 10);
const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

let html = fs.readFileSync(path.join(here, 'index.src.html'), 'utf8');
const missing = new Set();
html = html.replace(/\{\{ic:([a-z0-9-]+)\}\}/g, (_, n) => {
  if (!icons[n]) { missing.add(n); return ''; }
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n].b.replace(/\s*\n\s*/g, '')}</svg>`;
});
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const notes = releases.slice(0, 3).map((r) => `<article class="rel"><div class="rel-head"><span class="rel-v">${esc(r.version)}</span><time datetime="${esc(r.date)}">${fmtDate(r.date)}</time></div><h3>${esc(r.title)}</h3><ul>${r.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></article>`).join('');
html = html.replaceAll('{{version}}', pkg.version).replaceAll('{{version-tag}}', 'v' + pkg.version).replaceAll('{{installer}}', installer)
  .replaceAll('{{size}}', size).replaceAll('{{n-total}}', k(nums.total)).replaceAll('{{n-icons}}', k(nums.icons)).replaceAll('{{n-graphics}}', k(nums.graphics)).replaceAll('{{n-stickers}}', k(nums.stickers)).replaceAll('{{n-flags}}', k(nums.flags)).replaceAll('{{n-logos}}', k(nums.logos)).replaceAll('{{n-fonts}}', String(nums.fonts)).replaceAll('{{n-photos}}', String(nums.photos)).replaceAll('{{n-shapes}}', String(nums.shapes)).replaceAll('{{sha256}}', sha).replaceAll('{{date}}', fmtDate(date)).replaceAll('{{releases}}', notes);
fs.mkdirSync(path.join(root, 'docs', 'img'), { recursive: true });
for (const f of ['logo.svg', 'logo-white.svg', 'mark.svg']) fs.copyFileSync(path.join(root, 'app', 'assets', 'brand', f), path.join(root, 'docs', 'img', f));
fs.writeFileSync(path.join(root, 'docs', 'index.html'), html);
fs.writeFileSync(path.join(root, 'docs', '.nojekyll'), '');
console.log('docs/index.html written', Math.round(html.length / 1024) + ' KB', missing.size ? 'missing icons: ' + [...missing].join(', ') : 'all icons found', '| version', pkg.version, size);
