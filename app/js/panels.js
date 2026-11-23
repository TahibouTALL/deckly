// Left rail + side panel: Design, Elements (shapes, lines, tables, charts, illustrations, stickers, icons, frames,
// grids, mockups, flags, logos, QR, drawing), Text, Photos, Uploads, Brand, Background, Animate.
import { state, emit, commit, curSlide, selected, findEl, libAll, libPut, libDel, uid } from './store.js';
import { packs, ic, shapeSvg, lucideSvg, iconifySvg, PALETTE, GRADIENTS, PATTERNS, photoUrl, fontCat } from './assets.js';
import { SHAPES, SHAPE_CATS, FRAME_SHAPES } from './shapes.js';
import { lib, packsOf, packInfo, loadPack, packLoaded, iconOf, packSvg, isMono, loadNames, searchPackNames, DEFAULT_PACKS, sticker3dUrl, sticker3dCats, recent, remember, styleLabel } from './library.js';
import { queryTerms, matches, score, suggestions } from './search.js';
import { tableDefaults, PRESETS as TABLE_PRESETS } from './elements/table.js';
import { chartDefaults, KINDS as CHART_KINDS } from './elements/chart.js';
import { qrDefaults } from './elements/qr.js';
import { makeLine, renderLine } from './elements/line.js';
import { TOOLS as DRAW_TOOLS } from './elements/draw.js';
import { DEVICE_FRAMES, frameSpec, miniSlide } from './render.js';
import { TEMPLATES, blankSlideLayouts } from './templates.js';
import { addElement, startEditing, startDraw } from './editor.js';
import { toast, openColorPopover } from './ui.js';
import { t as tr, translateDom } from './i18n.js';
import { brandPanel, uploadFont, userTemplates, deleteTemplate } from './pro.js';
import { animatePanel } from './animpanel.js';
import { on } from './store.js';

const $ = (s) => document.querySelector(s);
const TABS = [
  ['design', 'layout-template', 'Design'], ['elements', 'shapes', 'Elements'], ['text', 'type', 'Text'], ['photos', 'image', 'Photos'],
  ['uploads', 'cloud-upload', 'Uploads'], ['brand', 'gem', 'Brand'], ['background', 'paint-bucket', 'Background'], ['animate', 'sparkles', 'Animate'],
];
let tab = 'design', query = '', sub = null, chip = null;
export const onlineOk = () => state.online && state.onlineEnabled;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initPanels() {
  $('#rail').innerHTML = TABS.map(([id, icon, label]) => `<button data-tab="${id}" role="tab" aria-label="${tr(label)}">${ic(icon)}<span>${tr(label)}</span></button>`).join('');
  $('#rail').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    if (tab === b.dataset.tab && !$('#panel').classList.contains('collapsed')) { $('#panel').classList.add('collapsed'); return; }
    openTab(b.dataset.tab);
  });
  $('#panelCollapse').onclick = () => $('#panel').classList.toggle('collapsed');
  const si = $('#panelSearch');
  let t; si.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { query = si.value.trim(); renderPanel(); }, 220); si.parentElement.classList.toggle('has', !!si.value); });
  $('#searchClear').onclick = () => { si.value = ''; query = ''; si.parentElement.classList.remove('has'); renderPanel(); };
  $('#panelBody').addEventListener('click', onPanelClick);
  $('#panelBody').addEventListener('dragstart', (e) => {
    const n = e.target.closest('[data-item]'); if (!n) return;
    e.dataTransfer.setData('application/x-deckly', n.dataset.item);
    e.dataTransfer.effectAllowed = 'copy';
    const img = n.querySelector('img,svg'); if (img && e.dataTransfer.setDragImage) e.dataTransfer.setDragImage(n, 30, 30);
  });
  document.addEventListener('deckly-drop', (e) => addItem(e.detail.item, { x: e.detail.x, y: e.detail.y }));
  document.addEventListener('deckly-files', (e) => uploadFiles(e.detail.files, e.detail.x != null ? { x: e.detail.x, y: e.detail.y } : null));
  document.addEventListener('deckly-templates', () => { if (tab === 'design') renderPanel(); });
  on((w) => { if (tab === 'animate' && ['sel', 'slide', 'all', 'history'].includes(w) && !document.querySelector('#panelBody input[type=range]:active')) renderPanel(); });
  document.addEventListener('deckly-add-text', () => addItem({ k: 'text', preset: 'body' }));
  document.addEventListener('packs', () => { if (tab === 'elements') renderPanel(); });
  $('#fileUpload').addEventListener('change', (e) => { uploadFiles([...e.target.files]); e.target.value = ''; });
  openTab('design');
}

export function openTab(id, subId = null, chipId = null) {
  tab = id; sub = subId; chip = chipId; query = '';
  $('#panelSearch').value = ''; $('#panelSearch').parentElement.classList.remove('has');
  $('#panel').classList.remove('collapsed');
  document.querySelectorAll('#rail button').forEach((b) => { b.classList.toggle('active', b.dataset.tab === id); b.setAttribute('aria-selected', b.dataset.tab === id); });
  const ph = { design: 'Search templates', elements: 'Search 120,000+ elements (table, arrow, icon…)', text: 'Search fonts', photos: 'Search photos' };
  $('#panelSearch').placeholder = tr(ph[id] || 'Search');
  $('#panelSearch').parentElement.style.display = ['uploads', 'background', 'brand', 'animate'].includes(id) ? 'none' : '';
  renderPanel();
}
export const openElements = (subId, chipId) => openTab('elements', subId, chipId);

const item = (o) => `data-item='${JSON.stringify(o).replace(/'/g, '&#39;')}' draggable="true"`;
const sec = (title, btn) => `<div class="sec"><h3>${tr(title)}</h3>${btn || ''}</div>`;
const seeAll = (subId, n) => `<button data-sub="${subId}">${tr('See all')}${n ? ` (${n.toLocaleString('fr-FR')})` : ''}</button>`;

// incremental grids so thousands of items stay fast
function lazyGrid(container, items, cls, renderOne, step = 80) {
  let n = 0;
  const grid = document.createElement('div'); grid.className = cls; container.appendChild(grid);
  const sentinel = document.createElement('div'); sentinel.style.height = '1px'; container.appendChild(sentinel);
  const more = () => { const html = items.slice(n, n + step).map(renderOne).join(''); grid.insertAdjacentHTML('beforeend', html); n += step; translateDom(grid); if (n >= items.length) { io.disconnect(); sentinel.remove(); } };
  const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { more(); io.unobserve(sentinel); if (n < items.length) requestAnimationFrame(() => io.observe(sentinel)); } }, { root: $('#panelBody'), rootMargin: '500px' });
  more(); if (n < items.length) io.observe(sentinel);
  if (!items.length) container.insertAdjacentHTML('beforeend', `<div class="empty-note">${tr('Nothing found.')}</div>`);
  return grid;
}

export function renderPanel() {
  const body = $('#panelBody'); body.innerHTML = ''; body.scrollTop = 0;
  if (!state.doc) return;
  const q = query.toLowerCase();
  ({ design, animate: (b) => animatePanel(b), brand: (b) => brandPanel(b, addItem), elements, text, photos, uploads, background })[tab](body, q);
  translateDom(body);
}

