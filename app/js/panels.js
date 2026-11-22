// Left rail + side panel: templates, elements, text, photos, icons, stickers, logos, uploads, background.
import { state, emit, commit, curSlide, selected, findEl, libAll, libPut, libDel, uid } from './store.js';
import { packs, ic, SHAPES, FRAMES, shapeSvg, lucideSvg, iconifySvg, PALETTE, GRADIENTS, photoUrl } from './assets.js';
import { TEMPLATES, blankSlideLayouts } from './templates.js';
import { addElement, startEditing } from './editor.js';
import { miniSlide } from './render.js';
import { toast, openColorPopover } from './ui.js';
import { t as tr, translateDom } from './i18n.js';
import { brandPanel, uploadFont } from './pro.js';

const $ = (s) => document.querySelector(s);
const TABS = [
  ['design', 'layout-template', 'Design'], ['brand', 'gem', 'Brand'], ['elements', 'shapes', 'Elements'], ['text', 'type', 'Text'],
  ['photos', 'image', 'Photos'], ['icons', 'smile-plus', 'Icons'], ['stickers', 'sticker', 'Stickers'],
  ['logos', 'badge-check', 'Logos'], ['uploads', 'cloud-upload', 'Uploads'], ['background', 'paint-bucket', 'Background'],
];
let tab = 'design', query = '', sub = null;
export const onlineOk = () => state.online && state.onlineEnabled;

export function initPanels() {
  $('#rail').innerHTML = TABS.map(([id, icon, label]) => `<button data-tab="${id}">${ic(icon)}<span>${tr(label)}</span></button>`).join('');
  $('#rail').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    if (tab === b.dataset.tab && !$('#panel').classList.contains('collapsed')) { $('#panel').classList.add('collapsed'); return; }
    openTab(b.dataset.tab);
  });
  $('#panelCollapse').onclick = () => $('#panel').classList.toggle('collapsed');
  const si = $('#panelSearch');
  let t; si.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { query = si.value.trim(); renderPanel(); }, 220); si.parentElement.classList.toggle('has', !!si.value); });
  $('#searchClear').onclick = () => { si.value = ''; query = ''; si.parentElement.classList.remove('has'); renderPanel(); };
  // panel tiles: click to add, drag to drop
  $('#panelBody').addEventListener('click', onPanelClick);
  $('#panelBody').addEventListener('dragstart', (e) => {
    const n = e.target.closest('[data-item]'); if (!n) return;
    e.dataTransfer.setData('application/x-deckly', n.dataset.item);
    e.dataTransfer.effectAllowed = 'copy';
  });
  document.addEventListener('deckly-drop', (e) => addItem(e.detail.item, { x: e.detail.x, y: e.detail.y }));
  document.addEventListener('deckly-files', (e) => uploadFiles(e.detail.files, e.detail.x != null ? { x: e.detail.x, y: e.detail.y } : null));
  document.addEventListener('deckly-add-text', () => addItem({ k: 'text', preset: 'body' }));
  document.addEventListener('packs', () => { if (['stickers', 'logos', 'elements'].includes(tab)) renderPanel(); });
  $('#fileUpload').addEventListener('change', (e) => { uploadFiles([...e.target.files]); e.target.value = ''; });
  openTab('design');
}

export function openTab(id, subId = null) {
  tab = id; sub = subId; query = '';
  $('#panelSearch').value = ''; $('#panelSearch').parentElement.classList.remove('has');
  $('#panel').classList.remove('collapsed');
  document.querySelectorAll('#rail button').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
  const ph = { brand: 'Search', design: 'Search templates', elements: 'Search shapes', text: 'Search fonts', photos: 'Search photos', icons: 'Search 2,400+ icons', stickers: 'Search stickers', logos: 'Search brand logos', uploads: 'Search your uploads', background: 'Search colours' };
  $('#panelSearch').placeholder = tr(ph[id]);
  $('#panelSearch').parentElement.style.display = ['uploads', 'background', 'brand'].includes(id) ? 'none' : '';
  renderPanel();
}

const item = (o) => `data-item='${JSON.stringify(o).replace(/'/g, '&#39;')}' draggable="true"`;
const sec = (title, btn) => `<div class="sec"><h3>${title}</h3>${btn || ''}</div>`;

