// Packs the open-licensed elements downloaded by npm into app/assets/ so the editor works offline.
// Run: node tools/build-assets.mjs   (after `npm install` inside tools/)
//   icons/      lucide (UI + line icons), stickers (Fluent Emoji Flat), logos (SVG Logos) — the first packs, kept as they were
//   packs/      every other pack: one JSON per pack + index.json (what it is, licence, count) + names.json (for the search)
//   fonts/      woff2 of ~130 open-licence families (400 + 700) + fonts.css + fonts.json
//   frames/     glyphs.json — letters and numbers as paths for the photo frames
//   vendor/     the libraries used by the page
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const nm = path.join(here, 'node_modules');
const app = path.join(here, '..', 'app');
const out = path.join(app, 'assets');
const mk = (p) => fs.mkdirSync(p, { recursive: true });
for (const d of ['icons', 'fonts', 'packs', 'frames']) mk(path.join(out, d));
mk(path.join(app, 'vendor'));
const credits = [];
const has = (p) => fs.existsSync(p);
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, o) => fs.writeFileSync(p, JSON.stringify(o));
const MB = (p) => (fs.statSync(p).size / 1048576).toFixed(1) + ' MB';

// 1. Lucide line icons (ISC) — the UI icons and the first icon pack
{
  const dir = path.join(nm, 'lucide-static', 'icons');
  const tags = readJson(path.join(nm, 'lucide-static', 'tags.json'));
  const icons = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.svg')) continue;
    const name = f.slice(0, -4);
    const svg = fs.readFileSync(path.join(dir, f), 'utf8');
    const inner = svg.replace(/<!--.*?-->/s, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
    icons[name] = { b: inner, t: (tags[name] || []).slice(0, 8).join(' ') };
  }
  writeJson(path.join(out, 'icons', 'lucide.json'), icons);
  credits.push(['Lucide icons', 'ISC', 'https://lucide.dev', Object.keys(icons).length]);
  console.log('lucide', Object.keys(icons).length);
}

// 2. Fluent Emoji Flat stickers (MIT) — skin-tone variants skipped (the first sticker pack, same file as before)
const tone = /-(light|medium-light|medium|medium-dark|dark)(-skin-tone)?$/;
{
  const pkg = path.join(nm, '@iconify-json', 'fluent-emoji-flat');
  const data = readJson(path.join(pkg, 'icons.json'));
  const cats = readJson(path.join(pkg, 'metadata.json')).categories || {};
  const catOf = {};
  for (const [c, list] of Object.entries(cats)) for (const n of list) catOf[n] = c;
  const icons = {};
  for (const [name, v] of Object.entries(data.icons)) {
    if (tone.test(name) || v.hidden) continue;
    icons[name] = { b: v.body, c: catOf[name] || 'Other', w: v.width || data.width || 32, h: v.height || data.height || 32 };
  }
  writeJson(path.join(out, 'icons', 'stickers.json'), icons);
  writeJson(path.join(out, 'icons', 'sticker-cats.json'), catOf);
  credits.push(['Fluent Emoji (Microsoft)', 'MIT', 'https://github.com/microsoft/fluentui-emoji', Object.keys(icons).length]);
  console.log('stickers', Object.keys(icons).length);
}

// 3. Brand logos (CC0) — the first logo pack
{
  const data = readJson(path.join(nm, '@iconify-json', 'logos', 'icons.json'));
  const icons = {};
  for (const [name, v] of Object.entries(data.icons)) if (!v.hidden) icons[name] = { b: v.body, w: v.width || data.width || 256, h: v.height || data.height || 256 };
  writeJson(path.join(out, 'icons', 'logos.json'), icons);
  credits.push(['SVG Logos (gilbarbara)', 'CC0', 'https://github.com/gilbarbara/logos', Object.keys(icons).length]);
  console.log('logos', Object.keys(icons).length);
}

