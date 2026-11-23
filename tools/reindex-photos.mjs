// Rebuilds photos.json entries for photo files present on disk but missing from the index (their author,
// licence and title are fetched again from Wikimedia Commons by page id — nothing is re-downloaded).
// Run: node tools/reindex-photos.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', 'app', 'assets', 'photos');
const indexFile = path.join(dir, 'photos.json');
const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
const have = new Set(index.map((p) => p.id));
const UA = { 'User-Agent': 'DecklyAssetFetcher/1.0 (offline presentation editor; one-time asset fetch)' };
const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const missing = [];
for (const cat of fs.readdirSync(dir)) {
  const p = path.join(dir, cat); if (!fs.statSync(p).isDirectory()) continue;
  for (const f of fs.readdirSync(p)) { const m = /^wm(\d+)\.jpg$/.exec(f); if (m && !have.has('wm' + m[1])) missing.push({ id: 'wm' + m[1], pageid: m[1], cat: cap(cat), file: `${cat}/${f}` }); }
}
console.log('files without an entry:', missing.length);
for (let i = 0; i < missing.length; i += 50) {
  const batch = missing.slice(i, i + 50);
  const api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600&pageids=' + batch.map((b) => b.pageid).join('|');
  let pages = {};
  for (let t = 0; t < 6; t++) { try { const r = await fetch(api, { headers: UA }); pages = (await r.json()).query?.pages || {}; break; } catch (e) { console.log('net', e.message); await new Promise((r) => setTimeout(r, 20000)); } }
  for (const b of batch) {
    const pg = pages[b.pageid]; const ii = pg?.imageinfo?.[0];
    if (!ii) { console.log('no info for', b.id, '- file removed'); fs.unlinkSync(path.join(dir, b.file)); continue; }
    const md = ii.extmetadata || {}; const lic = strip(md.LicenseShortName?.value);
    index.push({ id: b.id, cat: b.cat, file: b.file, title: strip(md.ObjectName?.value) || pg.title.replace(/^File:|\.jpe?g$/gi, ''), creator: strip(md.Artist?.value).slice(0, 80), license: lic, source: ii.descriptionurl, w: ii.thumbwidth, h: ii.thumbheight });
  }
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 1));
  console.log('indexed', Math.min(i + 50, missing.length), '/', missing.length);
}
console.log('total photos', index.length);