// incremental grids so thousands of items stay fast
function lazyGrid(container, items, cls, renderOne, step = 80) {
  let n = 0;
  const grid = document.createElement('div'); grid.className = cls; container.appendChild(grid);
  const sentinel = document.createElement('div'); sentinel.style.height = '1px'; container.appendChild(sentinel);
  const more = () => { const html = items.slice(n, n + step).map(renderOne).join(''); grid.insertAdjacentHTML('beforeend', html); n += step; if (n >= items.length) io.disconnect(); };
  const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) more(); }, { root: $('#panelBody'), rootMargin: '400px' });
  more(); io.observe(sentinel);
  if (!items.length) container.insertAdjacentHTML('beforeend', '<div class="empty-note">Nothing found.</div>');
}

export function renderPanel() {
  const body = $('#panelBody'); body.innerHTML = ''; body.scrollTop = 0;
  if (!state.doc) return;
  const q = query.toLowerCase();
  ({ design, brand: (b) => brandPanel(b, addItem), elements, text, photos, icons, stickers, logos, uploads, background })[tab](body, q);
  translateDom(body);
}

// ---------- tabs ----------
function design(body, q) {
  body.insertAdjacentHTML('beforeend', sec('Add a slide'));
  const lay = document.createElement('div'); lay.className = 'grid g3'; body.appendChild(lay);
  blankSlideLayouts().forEach((L, i) => {
    const b = document.createElement('button'); b.className = 'tpl-item'; b.title = L.name;
    b.innerHTML = `<div class="thumb"></div><div class="meta" style="font-size:11px">${L.name}</div>`;
    b.querySelector('.thumb').appendChild(miniSlide(L.build(), state.doc, 96));
    b.onclick = () => { state.doc.slides.splice(state.slide + 1, 0, L.build()); state.slide++; state.sel = []; commit(); emit('slide'); };
    lay.appendChild(b);
  });
  body.insertAdjacentHTML('beforeend', sec('Templates') + '<p class="hint">Click a template to add all its slides, or a single slide to add just that one.</p>');
  const list = document.createElement('div'); list.className = 'tpl-list'; body.appendChild(list);
  for (const t of TEMPLATES.filter((t) => !q || (t.name + ' ' + t.tag).toLowerCase().includes(q))) {
    const slides = t.build();
    const card = document.createElement('div'); card.className = 'tpl-item';
    card.innerHTML = `<button class="thumb" style="display:block;width:100%;padding:0"></button><div class="meta">${t.name}<small>${tr(t.tag)} · ${tr('{n} slides', { n: slides.length })}</small></div><div class="grid g4" style="padding:0 8px 8px"></div>`;
    card.querySelector('.thumb').appendChild(miniSlide(slides[0], state.doc, 310));
    card.querySelector('.thumb').onclick = () => applyTemplate(t);
    slides.forEach((s, i) => {
      const mb = document.createElement('button'); mb.style.cssText = 'border-radius:4px;overflow:hidden;border:1px solid var(--line);padding:0'; mb.title = 'Add this slide';
      mb.appendChild(miniSlide(s, state.doc, 70));
      mb.onclick = () => { state.doc.slides.splice(state.slide + 1, 0, t.build()[i]); state.slide++; state.sel = []; commit(); emit('slide'); };
      card.querySelector('.grid').appendChild(mb);
    });
    list.appendChild(card);
  }
}
export function applyTemplate(t) {
  const slides = t.build();
  const cur = curSlide();
  const empty = state.doc.slides.length === 1 && !cur.elements.length;
  if (empty) { state.doc.slides = slides; state.slide = 0; }
  else { state.doc.slides.splice(state.slide + 1, 0, ...slides); state.slide++; }
  state.sel = []; commit(); emit('slide');
  toast(empty ? tr('“{name}” applied', { name: tr(t.name) }) : tr('{n} slides added', { n: slides.length }));
}