// 4. Every other pack (Iconify JSON, one file per pack). kind: icons (one colour, recolourable) / graphics (colour
//    illustrations) / stickers (emoji) / flags / logos. style groups the icon packs in the panel.
const PACKS = [
  // line / filled icons
  { id: 'tabler', kind: 'icons', style: 'line' },
  { id: 'ph', kind: 'icons', style: 'line', keep: (n) => !/-(duotone|light|thin)$/.test(n) },
  { id: 'solar', kind: 'icons', style: 'line', keep: (n) => /-(linear|bold)$/.test(n) },
  { id: 'material-symbols', kind: 'icons', style: 'fill', keep: (n) => /-rounded$/.test(n) },
  { id: 'fluent', kind: 'icons', style: 'line', keep: (n) => /-24-(regular|filled)$/.test(n) },
  { id: 'mingcute', kind: 'icons', style: 'line' },
  { id: 'hugeicons', kind: 'icons', style: 'line' },
  { id: 'ri', kind: 'icons', style: 'fill' },
  { id: 'bi', kind: 'icons', style: 'fill' },
  { id: 'iconoir', kind: 'icons', style: 'line' },
  { id: 'heroicons', kind: 'icons', style: 'line', keep: (n) => !/-(16|20)-solid$/.test(n) },
  { id: 'carbon', kind: 'icons', style: 'line' },
  { id: 'mynaui', kind: 'icons', style: 'line' },
  { id: 'tdesign', kind: 'icons', style: 'line' },
  { id: 'icon-park-outline', kind: 'icons', style: 'line' },
  { id: 'icon-park-solid', kind: 'icons', style: 'fill' },
  { id: 'pixelarticons', kind: 'icons', style: 'pixel' },
  { id: 'healthicons', kind: 'icons', style: 'theme', theme: 'health' },
  { id: 'game-icons', kind: 'icons', style: 'theme', theme: 'games' },
  { id: 'pinhead', kind: 'icons', style: 'theme', theme: 'maps' },
  { id: 'temaki', kind: 'icons', style: 'theme', theme: 'maps' },
  { id: 'maki', kind: 'icons', style: 'theme', theme: 'maps' },
  { id: 'wi', kind: 'icons', style: 'theme', theme: 'weather' },
  // colour graphics
  ...['sticker', 'clay', 'soft3d', 'plush', 'pastel', 'kawaii', 'retro', 'glass', 'suite', 'skeuo', 'bento', 'liquid', 'chrome', 'luxe', 'christmas', 'halloween', 'valentine'].map((s) => ({ id: 'withicons-' + s, kind: 'graphics', style: s })),
  { id: 'fluent-color', kind: 'graphics', style: 'fluent' },
  { id: 'flat-color-icons', kind: 'graphics', style: 'flat' },
  { id: 'glyphs-poly', kind: 'graphics', style: 'poly' },
  { id: 'icon-park', kind: 'graphics', style: 'duo' },
  { id: 'marketeq', kind: 'graphics', style: 'marketeq' },
  { id: 'streamline-plump-color', kind: 'graphics', style: 'plump' },
  { id: 'streamline-freehand-color', kind: 'graphics', style: 'freehand' },
  { id: 'streamline-ultimate-color', kind: 'graphics', style: 'ultimate' },
  { id: 'streamline-kameleon-color', kind: 'graphics', style: 'kameleon' },
  { id: 'streamline-color', kind: 'graphics', style: 'streamline' },
  { id: 'meteocons', kind: 'graphics', style: 'weather' },
  // emoji stickers
  { id: 'noto', kind: 'stickers', style: 'noto', keep: (n) => !tone.test(n) },
  { id: 'twemoji', kind: 'stickers', style: 'twemoji', keep: (n) => !tone.test(n) },
  { id: 'streamline-emojis', kind: 'stickers', style: 'streamline' },
  { id: 'fxemoji', kind: 'stickers', style: 'fx' },
  // flags
  { id: 'circle-flags', kind: 'flags', style: 'round' },
  { id: 'flag', kind: 'flags', style: 'rect', keep: (n) => !/^[a-z]{2}-(1x1)$/.test(n) },
  { id: 'tabler-flags', kind: 'flags', style: 'rect' },
  // logos
  { id: 'thesvg-color', kind: 'logos', style: 'color' },
  { id: 'simple-icons', kind: 'logos', style: 'mono' },
  { id: 'skill-icons', kind: 'logos', style: 'color' },
  { id: 'devicon', kind: 'logos', style: 'color' },
  { id: 'cryptocurrency-color', kind: 'logos', style: 'color' },
];
const index = [], names = {};
for (const P of PACKS) {
  const dir = path.join(nm, '@iconify-json', P.id);
  if (!has(path.join(dir, 'icons.json'))) { console.log('  missing pack', P.id); continue; }
  const data = readJson(path.join(dir, 'icons.json'));
  const info = has(path.join(dir, 'info.json')) ? readJson(path.join(dir, 'info.json')) : {};
  const meta = has(path.join(dir, 'metadata.json')) ? readJson(path.join(dir, 'metadata.json')) : {};
  const icons = {};
  for (const [name, v] of Object.entries(data.icons)) {
    if (v.hidden || (P.keep && !P.keep(name))) continue;
    const o = { b: v.body };
    const w = v.width || data.width || 24, h = v.height || data.height || 24;
    if (w !== 24 || h !== 24) { o.w = w; o.h = h; }
    if (v.left || v.top) { o.x = v.left || 0; o.y = v.top || 0; }
    icons[name] = o;
  }
  const cats = {};
  for (const [c, list] of Object.entries(meta.categories || {})) { const l = list.filter((n) => icons[n]); if (l.length) cats[c] = l; }
  const file = `packs/${P.id}.json`;
  writeJson(path.join(out, file), { icons, cats });
  const count = Object.keys(icons).length;
  index.push({ id: P.id, name: info.name || P.id, kind: P.kind, style: P.style, theme: P.theme, count, file, license: info.license?.title || '', author: info.author?.name || '', url: info.author?.url || '', palette: !!info.palette });
  names[P.id] = Object.keys(icons).join(' ');
  credits.push([info.name || P.id, info.license?.title || '', info.author?.url || '', count]);
  console.log(P.id.padEnd(28), String(count).padStart(6), MB(path.join(out, file)));
}
writeJson(path.join(out, 'packs', 'index.json'), index);
writeJson(path.join(out, 'packs', 'names.json'), names);
console.log('packs', index.length, 'icons', index.reduce((a, p) => a + p.count, 0), 'names', MB(path.join(out, 'packs', 'names.json')));

