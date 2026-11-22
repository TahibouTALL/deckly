// Builds the download page: tools/site/index.src.html -> docs/index.html
// {{ic:name}} becomes the Lucide icon as inline SVG; {{version-tag}} / {{installer}} come from package.json.
// Run: node tools/site/build-site.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const icons = JSON.parse(fs.readFileSync(path.join(root, 'app', 'assets', 'icons', 'lucide.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
let html = fs.readFileSync(path.join(here, 'index.src.html'), 'utf8');
const missing = new Set();
html = html.replace(/\{\{ic:([a-z0-9-]+)\}\}/g, (_, n) => {
  if (!icons[n]) { missing.add(n); return ''; }
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n].b.replace(/\s*\n\s*/g, '')}</svg>`;
});
html = html.replaceAll('{{version-tag}}', 'v' + pkg.version).replaceAll('{{installer}}', `Deckly-Setup-${pkg.version}.exe`);
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'index.html'), html);
fs.writeFileSync(path.join(root, 'docs', '.nojekyll'), '');
console.log('docs/index.html written', Math.round(html.length / 1024) + ' KB', missing.size ? 'missing icons: ' + [...missing].join(', ') : 'all icons found');