function elements(body, q) {
  const shapes = Object.entries(SHAPES).filter(([k, s]) => !s.line && (!q || s.name.toLowerCase().includes(q)));
  const lines = Object.entries(SHAPES).filter(([k, s]) => s.line && (!q || s.name.toLowerCase().includes(q)));
  if (lines.length) {
    body.insertAdjacentHTML('beforeend', sec('Lines') + `<div class="grid g4">${lines.map(([k, s]) => `<div class="tile" title="${s.name}" ${item({ k: 'line', shape: k })}><svg viewBox="0 0 60 20"><line x1="6" y1="10" x2="${s.arrow ? 48 : 54}" y2="10" stroke="#1E1F2B" stroke-width="3" ${s.dash ? 'stroke-dasharray="7 5"' : s.dot ? 'stroke-dasharray="0.1 6" stroke-linecap="round"' : 'stroke-linecap="round"'}/>${s.arrow ? '<path d="M44 4 L54 10 L44 16" fill="none" stroke="#1E1F2B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' : ''}</svg></div>`).join('')}</div>`);
  }
  if (shapes.length) body.insertAdjacentHTML('beforeend', sec('Shapes') + `<div class="grid g4">${shapes.map(([k, s]) => `<div class="tile" title="${s.name}" ${item({ k: 'shape', shape: k })}>${shapeSvg(k, '#B9A8FF')}</div>`).join('')}</div>`);
  if (!q || 'frame photo'.includes(q)) {
    body.insertAdjacentHTML('beforeend', sec('Photo frames') + '<p class="hint">Add a frame, then click a photo — it fills the selected frame.</p>'
      + `<div class="grid g4">${FRAMES.map((k) => `<div class="tile" title="Frame" ${item({ k: 'frame', frame: k })}>${shapeSvg(k, '#D9DBE6')}</div>`).join('')}</div>`);
  }
  // quick stickers & icons sampler
  const st = Object.entries(packs.stickers);
  const pick = q ? st.filter(([n]) => n.includes(q)).slice(0, 16) : ['red-heart', 'star', 'fire', 'rocket', 'light-bulb', 'check-mark-button', 'party-popper', 'thumbs-up', 'sparkles', 'chart-increasing', 'trophy', 'globe-showing-europe-africa', 'books', 'money-bag', 'bullseye', 'hundred-points'].map((n) => [n, packs.stickers[n]]).filter((x) => x[1]);
  if (pick.length) body.insertAdjacentHTML('beforeend', sec('Stickers', '<button data-go="stickers">See all</button>') + `<div class="grid g4">${pick.map(([n, it]) => `<div class="tile" title="${n}" ${item({ k: 'sticker', name: n })}>${iconifySvg(it)}</div>`).join('')}</div>`);
  const icons = q ? Object.keys(packs.lucide).filter((n) => n.includes(q)).slice(0, 16) : ['star', 'heart', 'check', 'arrow-right', 'map-pin', 'phone', 'mail', 'calendar', 'clock', 'user', 'globe', 'lightbulb', 'trending-up', 'shield-check', 'rocket', 'award'];
  body.insertAdjacentHTML('beforeend', sec('Icons', '<button data-go="icons">See all</button>') + `<div class="grid g4">${icons.map((n) => `<div class="tile icon" title="${n}" ${item({ k: 'icon', name: n })}>${lucideSvg(n)}</div>`).join('')}</div>`);
  body.insertAdjacentHTML('beforeend', sec('Charts & tables') + `<div class="grid g2">
    <button class="text-preset" ${item({ k: 'chart', kind: 'bars' })}>${ic('chart-column')} Bar chart</button>
    <button class="text-preset" ${item({ k: 'chart', kind: 'progress' })}>${ic('gauge')} Progress bars</button>
    <button class="text-preset" ${item({ k: 'chart', kind: 'timeline' })}>${ic('milestone')} Timeline</button>
    <button class="text-preset" ${item({ k: 'chart', kind: 'table' })}>${ic('table')} Table</button></div>`);
}