// 5. Fonts (SIL Open Font License and similar open licences) — latin 400 + 700 (or the nearest weights the family has)
{
  const dir = path.join(nm, '@fontsource');
  let css = '/* Generated by tools/build-assets.mjs — open-licence fonts via Fontsource */\n';
  const list = [];
  const CAT = { 'sans-serif': 'sans', serif: 'serif', display: 'display', handwriting: 'script', monospace: 'mono' };
  for (const id of fs.readdirSync(dir).sort()) {
    const metaFile = path.join(dir, id, 'metadata.json');
    if (!has(metaFile)) continue;
    const meta = readJson(metaFile);
    const files = path.join(dir, id, 'files');
    const weights = (meta.weights || []).map(Number).filter((w) => has(path.join(files, `${id}-latin-${w}-normal.woff2`)));
    if (!weights.length) continue;
    const nearest = (t) => weights.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a));
    const picked = [...new Set([nearest(400), nearest(700)])];
    for (const w of picked) {
      const f = `${id}-latin-${w}-normal.woff2`;
      fs.copyFileSync(path.join(files, f), path.join(out, 'fonts', f));
      const fw = picked.length === 1 ? '400 700' : String(w); // a single file serves both weights (the browser emboldens)
      css += `@font-face{font-family:'${meta.family}';font-weight:${fw};font-style:normal;font-display:swap;src:url('${f}') format('woff2');}\n`;
    }
    list.push({ name: meta.family, cat: CAT[meta.category] || 'sans', w: picked });
  }
  fs.writeFileSync(path.join(out, 'fonts', 'fonts.css'), css);
  writeJson(path.join(out, 'fonts', 'fonts.json'), list);
  credits.push(['Fonts via Fontsource', 'SIL OFL 1.1 / Apache 2.0 / UFL', 'https://fontsource.org', list.length]);
  console.log('fonts', list.length);
}

// 6. Letter & number frames: glyph outlines (Poppins Black, SIL OFL) fitted into a 100 x 100 box
{
  const opentype = require('opentype.js');
  const fb = fs.readFileSync(path.join(here, 'fonts', 'Poppins-900.ttf'));
  const font = opentype.parse(fb.buffer.slice(fb.byteOffset, fb.byteOffset + fb.byteLength));
  const glyphs = {};
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&!?#@%+$€') {
    const g = font.charToGlyph(ch);
    const p = g.getPath(0, 0, 100);
    const bb = p.getBoundingBox();
    const w = bb.x2 - bb.x1, h = bb.y2 - bb.y1, k = 100 / Math.max(w, h);
    const ox = (100 - w * k) / 2 - bb.x1 * k, oy = (100 - h * k) / 2 - bb.y1 * k;
    for (const c of p.commands) { for (const key of ['x', 'x1', 'x2']) if (c[key] != null) c[key] = c[key] * k + ox; for (const key of ['y', 'y1', 'y2']) if (c[key] != null) c[key] = c[key] * k + oy; }
    glyphs[ch] = p.toPathData(1);
  }
  writeJson(path.join(out, 'frames', 'glyphs.json'), glyphs);
  console.log('glyph frames', Object.keys(glyphs).length);
}

// 7. Vendor libraries (MIT)
fs.copyFileSync(path.join(nm, 'pptxgenjs', 'dist', 'pptxgen.bundle.js'), path.join(app, 'vendor', 'pptxgen.bundle.js'));
fs.copyFileSync(path.join(nm, 'html-to-image', 'dist', 'html-to-image.js'), path.join(app, 'vendor', 'html-to-image.js'));
fs.copyFileSync(path.join(nm, 'jspdf', 'dist', 'jspdf.umd.min.js'), path.join(app, 'vendor', 'jspdf.umd.min.js'));
fs.copyFileSync(path.join(nm, 'qrcode-generator', 'dist', 'qrcode.js'), path.join(app, 'vendor', 'qrcode.js'));
credits.push(['qrcode-generator (Kazuhiko Arase)', 'MIT', 'https://github.com/kazuhikoarase/qrcode-generator', 1]);
fs.copyFileSync(path.join(nm, 'perfect-freehand', 'dist', 'esm', 'index.mjs'), path.join(app, 'vendor', 'perfect-freehand.js'));
credits.push(['perfect-freehand (Steve Ruiz)', 'MIT', 'https://github.com/steveruizok/perfect-freehand', 1]);

fs.writeFileSync(path.join(out, 'credits-packs.json'), JSON.stringify(credits, null, 1));
console.log('done:', credits.length, 'credited sources');