// ---------- Design ----------
function design(body, q) {
  const mine = document.createElement('div'); body.appendChild(mine);
  userTemplates().then((list) => {
    list = list.filter((t) => !q || t.name.toLowerCase().includes(q));
    if (!list.length || tab !== 'design') return;
    mine.innerHTML = sec(tr('My templates')) + '<div class="tpl-list"></div>';
    for (const t of list) {
      const card = document.createElement('div'); card.className = 'tpl-item';
      card.innerHTML = `<button class="thumb" style="display:block;width:100%;padding:0"></button><div class="meta">${esc(t.name)}<button class="cb danger" title="${tr('Delete')}" data-deltpl>${ic('trash-2')}</button></div>`;
      card.querySelector('.thumb').appendChild(miniSlide(t.build()[0], { w: t.w, h: t.h }, 310));
      card.querySelector('.thumb').onclick = () => applyTemplate(t);
      card.querySelector('[data-deltpl]').onclick = async () => { await deleteTemplate(t.id); renderPanel(); toast('Template deleted'); };
      mine.querySelector('.tpl-list').appendChild(card);
    }
  });
  body.insertAdjacentHTML('beforeend', sec('Add a slide'));
  const lay = document.createElement('div'); lay.className = 'grid g3'; body.appendChild(lay);
  blankSlideLayouts().forEach((L) => {
    const b = document.createElement('button'); b.className = 'tpl-item'; b.title = L.name;
    b.innerHTML = `<div class="thumb"></div><div class="meta" style="font-size:11px">${L.name}</div>`;
    b.querySelector('.thumb').appendChild(miniSlide(L.build(), state.doc, 96));
    b.onclick = () => { state.doc.slides.splice(state.slide + 1, 0, L.build()); state.slide++; state.sel = []; commit(); emit('slide'); };
    lay.appendChild(b);
  });
  const tags = [...new Set(TEMPLATES.map((t) => t.tag))];
  body.insertAdjacentHTML('beforeend', sec('Templates') + `<div class="chips">${['All', ...tags].map((c) => `<button class="chip ${(chip || 'All') === c ? 'on' : ''}" data-chip="${c}">${tr(c)}</button>`).join('')}</div><p class="hint">Click a template to add all its slides, or a single slide to add just that one.</p>`);
  const list = document.createElement('div'); list.className = 'tpl-list'; body.appendChild(list);
  for (const t of TEMPLATES.filter((t) => (!chip || chip === 'All' || t.tag === chip) && (!q || (t.name + ' ' + t.tag + ' ' + tr(t.name) + ' ' + tr(t.tag)).toLowerCase().includes(q)))) {
    const slides = t.build();
    const card = document.createElement('div'); card.className = 'tpl-item';
    card.innerHTML = `<button class="thumb" style="display:block;width:100%;padding:0"></button><div class="meta">${tr(t.name)}<small>${tr(t.tag)} · ${tr('{n} slides', { n: slides.length })}</small></div><div class="grid g4" style="padding:0 8px 8px"></div>`;
    card.querySelector('.thumb').appendChild(miniSlide(slides[0], state.doc, 310));
    card.querySelector('.thumb').onclick = () => applyTemplate(t);
    slides.forEach((s, i) => {
      const mb = document.createElement('button'); mb.style.cssText = 'border-radius:4px;overflow:hidden;border:1px solid var(--line);padding:0'; mb.title = tr('Add this slide');
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

// ---------- Elements ----------
const CATS = [
  ['shapes', 'Lines & shapes', 'shapes'], ['tables', 'Tables', 'table'], ['charts', 'Charts', 'chart-column'], ['graphics', 'Illustrations', 'palette'],
  ['stickers', 'Stickers', 'sticker'], ['icons', 'Icons', 'smile-plus'], ['frames', 'Frames', 'frame'], ['grids', 'Grids', 'layout-grid'],
  ['mockups', 'Mockups', 'monitor-smartphone'], ['flags', 'Flags', 'flag'], ['logos', 'Logos', 'badge-check'], ['more', 'QR code & drawing', 'qr-code'],
];
const LINE_PRESETS = [
  { capEnd: 'none', dash: 'solid', n: 'Line' }, { capEnd: 'arrow', dash: 'solid', n: 'Arrow line' }, { capStart: 'arrow', capEnd: 'arrow', dash: 'solid', n: 'Double arrow line' },
  { capEnd: 'none', dash: 'dashed', n: 'Dashed line' }, { capEnd: 'none', dash: 'dotted', n: 'Dotted line' }, { capEnd: 'triangle', dash: 'solid', n: 'Triangle arrow line' },
  { capStart: 'circle', capEnd: 'circle', dash: 'solid', n: 'Connector' }, { capEnd: 'arrow', kind: 'elbow', n: 'Elbow connector' }, { capEnd: 'arrow', kind: 'curve', n: 'Curved arrow' },
  { capStart: 'bar', capEnd: 'bar', dash: 'solid', n: 'Dimension line' }, { capEnd: 'diamond', dash: 'solid', n: 'Diamond line' }, { capEnd: 'square', dash: 'dashed', n: 'Dashed square line' },
];
const GRIDS = [[[1]], [[1, 1]], [[1], [1]], [[1, 1, 1]], [[1, 1], [1, 1]], [[2, 1]], [[1, 2]], [[1, 1, 1], [1, 1, 1]], [[1], [1, 1]], [[1, 1], [1]], [[1, 1, 1, 1]], [[1, 1], [1, 1], [1, 1]], [[3, 1], [1, 1, 1, 1]], [[1, 1, 1], [1]], [[2, 1], [1, 2]], [[1, 1, 1], [1, 1, 1], [1, 1, 1]]];
const shapeTile = (k, fill = '#8D74FF') => `<button class="tile" title="${tr(SHAPES[k].name)}" aria-label="${tr(SHAPES[k].name)}" ${item({ k: 'shape', shape: k })}>${shapeSvg(k, fill)}</button>`;
function lineTile(p) {
  const el = makeLine(8, 30, 112, 30, { strokeWidth: 5, ...p }); el.x = 0; el.y = 0;
  return `<button class="tile line" title="${tr(p.n)}" aria-label="${tr(p.n)}" ${item({ k: 'line', ...p, n: undefined })}>${renderLine(el)}</button>`;
}
const packTile = (pack, name, it, kind) => it ? `<button class="tile ${isMono(pack) ? 'icon' : ''}" title="${esc(name.replace(/-/g, ' '))}" ${item({ k: kind, pack, name })}>${packSvg(pack, it, '#1E1F2B')}</button>` : '';
const st3dTile = (name) => `<button class="tile" title="${esc(name.replace(/-/g, ' '))}" ${item({ k: 'sticker3d', name })}><img loading="lazy" src="${sticker3dUrl(name)}" alt=""></button>`;
const frameTile = (frame) => {
  if (frame.startsWith('glyph:')) return `<button class="tile" title="${frame.slice(6)}" ${item({ k: 'frame', frame })}><svg viewBox="0 0 100 100"><path d="${lib.glyphs?.[frame.slice(6)] || ''}" fill="#D9DBE6" fill-rule="evenodd"/></svg></button>`;
  if (frame.startsWith('device:')) { const s = frameSpec(frame); return `<button class="tile" title="${tr(frame.slice(7))}" ${item({ k: 'frame', frame })}><svg viewBox="0 0 100 100">${s.under ? s.over : ''}<rect x="${s.inset[0]}" y="${s.inset[1]}" width="${s.inset[2]}" height="${s.inset[3]}" fill="#D9DBE6"/>${s.under ? '' : s.over}</svg></button>`; }
  return `<button class="tile" title="${tr(SHAPES[frame]?.name || frame)}" ${item({ k: 'frame', frame })}>${shapeSvg(frame, '#D9DBE6')}</button>`;
};
const gridTile = (i) => { const L = GRIDS[i]; const rows = L.length; return `<button class="tile" title="${tr('Grid')}" ${item({ k: 'grid', layout: i })}><svg viewBox="0 0 100 100">${L.flatMap((row, r) => { const tot = row.reduce((a, b) => a + b, 0); let x = 4; return row.map((f) => { const w = (92 - 4 * (row.length - 1)) * f / tot, s = `<rect x="${x}" y="${4 + r * (92 / rows)}" width="${w}" height="${92 / rows - 4}" rx="3" fill="#D9DBE6"/>`; x += w + 4; return s; }); }).join('')}</svg></button>`; };
const tableTile = (preset) => { const p = TABLE_PRESETS[preset]; return `<button class="tile wide" title="${tr(p.name)}" ${item({ k: 'table', preset })}><div class="mini-table"><div style="background:${p.headerFill === 'transparent' ? '#fff' : p.headerFill};border-bottom:2px solid ${p.border === 'none' ? 'transparent' : p.borderColor}"></div>${[0, 1, 2].map((i) => `<div style="background:${p.banded && i % 2 === 0 ? p.bandFill : p.fill === 'transparent' ? '#fff' : p.fill};border-bottom:1px solid ${p.border === 'none' || p.border === 'outer' ? 'transparent' : p.borderColor}"></div>`).join('')}</div></button>`; };
const chartTile = (kind) => `<button class="tile icon" title="${tr(CHART_KINDS.find((k) => k[0] === kind)[1])}" ${item({ k: 'chart', kind })}>${ic({ column: 'chart-column', bar: 'chart-bar', line: 'chart-line', area: 'chart-area', pie: 'chart-pie', donut: 'circle-dot-dashed' }[kind], 'ic big')}</button>`;

function elements(body, q) {
  if (q) return searchView(body, q);
  if (sub) return categoryView(body);
  // ----- the home of Elements: one row per category, "See all" opens it -----
  body.insertAdjacentHTML('beforeend', `<div class="chips scroll">${CATS.map(([id, label, icon]) => `<button class="chip" data-sub="${id}">${ic(icon)} ${tr(label)}</button>`).join('')}</div>`);
  const rec = recent();
  if (rec.length) body.insertAdjacentHTML('beforeend', sec('Recently used') + `<div class="row">${rec.map(recentTile).join('')}</div>`);
  body.insertAdjacentHTML('beforeend', sec('Lines & shapes', seeAll('shapes', Object.keys(SHAPES).length)) + `<div class="row">${['rect', 'circle', 'triangle', 'star5', 'arrowR', 'bubble', 'heart', 'hexagon', 'ribbon', 'blob1', 'seal', 'pin'].map((k) => shapeTile(k)).join('')}${[LINE_PRESETS[0], LINE_PRESETS[1], LINE_PRESETS[7]].map(lineTile).join('')}</div>`);
  body.insertAdjacentHTML('beforeend', sec('Tables', seeAll('tables')) + `<div class="row tables">${Object.keys(TABLE_PRESETS).slice(0, 4).map(tableTile).join('')}</div>`);
  body.insertAdjacentHTML('beforeend', sec('Charts', seeAll('charts')) + `<div class="row">${CHART_KINDS.map(([k]) => chartTile(k)).join('')}</div>`);
  const gfx = packsOf('graphics');
  body.insertAdjacentHTML('beforeend', sec('Illustrations', seeAll('graphics', gfx.reduce((a, p) => a + p.count, 0))) + `<div class="row">${gfx.map((p) => { const s = lib.samples?.[p.id]; const n = s && Object.keys(s)[0]; return n ? `<button class="tile style" title="${styleLabel(p.id)}" data-sub="graphics" data-chip="${p.id}">${packSvg(p.id, s[n])}<span>${tr(styleLabel(p.id))}</span></button>` : ''; }).join('')}</div>`);
  const st = Object.keys(lib.st3d || {});
  body.insertAdjacentHTML('beforeend', sec('Stickers', seeAll('stickers')) + `<div class="row">${['rocket', 'red-heart', 'star', 'fire', 'light-bulb', 'party-popper', 'trophy', 'thumbs-up', 'sparkles', 'money-bag', 'bullseye', 'hundred-points', 'check-mark-button', 'grinning-face', 'clapping-hands', 'crown'].filter((n) => st.includes(n)).map(st3dTile).join('')}</div>`);
  const ico = packsOf('icons');
  body.insertAdjacentHTML('beforeend', sec('Icons', seeAll('icons', ico.reduce((a, p) => a + p.count, 0) + Object.keys(packs.lucide).length)) + `<div class="row">${['star', 'heart', 'check', 'arrow-right', 'map-pin', 'phone', 'mail', 'calendar', 'clock', 'user', 'globe', 'lightbulb', 'trending-up', 'shield-check', 'rocket', 'award'].map((n) => `<button class="tile icon" title="${n}" ${item({ k: 'icon', name: n })}>${lucideSvg(n)}</button>`).join('')}</div>`);
  body.insertAdjacentHTML('beforeend', sec('Frames', seeAll('frames')) + `<p class="hint">${tr('Add a frame, then click a photo — it fills the selected frame.')}</p><div class="row">${['circle', 'rounded', 'arch', 'heart', 'blob1', 'hexagon', 'star5', 'glyph:A', 'glyph:1', 'device:phone', 'device:laptop', 'device:polaroid'].map(frameTile).join('')}</div>`);
  body.insertAdjacentHTML('beforeend', sec('Grids', seeAll('grids')) + `<div class="row">${GRIDS.slice(0, 8).map((_, i) => gridTile(i)).join('')}</div>`);
  body.insertAdjacentHTML('beforeend', sec('Mockups', seeAll('mockups')) + `<div class="row">${DEVICE_FRAMES.slice(0, 5).map((d) => frameTile('device:' + d)).join('')}</div>`);
  const fl = lib.samples?.['circle-flags'] || {};
  body.insertAdjacentHTML('beforeend', sec('Flags', seeAll('flags')) + `<div class="row">${['fr', 'us', 'gb', 'de', 'es', 'it', 'ca', 'sn', 'ma', 'be', 'ch', 'jp', 'br', 'cn', 'eu'].map((c) => fl[c] ? packTile('circle-flags', c, fl[c], 'sticker') : '').join('')}</div>`);
  const lg = Object.keys(packs.logos);
  body.insertAdjacentHTML('beforeend', sec('Logos', seeAll('logos')) + `<div class="row">${['google-icon', 'microsoft-icon', 'apple', 'youtube-icon', 'instagram-icon', 'facebook', 'linkedin-icon', 'tiktok-icon', 'whatsapp-icon', 'slack-icon', 'figma', 'notion-icon'].filter((n) => lg.includes(n)).map((n) => `<button class="tile" title="${n}" ${item({ k: 'logo', name: n })}>${iconifySvg(packs.logos[n])}</button>`).join('')}</div>`);
  body.insertAdjacentHTML('beforeend', sec('More') + `<div class="grid g2">
    <button class="text-preset" ${item({ k: 'qr' })}>${ic('qr-code')} ${tr('QR code')}<small>${tr('Any link or text, offline')}</small></button>
    <button class="text-preset" data-draw="pen">${ic('pen-tool')} ${tr('Draw')}<small>${tr('Pen, marker, highlighter')}</small></button></div>`);
  if (!lib.samples) body.insertAdjacentHTML('beforeend', '<div class="spinner"></div>');
}
function recentTile(it) {
  if (it.k === 'shape') return shapeTile(it.shape);
  if (it.k === 'line') return lineTile({ ...it, n: 'Line' });
  if (it.k === 'sticker3d') return st3dTile(it.name);
  if (it.k === 'frame') return frameTile(it.frame);
  if (it.k === 'grid') return gridTile(it.layout);
  if (it.k === 'table') return tableTile(it.preset || 'header');
  if (it.k === 'chart') return chartTile(it.kind || 'column');
  if (it.k === 'icon' && !it.pack) return `<button class="tile icon" title="${esc(it.name)}" ${item(it)}>${lucideSvg(it.name)}</button>`;
  if (it.k === 'logo' && !it.pack) return packs.logos[it.name] ? `<button class="tile" title="${esc(it.name)}" ${item(it)}>${iconifySvg(packs.logos[it.name])}</button>` : '';
  if (it.k === 'sticker' && !it.pack) return packs.stickers[it.name] ? `<button class="tile" title="${esc(it.name)}" ${item(it)}>${iconifySvg(packs.stickers[it.name])}</button>` : '';
  if (it.pack) { const d = iconOf(it.pack, it.name); return d ? packTile(it.pack, it.name, d, it.k) : ''; }
  if (it.k === 'qr') return `<button class="tile icon" ${item(it)}>${ic('qr-code', 'ic big')}</button>`;
  return '';
}

// ----- one category, with its chips -----
const head = (title) => `<div class="cat-head"><button class="cb" data-sub="">${ic('arrow-left')}</button><h3>${tr(title)}</h3></div>`;
const chips = (list, cur) => `<div class="chips scroll">${list.map(([id, label]) => `<button class="chip ${cur === id ? 'on' : ''}" data-chip="${id}">${tr(label)}</button>`).join('')}</div>`;
async function categoryView(body) {
  const title = CATS.find((c) => c[0] === sub)?.[1] || sub;
  body.insertAdjacentHTML('beforeend', head(title));
  switch (sub) {
    case 'shapes': {
      const cats = [['all', 'All'], ['lines', 'Lines'], ...SHAPE_CATS];
      body.insertAdjacentHTML('beforeend', chips(cats, chip || 'all'));
      if (chip === 'lines') { body.insertAdjacentHTML('beforeend', `<p class="hint">${tr('Drag the round handles at both ends to place a line. Its caps, dashes and curve are in the toolbar.')}</p><div class="grid g3">${LINE_PRESETS.map(lineTile).join('')}</div>`); break; }
      if (!chip || chip === 'all') { body.insertAdjacentHTML('beforeend', sec('Lines') + `<div class="grid g4">${LINE_PRESETS.slice(0, 8).map(lineTile).join('')}</div>`); for (const [id, label] of SHAPE_CATS) body.insertAdjacentHTML('beforeend', sec(label) + `<div class="grid g4">${Object.keys(SHAPES).filter((k) => SHAPES[k].cat === id).map((k) => shapeTile(k)).join('')}</div>`); }
      else body.insertAdjacentHTML('beforeend', `<div class="grid g4">${Object.keys(SHAPES).filter((k) => SHAPES[k].cat === chip).map((k) => shapeTile(k)).join('')}</div>`);
      break;
    }
    case 'tables': {
      body.insertAdjacentHTML('beforeend', `<p class="hint">${tr('Double-click a cell to type. Tab moves to the next cell. Rows, columns, colours and borders are in the toolbar.')}</p><div class="sec"><h3>${tr('Size')}</h3></div><div class="table-size" id="tblSize"></div>` + sec('Styles') + `<div class="grid g2 tables">${Object.keys(TABLE_PRESETS).map(tableTile).join('')}</div>`);
      const box = body.querySelector('#tblSize'); let R = 3, C = 3;
      const draw = () => { box.innerHTML = `<div class="size-pick">${Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => `<i data-r="${r + 1}" data-c="${c + 1}" class="${r < R && c < C ? 'on' : ''}"></i>`).join('')).join('')}</div><div class="hint">${R} × ${C}</div>`; };
      draw();
      box.onmouseover = (e) => { const i = e.target.closest('i'); if (i) { R = +i.dataset.r; C = +i.dataset.c; draw(); } };
      box.onclick = (e) => { const i = e.target.closest('i'); if (i) addItem({ k: 'table', preset: 'header', rows: +i.dataset.r, cols: +i.dataset.c }); };
      box.addEventListener('mouseleave', () => { R = 3; C = 3; draw(); });
      break;
    }
    case 'charts': body.insertAdjacentHTML('beforeend', `<p class="hint">${tr('Pick a chart, then edit its data in the toolbar (Data). Paste from Excel works too.')}</p><div class="grid g3">${CHART_KINDS.map(([k, label]) => `<button class="tile tall" title="${tr(label)}" ${item({ k: 'chart', kind: k })}>${ic({ column: 'chart-column', bar: 'chart-bar', line: 'chart-line', area: 'chart-area', pie: 'chart-pie', donut: 'circle-dot-dashed' }[k], 'ic big')}<span>${tr(label)}</span></button>`).join('')}</div>`); break;
    case 'graphics': case 'icons': case 'stickers': case 'flags': case 'logos': await packView(body); break;
    case 'frames': {
      body.insertAdjacentHTML('beforeend', chips([['shapes', 'Shapes'], ['letters', 'Letters & numbers'], ['devices', 'Devices & special']], chip || 'shapes'));
      const c = chip || 'shapes';
      const list = c === 'letters' ? Object.keys(lib.glyphs || {}).map((g) => 'glyph:' + g) : c === 'devices' ? DEVICE_FRAMES.map((d) => 'device:' + d) : [...FRAME_SHAPES, ...Object.keys(SHAPES).filter((k) => !FRAME_SHAPES.includes(k) && !SHAPES[k].stroke)];
      body.insertAdjacentHTML('beforeend', `<p class="hint">${tr('Add a frame, then click a photo — it fills the selected frame.')}</p>`);
      lazyGrid(body, list, 'grid g4', frameTile, 60);
      break;
    }
    case 'grids': body.insertAdjacentHTML('beforeend', `<p class="hint">${tr('A grid adds several photo frames at once. Drop a photo on each one.')}</p><div class="grid g3">${GRIDS.map((_, i) => gridTile(i)).join('')}</div>`); break;
    case 'mockups': body.insertAdjacentHTML('beforeend', `<p class="hint">${tr('A device with your picture on its screen. Click a photo to fill it; the bezel colour is in the toolbar.')}</p><div class="grid g3">${DEVICE_FRAMES.map((d) => frameTile('device:' + d)).join('')}</div>`); break;
    case 'more': body.insertAdjacentHTML('beforeend', `<div class="grid g1"><button class="text-preset" ${item({ k: 'qr' })}>${ic('qr-code')} ${tr('QR code')}<small>${tr('Any link or text, offline')}</small></button>${Object.keys(DRAW_TOOLS).map((t) => `<button class="text-preset" data-draw="${t}">${ic({ pen: 'pen-tool', marker: 'brush', highlighter: 'highlighter' }[t])} ${tr({ pen: 'Pen', marker: 'Marker', highlighter: 'Highlighter' }[t])}</button>`).join('')}</div>`); break;
  }
}
// a category made of packs: chips = the packs (styles), one grid of the chosen pack
async function packView(body) {
  const kind = sub;
  let list = packsOf(kind).map((p) => [p.id, styleLabel(p.id)]);
  if (kind === 'icons') list = [['lucide', 'Lucide'], ...list];
  if (kind === 'stickers') list = [['stickers3d', '3D'], ['stickers', 'Flat'], ...list];
  if (kind === 'logos') list = [['logos', 'Logos'], ...list];
  const cur = chip || list[0][0];
  body.insertAdjacentHTML('beforeend', chips(list, cur));
  const p = packInfo(cur);
  if (p?.license) body.insertAdjacentHTML('beforeend', `<p class="hint">${esc(p.name)} · ${esc(p.license)}${/cc by/i.test(p.license) ? ' · ' + tr('credit the author when you publish (see Credits)') : ''}</p>`);
  if (kind === 'logos') body.insertAdjacentHTML('beforeend', `<p class="hint">${tr('Brand logos are trademarks of their owners — use them to refer to the brand.')}</p>`);
  const grid = document.createElement('div'); body.appendChild(grid);
  if (cur === 'stickers3d') {
    const cats = sticker3dCats();
    const sub2 = state.stCat || 'All';
    grid.insertAdjacentHTML('beforeend', `<div class="chips">${['All', ...cats].map((c) => `<button class="chip small ${sub2 === c ? 'on' : ''}" data-stcat="${c}">${tr(c)}</button>`).join('')}</div>`);
    lazyGrid(grid, Object.keys(lib.st3d).filter((n) => sub2 === 'All' || lib.st3d[n] === sub2), 'grid g4', st3dTile, 60);
    return;
  }
  if (!packLoaded(cur)) { grid.innerHTML = '<div class="spinner"></div>'; await loadPack(cur); if (tab !== 'elements' || sub !== kind || (chip || list[0][0]) !== cur) return; grid.innerHTML = ''; }
  const icons = cur === 'lucide' ? packs.lucide : cur === 'stickers' ? packs.stickers : cur === 'logos' ? packs.logos : lib.loaded.get(cur) || {};
  const cats = cur === 'stickers' ? [...new Set(Object.values(icons).map((v) => v.c))] : Object.keys(p?.cats || {});
  let names = Object.keys(icons);
  if (cats.length) {
    const sub2 = state.stCat || 'All';
    grid.insertAdjacentHTML('beforeend', `<div class="chips">${['All', ...cats].map((c) => `<button class="chip small ${sub2 === c ? 'on' : ''}" data-stcat="${c}">${tr(c)}</button>`).join('')}</div>`);
    if (sub2 !== 'All') names = cur === 'stickers' ? names.filter((n) => icons[n].c === sub2) : (p.cats[sub2] || []);
  }
  if (cur === 'logos') names = names.filter((n) => !n.endsWith('-icon'));
  grid.insertAdjacentHTML('beforeend', `<p class="hint">${tr('{n} elements', { n: names.length.toLocaleString('fr-FR') })}${isMono(cur) ? ' · ' + tr('pick a colour after adding') : ''}</p>`);
  const k = kind === 'icons' ? 'icon' : kind === 'logos' ? 'logo' : 'sticker';
  lazyGrid(grid, names, 'grid g5', (n) => packTile(cur, n, icons[n], k), 100);
}

// ----- search across everything -----
async function searchView(body, q) {
  const terms = queryTerms(q);
  const scope = sub; // searching inside a category keeps to it
  body.insertAdjacentHTML('beforeend', `<div class="cat-head"><button class="cb" data-clear>${ic('arrow-left')}</button><h3>${tr('Results for “{q}”', { q: esc(q) })}${scope ? ` · ${tr(CATS.find((c) => c[0] === scope)?.[1] || scope)}` : ''}</h3></div><div class="spinner" id="srchSpin"></div>`);
  await loadNames();
  if (query.toLowerCase() !== q) return;
  body.querySelector('#srchSpin')?.remove();
  let total = 0;
  const section = (title, subId, tiles, n) => { if (!tiles.length) return; total += n ?? tiles.length; body.insertAdjacentHTML('beforeend', sec(`${tr(title)} <small>${(n ?? tiles.length).toLocaleString('fr-FR')}</small>`, n > tiles.length ? seeAll(subId) : '') + `<div class="grid g4">${tiles.join('')}</div>`); };
  const want = (k) => !scope || scope === k;
  // things that are not in packs
  if (want('shapes')) {
    const sh = Object.keys(SHAPES).filter((k) => matches(k + ' ' + SHAPES[k].name + ' ' + tr(SHAPES[k].name) + ' ' + SHAPES[k].cat, terms)).sort((a, b) => score(SHAPES[b].name, terms) - score(SHAPES[a].name, terms));
    const ln = LINE_PRESETS.filter((p) => matches(p.n + ' ' + tr(p.n) + ' line', terms));
    section('Lines & shapes', 'shapes', [...ln.map(lineTile), ...sh.slice(0, 24).map((k) => shapeTile(k))], ln.length + sh.length);
  }
  const intent = (words) => terms.some((alts) => alts.some((a) => words.includes(a)));
  if (want('tables') && intent(['table', 'tableau', 'grid', 'spreadsheet', 'cell', 'row', 'column'])) section('Tables', 'tables', Object.keys(TABLE_PRESETS).map(tableTile));
  if (want('charts') && intent(['chart', 'graph', 'pie', 'bar', 'column', 'line', 'area', 'donut', 'data', 'statistics', 'diagram'])) section('Charts', 'charts', CHART_KINDS.map(([k]) => chartTile(k)));
  if (want('frames') && intent(['frame', 'cadre', 'photo', 'picture', 'letter', 'number', 'mask'])) section('Frames', 'frames', ['circle', 'rounded', 'arch', 'heart', 'blob1', 'hexagon', 'glyph:A', 'device:phone'].map(frameTile));
  if (want('grids') && intent(['grid', 'collage', 'layout', 'gallery'])) section('Grids', 'grids', GRIDS.slice(0, 8).map((_, i) => gridTile(i)));
  if (want('mockups') && intent(['mockup', 'device', 'phone', 'laptop', 'tablet', 'browser', 'monitor', 'screen', 'polaroid', 'film'])) section('Mockups', 'mockups', DEVICE_FRAMES.map((d) => frameTile('device:' + d)));
  if (intent(['qr', 'code', 'link', 'url'])) section('QR code', 'more', [`<button class="tile icon" ${item({ k: 'qr' })}>${ic('qr-code', 'ic big')}</button>`]);
  if (intent(['draw', 'pen', 'marker', 'highlighter', 'drawing', 'sketch'])) section('Draw', 'more', Object.keys(DRAW_TOOLS).map((t) => `<button class="tile icon" data-draw="${t}" title="${tr(t)}">${ic({ pen: 'pen-tool', marker: 'brush', highlighter: 'highlighter' }[t], 'ic big')}</button>`));
  // packs: the default ones + every pack already loaded (+ the chosen one when inside a category)
  const perKind = { icons: ['Icons', 'icon'], graphics: ['Illustrations', 'sticker'], stickers: ['Stickers', 'sticker'], flags: ['Flags', 'sticker'], logos: ['Logos', 'logo'] };
  for (const [kind, [title, k]] of Object.entries(perKind)) {
    if (!want(kind)) continue;
    let ids = [...new Set([...(scope === kind && chip ? [chip] : []), ...DEFAULT_PACKS[kind], ...packsOf(kind).map((p) => p.id).filter(packLoaded)])];
    if (scope === kind && chip) ids = [chip];
    const tiles = [], per = scope ? 400 : 48; let n = 0;
    for (const id of ids) {
      const names = searchPackNames(id, q, per);
      n += names.length;
      if (!names.length || tiles.length >= per) continue;
      if (id === 'stickers3d') { tiles.push(...names.slice(0, per - tiles.length).map(st3dTile)); continue; }
      if (!packLoaded(id)) await loadPack(id);
      if (query.toLowerCase() !== q) return;
      const icons = id === 'lucide' ? packs.lucide : id === 'stickers' ? packs.stickers : id === 'logos' ? packs.logos : lib.loaded.get(id);
      tiles.push(...names.slice(0, per - tiles.length).map((nm) => (id === 'lucide' ? `<button class="tile icon" title="${nm}" ${item({ k: 'icon', name: nm })}>${lucideSvg(nm)}</button>` : packTile(id, nm, icons[nm], k))));
    }
    section(title, kind, tiles, n);
  }
  if (!total) {
    const sug = suggestions(q);
    body.insertAdjacentHTML('beforeend', `<div class="empty-state">${ic('search-x', 'ic big')}<b>${tr('No result for “{q}”', { q: esc(q) })}</b>${sug.length ? `<p class="hint">${tr('Try:')} ${sug.map((s) => `<button class="chip small" data-q="${esc(s)}">${esc(s)}</button>`).join(' ')}</p>` : ''}<p class="hint">${tr('Tip: search in French or English — table, flèche, star, cœur…')}</p></div>`);
  } else if (!scope) body.insertAdjacentHTML('beforeend', `<p class="hint">${tr('Open a category (See all) to search its other styles too.')}</p>`);
  if (!scope && (want('icons') || want('graphics'))) webIcons(body, q);
}

// ---------- Text ----------
const FONT_COMBOS = [
  ['Poppins', 'Inter', 'Big launch', 'Clear supporting line'], ['Playfair Display', 'Lora', 'Elegant story', 'With a classic touch'],
  ['Bebas Neue', 'Montserrat', 'MAKE IT LOUD', 'Strong, sporty and bold'], ['Pacifico', 'Nunito', 'Hello friends', 'Warm and playful'],
  ['DM Serif Display', 'Inter', 'Editorial look', 'Calm and confident'], ['Space Grotesk', 'Space Grotesk', 'Future ready', 'Modern tech style'],
  ['Archivo Black', 'Raleway', 'IMPACT', 'Heavy headline, light body'], ['Caveat', 'Nunito', 'Handwritten note', 'Friendly and personal'],
  ['Abril Fatface', 'Lato', 'Bold editorial', 'A magazine feeling'], ['Anton', 'Roboto', 'STRAIGHT TALK', 'Direct and industrial'],
  ['Cormorant Garamond', 'Mulish', 'Refined luxury', 'Quiet elegance'], ['Fredoka', 'Nunito', 'Playful & round', 'Friendly for everyone'],
];
const FONT_CATS = [['all', 'All'], ['sans', 'Sans'], ['serif', 'Serif'], ['display', 'Display'], ['script', 'Handwriting'], ['mono', 'Mono'], ['custom', 'My fonts']];
function text(body, q) {
  if (!q) {
    body.insertAdjacentHTML('beforeend', `<button class="btn primary block" ${item({ k: 'text', preset: 'body' })} style="margin:6px 0 12px">${ic('type')} ${tr('Add a text box')}</button>`
      + sec('Default text styles')
      + `<button class="text-preset" ${item({ k: 'text', preset: 'h1' })}><div style="font:700 28px Poppins">${tr('Add a heading')}</div></button>`
      + `<button class="text-preset" ${item({ k: 'text', preset: 'h2' })}><div style="font:600 19px Inter">${tr('Add a subheading')}</div></button>`
      + `<button class="text-preset" ${item({ k: 'text', preset: 'body' })}><div style="font:400 14px Inter">${tr('Add a little bit of body text')}</div></button>`
      + `<button class="text-preset" ${item({ k: 'text', preset: 'list' })}><div style="font:400 14px Inter">• ${tr('Add a bullet list')}</div></button>`
      + sec('Font combinations'));
    body.insertAdjacentHTML('beforeend', FONT_COMBOS.map(([a, b, t1, t2], i) => `<button class="combo" ${item({ k: 'combo', i })}><div style="font:700 26px '${a}'">${tr(t1)}</div><div style="font:400 14px '${b}';color:#5B5E73;margin-top:6px">${tr(t2)}</div></button>`).join(''));
  }
  body.insertAdjacentHTML('beforeend', sec(tr('Fonts ({n})', { n: packs.fonts.length }), `<button id="fontUp">+ ${tr('Upload a font')}</button>`) + (q ? '' : chips(FONT_CATS, chip || 'all')));
  body.querySelector('#fontUp').onclick = () => uploadFont(renderPanel);
  const list = packs.fonts.filter((f) => (!q || f.toLowerCase().includes(q)) && (q || !chip || chip === 'all' || fontCat(f) === chip));
  lazyGrid(body, list, 'font-list', (f) => `<button class="font-row" ${item({ k: 'text', preset: 'body', font: f })}><span class="aa" style="font-family:'${f}'">Aa</span><span style="font-family:'${f}'">${f}</span></button>`, 40);
}

// ---------- Photos ----------
function photos(body, q) {
  const cats = [...new Set(packs.photos.map((p) => p.cat))];
  if (!q) body.insertAdjacentHTML('beforeend', `<div class="chips scroll">${['All', ...cats].map((c) => `<button class="chip ${((chip || 'All') === c) ? 'on' : ''}" data-chip="${c}">${tr(c)}</button>`).join('')}</div>`);
  const local = packs.photos.filter((p) => (!chip || chip === 'All' || p.cat === chip) && (!q || matches(p.cat + ' ' + tr(p.cat) + ' ' + p.title, queryTerms(q))));
  if (local.length) {
    body.insertAdjacentHTML('beforeend', sec(q ? tr('In your library ({n})', { n: local.length }) : tr('Library ({n} photos, offline)', { n: packs.photos.length })));
    lazyGrid(body, local, 'masonry', (p) => `<button class="tile" title="${esc(p.title)} — ${esc(p.creator)} (${esc(p.license)})" ${item({ k: 'photo', src: photoUrl(p), w: p.w, h: p.h, credit: `${p.creator} · ${p.license}` })}><img loading="lazy" src="${photoUrl(p)}" alt=""></button>`, 30);
  } else if (!q) body.insertAdjacentHTML('beforeend', `<div class="empty-note">${tr('No photos in the library yet.')}</div>`);
  if (q) webPhotos(body, q);
  else body.insertAdjacentHTML('beforeend', `<div class="online-box">${ic('globe')} <b>${tr('Need more?')}</b> ${tr('Type in the search box — when you are online, Deckly also searches millions of free photos on Wikimedia Commons and keeps the ones you use, so they work offline afterwards.')}</div>`);
}
async function webPhotos(body, q) {
  if (!onlineOk()) { body.insertAdjacentHTML('beforeend', `<div class="online-box">${ic('wifi-off')} ${tr('You are offline — showing only your library. Go online to search the web.')}</div>`); return; }
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
      if (!/cc0|public domain|^cc by(?!-sa)/i.test(lic)) return null;
      const artist = (md.Artist?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 60);
      return { k: 'webphoto', src: ii.thumburl, w: ii.thumbwidth, h: ii.thumbheight, credit: `${artist || 'Wikimedia Commons'} · ${lic}`, page: ii.descriptionurl };
    }).filter(Boolean);
    $('#webSpin')?.remove();
    lazyGrid(body, res, 'masonry', (r) => `<button class="tile" title="${esc(r.credit)}" ${item(r)}><img loading="lazy" src="${esc(r.src)}" alt=""><span class="badge">WEB</span></button>`, 40);
  } catch { $('#webSpin')?.remove(); body.insertAdjacentHTML('beforeend', `<div class="empty-note">${tr('Could not reach the web search.')}</div>`); }
}
// extra icons from the web (only sets whose licence allows commercial use)
const WEB_OK = /^(lucide|tabler|ph|mdi|ic|material-symbols|carbon|bi|ri|heroicons|iconoir|mingcute|hugeicons|fluent|fluent-color|solar|flat-color-icons|noto|twemoji|fluent-emoji|fluent-emoji-flat|logos|simple-icons|circle-flags|flag|healthicons|game-icons|akar-icons|bx|bxs|ion|octicon|uil|la|fa6-solid|fa6-regular|fa6-brands|streamline|streamline-emojis|icon-park|icon-park-outline|icon-park-solid|skill-icons|devicon|meteocons|pixelarticons|lets-icons|iconamoon|basil|majesticons|jam|teenyicons|radix-icons|tdesign|mynaui|cib|cil|gg|humbleicons|famicons|f7|clarity|codicon|garden|grommet-icons|vaadin|zondicons|system-uicons|maki|temaki|pinhead)$/;
async function webIcons(body, q) {
  if (!onlineOk()) return;
  body.insertAdjacentHTML('beforeend', sec('More icons from the web') + '<div class="spinner" id="webSpin"></div>');
  try {
    const s = await (await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=64`)).json();
    if (query.toLowerCase() !== q || tab !== 'elements') return;
    const byPrefix = {};
    for (const full of s.icons || []) { const [p, n] = full.split(':'); if (WEB_OK.test(p)) (byPrefix[p] ||= []).push(n); }
    const out = [];
    await Promise.all(Object.entries(byPrefix).map(async ([p, names]) => {
      const d = await (await fetch(`https://api.iconify.design/${p}.json?icons=${names.join(',')}`)).json();
      for (const n of names) { const v = d.icons?.[n]; if (v) out.push({ k: 'svg', name: `${p}:${n}`, data: { b: v.body, w: v.width || d.width || 24, h: v.height || d.height || 24 } }); }
    }));
    $('#webSpin')?.remove();
    lazyGrid(body, out, 'grid g5', (r) => `<button class="tile icon" title="${esc(r.name)}" ${item(r)}>${iconifySvg(r.data).replace('<svg ', '<svg style="color:#1E1F2B" ')}<span class="badge">WEB</span></button>`, 64);
  } catch { $('#webSpin')?.remove(); }
}