const FONT_COMBOS = [
  ['Poppins', 'Inter', 'Big launch', 'Clear supporting line'], ['Playfair Display', 'Lora', 'Elegant story', 'With a classic touch'],
  ['Bebas Neue', 'Montserrat', 'MAKE IT LOUD', 'Strong, sporty and bold'], ['Pacifico', 'Nunito', 'Hello friends', 'Warm and playful'],
  ['DM Serif Display', 'Inter', 'Editorial look', 'Calm and confident'], ['Space Grotesk', 'Space Grotesk', 'Future ready', 'Modern tech style'],
  ['Archivo Black', 'Raleway', 'IMPACT', 'Heavy headline, light body'], ['Caveat', 'Nunito', 'Handwritten note', 'Friendly and personal'],
];
function text(body, q) {
  if (!q) {
    body.insertAdjacentHTML('beforeend', `<button class="btn primary block" ${item({ k: 'text', preset: 'body' })} style="margin:6px 0 12px">${ic('type')} Add a text box</button>`
      + sec('Default text styles')
      + `<button class="text-preset" ${item({ k: 'text', preset: 'h1' })}><div style="font:700 28px Poppins">Add a heading</div></button>`
      + `<button class="text-preset" ${item({ k: 'text', preset: 'h2' })}><div style="font:600 19px Inter">Add a subheading</div></button>`
      + `<button class="text-preset" ${item({ k: 'text', preset: 'body' })}><div style="font:400 14px Inter">Add a little bit of body text</div></button>`
      + `<button class="text-preset" ${item({ k: 'text', preset: 'list' })}><div style="font:400 14px Inter">• Add a bullet list</div></button>`
      + sec('Font combinations'));
    body.insertAdjacentHTML('beforeend', FONT_COMBOS.map(([a, b, t1, t2], i) => `<button class="combo" ${item({ k: 'combo', i })}><div style="font:700 26px '${a}'">${t1}</div><div style="font:400 14px '${b}';color:#5B5E73;margin-top:6px">${t2}</div></button>`).join(''));
  }
  body.insertAdjacentHTML('beforeend', sec('Fonts on this computer', '<button id="fontUp">+ Upload a font</button>'));
  body.querySelector('#fontUp').onclick = () => uploadFont(renderPanel);
  body.insertAdjacentHTML('beforeend', packs.fonts.filter((f) => !q || f.toLowerCase().includes(q)).map((f) => `<button class="text-preset" ${item({ k: 'text', preset: 'body', font: f })}><div style="font:400 20px '${f}'">${f}</div></button>`).join(''));
}

function photos(body, q) {
  const cats = [...new Set(packs.photos.map((p) => p.cat))];
  if (!q) {
    body.insertAdjacentHTML('beforeend', `<div class="chips">${['All', ...cats].map((c) => `<button class="chip ${((sub || 'All') === c) ? 'on' : ''}" data-sub="${c}">${c}</button>`).join('')}</div>`);
  }
  const local = packs.photos.filter((p) => (!sub || sub === 'All' || p.cat === sub) && (!q || (p.cat + ' ' + p.title).toLowerCase().includes(q)));
  if (local.length) {
    body.insertAdjacentHTML('beforeend', sec(q ? 'In your library' : 'Library (offline)'));
    lazyGrid(body, local, 'masonry', (p) => `<div class="tile" title="${p.title.replace(/"/g, '')} — ${p.creator.replace(/"/g, '')} (${p.license})" ${item({ k: 'photo', src: photoUrl(p), w: p.w, h: p.h, credit: `${p.creator} · ${p.license}` })}><img loading="lazy" src="${photoUrl(p)}"></div>`, 30);
  } else if (!q) body.insertAdjacentHTML('beforeend', '<div class="empty-note">No photos in the library yet.</div>');
  if (q) webPhotos(body, q);
  else body.insertAdjacentHTML('beforeend', `<div class="online-box">${ic('globe')} <b>Need more?</b> Type in the search box — when you are online, Deckly also searches millions of free photos on Wikimedia Commons and keeps the ones you use, so they work offline afterwards.</div>`);
}
async function webPhotos(body, q) {
  if (!onlineOk()) { body.insertAdjacentHTML('beforeend', `<div class="online-box">${ic('wifi-off')} You are offline — showing only your library. Go online to search the web.</div>`); return; }
  body.insertAdjacentHTML('beforeend', sec('From the web (free licences)') + '<div class="spinner" id="webSpin"></div>');
  try {
    const api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6'
      + `&gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}&gsrlimit=40&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1280`;
    const data = await (await fetch(api)).json();
    if (query.toLowerCase() !== q || tab !== 'photos') return;
    const pages = Object.values(data.query?.pages || {}).sort((a, b) => a.index - b.index);
    const res = pages.map((p) => {
      const ii = p.imageinfo?.[0]; if (!ii || !/jpeg|png/.test(ii.mime)) return null;
      const md = ii.extmetadata || {}; const lic = (md.LicenseShortName?.value || '').replace(/<[^>]+>/g, '');
      if (!/cc0|public domain|cc by/i.test(lic)) return null;
      const artist = (md.Artist?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 60);
      return { k: 'webphoto', src: ii.thumburl, w: ii.thumbwidth, h: ii.thumbheight, credit: `${artist || 'Wikimedia Commons'} · ${lic}`, page: ii.descriptionurl };
    }).filter(Boolean);
    $('#webSpin')?.remove(); translateDom(body);
    lazyGrid(body, res, 'masonry', (r) => `<div class="tile" title="${r.credit.replace(/"/g, '')}" ${item(r)}><img loading="lazy" src="${r.src}"><span class="badge">WEB</span></div>`, 40);
  } catch { $('#webSpin')?.remove(); body.insertAdjacentHTML('beforeend', '<div class="empty-note">Could not reach the web search.</div>'); }
}

