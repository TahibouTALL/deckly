// Downloads a starter photo library from Wikimedia Commons ("Quality images", free licences only)
// into app/assets/photos/, with the author + licence of every photo in photos.json.
// Run: node tools/fetch-photos.mjs [perCategory=12]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'app', 'assets', 'photos');
fs.mkdirSync(out, { recursive: true });
const per = Number(process.argv[2] || 12);
const cats = {
  Nature: 'forest', Mountains: 'mountain landscape', Ocean: 'beach sea', City: 'city skyline',
  Business: 'office', Technology: 'computer', Food: 'food dish', Travel: 'landmark tourism',
  Abstract: 'abstract pattern', Flowers: 'flower', Animals: 'wildlife', Space: 'nebula',
  Sports: 'sport', Education: 'library books', Architecture: 'architecture interior', Night: 'night city lights',
};
const UA = { 'User-Agent': 'DecklyAssetFetcher/1.0 (offline presentation editor; one-time asset fetch)' };
const OK_LIC = /^(cc0|public domain|pd|cc by(-sa)? ?[1-4]\.0|cc by(-sa)?)/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const indexFile = path.join(out, 'photos.json');
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : [];
const have = new Set(index.map((p) => p.id));
const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function get(url, ms = 40000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { headers: UA, signal: ctl.signal }); } finally { clearTimeout(t); }
}

for (const [cat, q] of Object.entries(cats)) {
  let got = index.filter((p) => p.cat === cat).length;
  if (got >= per) { console.log(cat, got, '(had)'); continue; }
  const search = `${q} incategory:Quality_images filetype:bitmap`;
  const api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6'
    + `&gsrsearch=${encodeURIComponent(search)}&gsrlimit=${per * 3}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600`;
  let pages = [];
  try {
    const r = await get(api);
    if (!r.ok) { console.log(cat, 'API', r.status); continue; }
    pages = Object.values((await r.json()).query?.pages || {}).sort((a, b) => a.index - b.index);
  } catch (e) { console.log(cat, 'API error', e.message); continue; }
  for (const p of pages) {
    if (got >= per) break;
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    const id = 'wm' + p.pageid;
    if (have.has(id) || ii.mime !== 'image/jpeg' || ii.width < ii.height) continue; // landscape JPEGs suit slides
    const md = ii.extmetadata || {};
    const lic = strip(md.LicenseShortName?.value);
    if (!OK_LIC.test(lic)) continue;
    try {
      const r = await get(ii.thumburl);
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 20000) continue;
      const file = `${cat.toLowerCase()}/${id}.jpg`;
      fs.mkdirSync(path.join(out, cat.toLowerCase()), { recursive: true });
      fs.writeFileSync(path.join(out, file), buf);
      index.push({ id, cat, file, title: strip(md.ObjectName?.value) || p.title.replace(/^File:|\.jpe?g$/gi, ''),
        creator: strip(md.Artist?.value).slice(0, 80), license: lic, source: ii.descriptionurl,
        w: ii.thumbwidth, h: ii.thumbheight });
      have.add(id); got++;
    } catch { /* skip */ }
    await sleep(250);
  }
  console.log(cat, got);
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 1));
  await sleep(800);
}
console.log('total photos', index.length);