// ---------- Uploads ----------
async function uploads(body) {
  body.insertAdjacentHTML('beforeend', `<button class="btn primary block" id="upBtn" style="margin-top:6px">${ic('upload')} ${tr('Upload images')}</button>
    <div class="upload-drop" id="upDrop">${ic('image-plus')}<div style="margin-top:6px">${tr('Drop images here')}</div><div class="hint">${tr('They stay on this computer.')}</div></div>`);
  $('#upBtn').onclick = () => $('#fileUpload').click();
  const dz = $('#upDrop');
  dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('drag'); };
  dz.ondragleave = () => dz.classList.remove('drag');
  dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('drag'); uploadFiles([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')), null, false); };
  const all = (await libAll()).sort((a, b) => b.t - a.t);
  if (tab !== 'uploads') return;
  const up = all.filter((x) => x.kind === 'upload'), web = all.filter((x) => x.kind === 'web');
  const tile = (x) => `<div class="tile" ${item({ k: 'photo', src: x.src, w: x.w, h: x.h, credit: x.credit })}><img src="${x.src}" alt=""><button class="tile-x" data-delup="${x.id}" title="${tr('Delete')}">${ic('x')}</button></div>`;
  if (up.length) { body.insertAdjacentHTML('beforeend', sec('Your uploads')); lazyGrid(body, up, 'masonry', tile, 30); }
  if (web.length) { body.insertAdjacentHTML('beforeend', sec('Saved from the web') + `<p class="hint">${tr('Photos you used from the web — kept for offline use.')}</p>`); lazyGrid(body, web, 'masonry', tile, 30); }
  if (!up.length && !web.length) body.insertAdjacentHTML('beforeend', `<div class="empty-note">${tr('Nothing uploaded yet.')}</div>`);
  translateDom(body);
}

// ---------- Background ----------
function background(body) {
  const cur = curSlide().bg;
  const accent = '#6C4CF5';
  body.insertAdjacentHTML('beforeend', sec('Colour') + `<div class="swatches">${PALETTE.map((c) => `<button class="sw" style="background:${c}" data-bg='{"type":"color","value":"${c}"}' aria-label="${c}"></button>`).join('')}</div>`
    + `<button class="btn ghost block" id="bgCustom" style="margin-top:10px">${ic('pipette')} ${tr('Custom colour')}</button>`
    + sec('Gradients') + `<div class="swatches">${GRADIENTS.map((g) => `<button class="sw grad" style="background:${g}" data-bg='${JSON.stringify({ type: 'gradient', value: g })}'></button>`).join('')}</div>`
    + sec('Patterns') + `<div class="grid g3">${PATTERNS.flatMap(([n, fn]) => [[accent + '22', '#FFFFFF'], ['#FFFFFF22', '#1E1F2B'], ['#FF6B8B33', '#FFF6F8']].map(([c, b]) => `<button class="tile" title="${tr(n)}" style="${fn(c, b)}" data-bg='${JSON.stringify({ type: 'gradient', value: fn(c, b).replace(/^background(-color)?:/, '').split(';')[0] })}' data-pat="${n}" data-pc="${c}" data-pb="${b}"></button>`)).join('')}</div>`
    + `<div class="toggle-row" style="margin-top:14px"><span style="font-weight:600">${tr('Apply to all slides')}</span><button class="switch" id="bgAll" role="switch"></button></div>`);
  if (packs.photos.length) {
    body.insertAdjacentHTML('beforeend', sec('Photo backgrounds'));
    lazyGrid(body, packs.photos, 'grid g2', (p) => `<button class="tile photo" data-bg='${JSON.stringify({ type: 'image', value: photoUrl(p) })}'><img loading="lazy" src="${photoUrl(p)}" alt=""></button>`, 20);
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
  const st = e.target.closest('[data-stcat]'); if (st) { state.stCat = st.dataset.stcat === 'All' ? null : st.dataset.stcat; renderPanel(); return; }
  const sb = e.target.closest('[data-sub]');
  if (sb) { sub = sb.dataset.sub || null; chip = sb.dataset.chip || null; state.stCat = null; if (sb.dataset.sub) { query = ''; $('#panelSearch').value = ''; } renderPanel(); return; }
  const cl = e.target.closest('[data-clear]'); if (cl) { $('#searchClear').click(); return; }
  const qq = e.target.closest('[data-q]'); if (qq) { $('#panelSearch').value = qq.dataset.q; query = qq.dataset.q; renderPanel(); return; }
  const ch = e.target.closest('[data-chip]'); if (ch) { chip = ch.dataset.chip === 'All' || ch.dataset.chip === 'all' ? null : ch.dataset.chip; state.stCat = null; renderPanel(); return; }
  const dr = e.target.closest('[data-draw]'); if (dr) { startDraw(dr.dataset.draw); return; }
  const dl = e.target.closest('[data-delup]'); if (dl) { e.stopPropagation(); libDel(dl.dataset.delup).then(renderPanel); return; }
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
  remember(it);
  switch (it.k) {
    case 'shape': addElement({ type: 'shape', shape: it.shape, w: base * 0.3, h: base * 0.3, fill: '#8D74FF', stroke: '#1E1F2B', strokeWidth: 0, radius: SHAPES[it.shape]?.radius }, at); break;
    case 'line': { const x = at ? at.x - base * 0.2 : D.w / 2 - base * 0.2, y = at ? at.y : D.h / 2; const el = makeLine(x, y, x + base * 0.4, y, { strokeWidth: 6, capStart: it.capStart || 'none', capEnd: it.capEnd || 'none', dash: it.dash || 'solid', kind: it.kind || 'straight' }); el.x = el.x; addElement(el, null); break; }
    case 'frame': { const spec = frameSpec(it.frame); const r = spec.ratio || 1; const w = base * (r >= 1 ? 0.45 : 0.3); addElement({ type: 'image', src: PLACEHOLDER, placeholder: true, frame: it.frame, w, h: w / r, filters: {} }, at); break; }
    case 'grid': { addGrid(GRIDS[it.layout], at); break; }
    case 'icon': {
      if (it.pack) { const d = iconOf(it.pack, it.name) || (await loadPack(it.pack))[it.name]; if (!d) return; const r = (d.h || 24) / (d.w || 24); addElement({ type: 'icon', name: `${it.pack}:${it.name}`, data: { b: d.b, w: d.w || 24, h: d.h || 24, x: d.x, y: d.y }, w: base * 0.16, h: base * 0.16 * r, color: '#1E1F2B', sw: 2 }, at); }
      else addElement({ type: 'icon', name: it.name, w: base * 0.16, h: base * 0.16, color: '#1E1F2B', sw: 2 }, at);
      break;
    }
    case 'sticker': {
      if (it.pack) { const d = iconOf(it.pack, it.name) || (await loadPack(it.pack))[it.name]; if (!d) return; const w = d.w || 24, h = d.h || 24; addElement({ type: 'sticker', name: `${it.pack}:${it.name}`, data: { b: d.b, w, h, x: d.x, y: d.y }, w: base * 0.2, h: base * 0.2 * h / w }, at); }
      else { const s = packs.stickers[it.name]; addElement({ type: 'sticker', name: it.name, data: s, w: base * 0.2, h: base * 0.2 * (s?.h || 32) / (s?.w || 32) }, at); }
      break;
    }
    case 'sticker3d': addElement({ type: 'image', src: sticker3dUrl(it.name), w: base * 0.2, h: base * 0.2, frame: 'rect', filters: {}, sticker: it.name }, at); break;
    case 'logo': {
      if (it.pack) { const d = iconOf(it.pack, it.name) || (await loadPack(it.pack))[it.name]; if (!d) return; const r = (d.h || 24) / (d.w || 24); const w = r > 0.6 ? base * 0.2 : base * 0.35; addElement({ type: 'logo', name: `${it.pack}:${it.name}`, data: { b: d.b, w: d.w || 24, h: d.h || 24, x: d.x, y: d.y }, w, h: w * r }, at); }
      else { const s = packs.logos[it.name]; const r = (s?.h || 1) / (s?.w || 1); const w = r > 0.6 ? base * 0.2 : base * 0.35; addElement({ type: 'logo', name: it.name, data: s, w, h: w * r }, at); }
      break;
    }
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
      const h1 = { id: uid(), type: 'text', html: tr(t1), font: a, size: 120, bold: !['Bebas Neue', 'Pacifico', 'Caveat', 'Abril Fatface', 'Anton'].includes(a), color: c, align: 'center', lineHeight: 1.1, x, y, w: 1200, h: 140, rot: 0, opacity: 1 };
      const h2 = { id: uid(), type: 'text', html: tr(t2), font: b, size: 44, color: c, align: 'center', lineHeight: 1.3, x, y: y + 170, w: 1200, h: 60, rot: 0, opacity: 0.8 };
      h1.group = h2.group = 'g' + uid(); curSlide().elements.push(h1, h2); state.sel = [h1.id, h2.id]; commit(); emit('canvas'); break;
    }
    case 'table': { const el = tableDefaults(it.rows || 3, it.cols || 3, it.preset || 'header', base); el.cells[0] = el.cells[0].map((c, i) => ({ h: `${tr('Title')} ${i + 1}` })); addElement(el, at); toast('Double-click a cell to type'); break; }
    case 'chart': { const el = chartDefaults(it.kind, base); if (it.kind === 'pie' || it.kind === 'donut') el.labels = [tr('Product A'), tr('Product B'), tr('Product C'), tr('Other')]; addElement(el, at); toast('Click “Data” in the toolbar to enter your numbers'); break; }
    case 'qr': addElement(qrDefaults(base), at); toast('Edit the link in the toolbar'); break;
  }
}
function addGrid(layout, at) {
  const D = state.doc, gap = Math.round(Math.min(D.w, D.h) * 0.012);
  const W = D.w * 0.72, H = D.h * 0.72, ox = at ? at.x - W / 2 : (D.w - W) / 2, oy = at ? at.y - H / 2 : (D.h - H) / 2;
  const rows = layout.length, rh = (H - gap * (rows - 1)) / rows, els = [], g = 'g' + uid();
  layout.forEach((row, r) => { const tot = row.reduce((a, b) => a + b, 0); let x = ox; row.forEach((f) => { const w = (W - gap * (row.length - 1)) * f / tot; els.push({ id: uid(), type: 'image', src: PLACEHOLDER, placeholder: true, frame: 'rect', radius: 4, filters: {}, x, y: oy + r * (rh + gap), w, h: rh, rot: 0, opacity: 1, group: g }); x += w + gap; }); });
  curSlide().elements.push(...els); state.sel = els.map((e) => e.id); commit(); emit('canvas');
  toast('Drop a photo on each frame of the grid');
}
function imageTarget(at) {
  if (at) {
    const hit = [...curSlide().elements].reverse().find((e) => e.type === 'image' && !e.locked && !e.sticker && at.x >= e.x && at.x <= e.x + e.w && at.y >= e.y && at.y <= e.y + e.h);
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
    if (!f.type.startsWith('image/')) continue;
    const src = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
    const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    if (!img) continue;
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