function icons(body, q) {
  const all = Object.entries(packs.lucide);
  const res = q ? all.filter(([n, v]) => n.includes(q) || v.t.includes(q)) : all;
  body.insertAdjacentHTML('beforeend', `<p class="hint">${tr('{n} line icons on this computer. Pick a colour after adding.', { n: res.length.toLocaleString('fr-FR') })}</p>`);
  lazyGrid(body, res, 'grid g5', ([n]) => `<div class="tile icon" title="${n}" ${item({ k: 'icon', name: n })}>${lucideSvg(n)}</div>`, 100);
  if (q) webIcons(body, q);
}
async function webIcons(body, q) {
  if (!onlineOk()) return;
  body.insertAdjacentHTML('beforeend', sec('More icons from the web') + '<div class="spinner" id="webSpin"></div>');
  try {
    const s = await (await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=64`)).json();
    if (query.toLowerCase() !== q || tab !== 'icons') return;
    const byPrefix = {};
    for (const full of s.icons || []) { const [p, n] = full.split(':'); (byPrefix[p] ||= []).push(n); }
    const out = [];
    await Promise.all(Object.entries(byPrefix).map(async ([p, names]) => {
      const d = await (await fetch(`https://api.iconify.design/${p}.json?icons=${names.join(',')}`)).json();
      for (const n of names) { const v = d.icons?.[n]; if (v) out.push({ k: 'svg', name: `${p}:${n}`, data: { b: v.body, w: v.width || d.width || 24, h: v.height || d.height || 24 } }); }
    }));
    $('#webSpin')?.remove();
    lazyGrid(body, out, 'grid g5', (r) => `<div class="tile icon" title="${r.name}" ${item(r)}>${iconifySvg(r.data).replace('<svg ', '<svg style="color:#1E1F2B" ')}<span class="badge">WEB</span></div>`, 64);
  } catch { $('#webSpin')?.remove(); }
}

function stickers(body, q) {
  const all = Object.entries(packs.stickers);
  if (!all.length) { body.innerHTML = '<div class="spinner"></div>'; return; }
  const cats = [...new Set(all.map(([, v]) => v.c))];
  if (!q) body.insertAdjacentHTML('beforeend', `<div class="chips">${['All', ...cats].map((c) => `<button class="chip ${((sub || 'All') === c) ? 'on' : ''}" data-sub="${c}">${c.replace(' & ', ' & ')}</button>`).join('')}</div>`);
  const res = all.filter(([n, v]) => (!sub || sub === 'All' || v.c === sub) && (!q || n.includes(q.replace(/\s+/g, '-'))));
  lazyGrid(body, res, 'grid g4', ([n, it]) => `<div class="tile" title="${n.replace(/-/g, ' ')}" ${item({ k: 'sticker', name: n })}>${iconifySvg(it)}</div>`, 80);
}

function logos(body, q) {
  const all = Object.entries(packs.logos);
  if (!all.length) { body.innerHTML = '<div class="spinner"></div>'; return; }
  const res = all.filter(([n]) => !n.endsWith('-icon') || q).filter(([n]) => !q || n.includes(q.replace(/\s+/g, '-')));
  body.insertAdjacentHTML('beforeend', '<p class="hint">Brand logos are trademarks of their owners — use them to refer to the brand.</p>');
  lazyGrid(body, res, 'grid g3', ([n, it]) => `<div class="tile" title="${n}" ${item({ k: 'logo', name: n })}>${iconifySvg(it)}</div>`, 60);
}

async function uploads(body) {
  body.insertAdjacentHTML('beforeend', `<button class="btn primary block" id="upBtn" style="margin-top:6px">${ic('upload')} Upload images</button>
    <div class="upload-drop" id="upDrop">${ic('image-plus')}<div style="margin-top:6px">Drop images here</div><div class="hint">They stay on this computer.</div></div>`);
  $('#upBtn').onclick = () => $('#fileUpload').click();
  const dz = $('#upDrop');
  dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('drag'); };
  dz.ondragleave = () => dz.classList.remove('drag');
  dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('drag'); uploadFiles([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')), null, false); };
  const lib = (await libAll()).sort((a, b) => b.t - a.t);
  if (tab !== 'uploads') return;
  const up = lib.filter((x) => x.kind === 'upload'), web = lib.filter((x) => x.kind === 'web');
  if (up.length) { body.insertAdjacentHTML('beforeend', sec('Your uploads')); lazyGrid(body, up, 'masonry', (x) => `<div class="tile" ${item({ k: 'photo', src: x.src, w: x.w, h: x.h })}><img src="${x.src}"></div>`, 30); }
  if (web.length) { body.insertAdjacentHTML('beforeend', sec('Saved from the web') + '<p class="hint">Photos you used from the web — kept for offline use.</p>'); lazyGrid(body, web, 'masonry', (x) => `<div class="tile" title="${(x.credit || '').replace(/"/g, '')}" ${item({ k: 'photo', src: x.src, w: x.w, h: x.h, credit: x.credit })}><img src="${x.src}"></div>`, 30); }
  if (!up.length && !web.length) body.insertAdjacentHTML('beforeend', '<div class="empty-note">Nothing uploaded yet.</div>');
  translateDom(body);
}

function background(body) {
  const cur = curSlide().bg;
  body.insertAdjacentHTML('beforeend', sec('Colour') + `<div class="swatches">${PALETTE.map((c) => `<button class="sw" style="background:${c}" data-bg='{"type":"color","value":"${c}"}'></button>`).join('')}</div>`
    + `<button class="btn ghost block" id="bgCustom" style="margin-top:10px">${ic('pipette')} Custom colour</button>`
    + sec('Gradients') + `<div class="swatches">${GRADIENTS.map((g) => `<button class="sw grad" style="background:${g}" data-bg='${JSON.stringify({ type: 'gradient', value: g })}'></button>`).join('')}</div>`
    + `<div class="toggle-row" style="margin-top:14px"><span style="font-weight:600">Apply to all slides</span><button class="switch" id="bgAll"></button></div>`);
  if (packs.photos.length) {
    body.insertAdjacentHTML('beforeend', sec('Photo backgrounds'));
    lazyGrid(body, packs.photos, 'grid g2', (p) => `<button class="tile photo" data-bg='${JSON.stringify({ type: 'image', value: photoUrl(p) })}'><img loading="lazy" src="${photoUrl(p)}"></button>`, 20);
  }
  $('#bgAll').onclick = (e) => e.currentTarget.classList.toggle('on');
  $('#bgCustom').onclick = (e) => openColorPopover(e.currentTarget, cur.type === 'color' ? cur.value : '#FFFFFF', (c) => setBg({ type: 'color', value: c }, false), () => commit());
}
function setBg(bg, doCommit = true) {
  const all = $('#bgAll')?.classList.contains('on');
  (all ? state.doc.slides : [curSlide()]).forEach((s) => (s.bg = bg));
  if (doCommit) commit();
  emit(all ? 'slide' : 'canvas');
}

// ---------- clicks ----------
function onPanelClick(e) {
  const go = e.target.closest('[data-go]'); if (go) { openTab(go.dataset.go); return; }
  const sb = e.target.closest('[data-sub]'); if (sb) { sub = sb.dataset.sub === 'All' ? null : sb.dataset.sub; renderPanel(); return; }
  const bg = e.target.closest('[data-bg]'); if (bg) { setBg(JSON.parse(bg.dataset.bg)); return; }
  const it = e.target.closest('[data-item]'); if (it) addItem(JSON.parse(it.dataset.item));
}

const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#E6E7EF"/><g transform="translate(164 164) scale(3)" fill="none" stroke="#9295A8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></g></svg>');

export async function addItem(it, at) {
  const D = state.doc, base = Math.min(D.w, D.h);
  const target = imageTarget(at);
  if ((it.k === 'photo' || it.k === 'webphoto') && target) { // fill a frame / replace a photo
    target.src = it.k === 'webphoto' ? await keepWebPhoto(it) : it.src;
    if (!target.src) return;
    target.placeholder = false; target.credit = it.credit; commit(); emit('canvas'); toast('Photo placed in the frame'); return;
  }
  switch (it.k) {
    case 'shape': addElement({ type: 'shape', shape: it.shape, w: base * 0.3, h: base * 0.3, fill: '#8D74FF', stroke: '#1E1F2B', strokeWidth: 0, radius: SHAPES[it.shape]?.radius }, at); break;
    case 'line': addElement({ type: 'shape', shape: it.shape, w: base * 0.4, h: 40, stroke: '#1E1F2B', strokeWidth: 6 }, at); break;
    case 'frame': addElement({ type: 'image', src: PLACEHOLDER, placeholder: true, frame: it.frame, w: base * 0.4, h: base * 0.4, filters: {} }, at); break;
    case 'icon': addElement({ type: 'icon', name: it.name, w: base * 0.16, h: base * 0.16, color: '#1E1F2B', sw: 2 }, at); break;
    case 'sticker': { const s = packs.stickers[it.name]; addElement({ type: 'sticker', name: it.name, data: s, w: base * 0.2, h: base * 0.2 * (s?.h || 32) / (s?.w || 32) }, at); break; }
    case 'logo': { const s = packs.logos[it.name]; const r = (s?.h || 1) / (s?.w || 1); const w = r > 0.6 ? base * 0.2 : base * 0.35; addElement({ type: 'logo', name: it.name, data: s, w, h: w * r }, at); break; }
    case 'svg': { libPut({ id: 'icon-' + it.name, kind: 'webicon', t: Date.now(), data: it.data, name: it.name }); const r = it.data.h / it.data.w; addElement({ type: 'svg', data: it.data, w: base * 0.16, h: base * 0.16 * r }, at); break; }
    case 'photo': case 'webphoto': {
      const src = it.k === 'webphoto' ? await keepWebPhoto(it) : it.src; if (!src) return;
      const r = (it.h || 3) / (it.w || 4); let w = D.w * 0.5, h = w * r; if (h > D.h * 0.7) { h = D.h * 0.7; w = h / r; }
      addElement({ type: 'image', src, w, h, frame: 'rect', radius: 0, filters: {}, credit: it.credit }, at); break;
    }
    case 'text': {
      const P = { h1: [110, true, 'Poppins', 'Add a heading'], h2: [64, true, 'Inter', 'Add a subheading'], body: [40, false, 'Inter', 'Add a little bit of body text'], list: [40, false, 'Inter', '• First point<br>• Second point<br>• Third point'] }[it.preset];
      P[3] = tr(P[3]);
      const el = addElement({ type: 'text', html: P[3], font: it.font || P[2], size: P[0], bold: P[1], color: textColorFor(), align: 'left', lineHeight: it.preset === 'list' ? 1.6 : 1.2, w: Math.min(D.w * 0.7, P[0] * 14), h: P[0] * 1.3 }, at);
      setTimeout(() => startEditing(el.id), 30); break;
    }
    case 'combo': {
      const [a, b, t1, t2] = FONT_COMBOS[it.i]; const c = textColorFor();
      const x = at ? at.x - 600 : D.w / 2 - 600, y = at ? at.y - 120 : D.h / 2 - 120;
      const h1 = { id: uid(), type: 'text', html: tr(t1), font: a, size: 120, bold: a !== 'Bebas Neue' && a !== 'Pacifico' && a !== 'Caveat', color: c, align: 'center', lineHeight: 1.1, x, y, w: 1200, h: 140, rot: 0, opacity: 1 };
      const h2 = { id: uid(), type: 'text', html: tr(t2), font: b, size: 44, color: c, align: 'center', lineHeight: 1.3, x, y: y + 170, w: 1200, h: 60, rot: 0, opacity: 0.8 };
      curSlide().elements.push(h1, h2); state.sel = [h1.id, h2.id]; commit(); emit('canvas'); break;
    }
    case 'chart': addChart(it.kind, at); break;
  }
}
function imageTarget(at) {
  if (at) { // dropped onto an image?
    const hit = [...curSlide().elements].reverse().find((e) => e.type === 'image' && !e.locked && at.x >= e.x && at.x <= e.x + e.w && at.y >= e.y && at.y <= e.y + e.h);
    return hit || null;
  }
  const s = selected();
  return s.length === 1 && s[0].type === 'image' && s[0].placeholder ? s[0] : null;
}
function textColorFor() {
  const bg = curSlide().bg;
  if (bg.type === 'color') { const m = /^#([0-9a-f]{6})$/i.exec(bg.value); if (m) { const n = parseInt(m[1], 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150 ? '#1E1F2B' : '#FFFFFF'; } }
  return bg.type === 'color' ? '#1E1F2B' : '#FFFFFF';
}

// web photos are downloaded and kept inside the design + the local library -> they keep working offline
async function keepWebPhoto(it) {
  try {
    toast('Downloading photo…');
    const blob = await (await fetch(it.src)).blob();
    const src = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    libPut({ id: 'web-' + it.src, kind: 'web', t: Date.now(), src, w: it.w, h: it.h, credit: it.credit, page: it.page });
    return src;
  } catch { toast('Could not download this photo'); return null; }
}

export async function uploadFiles(files, at, add = true) {
  for (const f of files) {
    const src = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
    const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    if (!img) continue;
    // keep designs light: downscale very large photos
    let out = src;
    const max = 2400;
    if (img.width > max || img.height > max || f.size > 1.5e6) {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      out = c.toDataURL(f.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88);
    }
    await libPut({ id: uid(), kind: 'upload', t: Date.now(), src: out, w: img.width, h: img.height, name: f.name });
    if (add) await addItem({ k: 'photo', src: out, w: img.width, h: img.height }, at);
  }
  if (tab === 'uploads') renderPanel();
  toast(files.length > 1 ? tr('{n} images uploaded', { n: files.length }) : 'Image uploaded');
}

function addChart(kind, at) {
  const D = state.doc, els = [], c = textColorFor();
  const ox = at ? at.x - 600 : D.w / 2 - 600, oy = at ? at.y - 300 : D.h / 2 - 300;
  const colors = ['#6C4CF5', '#B455E8', '#FF6B8B', '#FF8A3D', '#2EC27E'];
  const T = (html, x, y, w, size, o = {}) => ({ id: uid(), type: 'text', html: tr(html), x, y, w, h: size * 1.3, size, font: 'Inter', color: o.color || c, bold: !!o.bold, align: o.align || 'left', lineHeight: 1.2, rot: 0, opacity: o.op ?? 1 });
  const R = (x, y, w, h, fill, r = 0) => ({ id: uid(), type: 'shape', shape: r ? 'rounded' : 'rect', x, y, w, h, fill, radius: r, rot: 0, opacity: 1, strokeWidth: 0 });
  if (kind === 'bars') {
    const vals = [45, 70, 55, 90, 65];
    vals.forEach((v, i) => { const h = v * 5; els.push(R(ox + i * 240, oy + 500 - h, 160, h, colors[i], 12), T(v + '%', ox + i * 240, oy + 500 - h - 60, 160, 36, { bold: true, align: 'center' }), T(['Q1', 'Q2', 'Q3', 'Q4', 'Q5'][i], ox + i * 240, oy + 520, 160, 30, { align: 'center', op: 0.7 })); });
  } else if (kind === 'progress') {
    [['Design', 85], ['Development', 62], ['Marketing', 40]].forEach(([l, v], i) => { const y = oy + i * 180; els.push(T(l, ox, y, 800, 36, { bold: true }), T(v + '%', ox + 900, y, 300, 36, { bold: true, align: 'right' }), R(ox, y + 64, 1200, 36, '#E6E7EF', 50), R(ox, y + 64, 1200 * v / 100, 36, colors[i], 50)); });
  } else if (kind === 'timeline') {
    els.push(R(ox, oy + 280, 1200, 8, '#D9DBE6'));
    ['2023', '2024', '2025', '2026'].forEach((yv, i) => { const x = ox + i * 380; els.push({ id: uid(), type: 'shape', shape: 'circle', x: x - 6, y: oy + 254, w: 60, h: 60, fill: colors[i], rot: 0, opacity: 1, strokeWidth: 0 }, T(yv, x - 70, oy + 150, 200, 44, { bold: true, align: 'center' }), T('Milestone', x - 90, oy + 350, 240, 30, { align: 'center', op: 0.75 })); });
  } else if (kind === 'table') {
    const rows = [['Plan', 'Price', 'Users'], ['Starter', '$9', '1'], ['Team', '$29', '10'], ['Business', '$79', 'Unlimited']];
    rows.forEach((r, i) => r.forEach((cell, j) => { const x = ox + j * 400, y = oy + i * 120; els.push(R(x, y, 396, 116, i === 0 ? '#6C4CF5' : i % 2 ? '#F4F1FF' : '#FFFFFF'), T(cell, x + 30, y + 36, 340, 36, { bold: i === 0, color: i === 0 ? '#FFFFFF' : '#1E1F2B' })); }));
  }
  curSlide().elements.push(...els); state.sel = els.map((e) => e.id); commit(); emit('canvas');
  toast('Added — click any part to edit it');
}
