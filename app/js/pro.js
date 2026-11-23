// "Pro" features, free in Deckly: brand kit, magic resize, version history, custom fonts, animations.
import { state, emit, commit, curSlide, selected, libAll, libPut, libDel, uid, clone, newDoc, saveDoc, resetHistory } from './store.js';
import { packs, ic, PALETTE } from './assets.js';
import { miniSlide } from './render.js';
import { modal, closeModal, toast, popover, closePopover, openColorPopover, brandSwatches } from './ui.js';
import { t as tr, translateDom } from './i18n.js';

// ======================= BRAND KIT =======================
// Several brand kits (one per client, project or company); one is active at a time.
const newKit = (name) => ({ id: uid(), name, colors: [], heading: null, body: null, logos: [] });
let kits = [], activeKit = null;
export let brand = newKit('');
export async function loadBrand() {
  const all = await libAll();
  const store = all.find((x) => x.id === 'brandkits');
  if (store) { kits = store.kits || []; activeKit = store.active; }
  else {
    const old = all.find((x) => x.id === 'brandkit'); // first version had a single kit
    const k = newKit(tr('My brand'));
    if (old) Object.assign(k, { colors: old.colors || [], heading: old.heading || null, body: old.body || null, logos: old.logos || [] });
    kits = [k]; activeKit = k.id;
  }
  brand = kits.find((k) => k.id === activeKit) || kits[0];
  brandSwatches.list = brand.colors;
  // custom fonts
  for (const f of all.filter((x) => x.kind === 'font')) await registerFont(f);
}
const saveBrand = () => libPut({ id: 'brandkits', kind: 'brand', t: Date.now(), active: brand.id, kits: clone(kits) });

export function brandPanel(body, addItem) {
  const sw = brand.colors.map((c, i) => `<div class="brand-sw" style="background:${c}" data-bc="${c}" title="${c}"><button data-brm="${i}" title="Remove">${ic('x')}</button></div>`).join('');
  body.insertAdjacentHTML('beforeend', `<div class="online-box">${ic('gem')} <b>Brand kit</b> — Keep your colours, fonts and logos in one place, and use them in one click.</div>
    <div class="kit-bar"><select id="kitPick">${kits.map((k) => `<option value="${k.id}" ${k.id === brand.id ? 'selected' : ''}>${k.name.replace(/</g, '&lt;')}</option>`).join('')}</select>
      <button class="cb" id="kitRename" title="Rename">${ic('pencil')}</button><button class="cb" id="kitNew" title="New brand kit">${ic('plus')}</button>${kits.length > 1 ? `<button class="cb danger" id="kitDel" title="Delete this kit">${ic('trash-2')}</button>` : ''}</div>
    <div class="sec"><h3>Brand colours</h3></div>
    <div class="swatches">${sw}<button class="sw add-sw" id="brandAddColor" title="Add a colour">${ic('plus')}</button></div>
    <div class="sec"><h3>Brand fonts</h3></div>
    <div class="brand-font"><span>Headings</span><select id="brandHeading">${fontOptions(brand.heading)}</select></div>
    <div class="brand-font"><span>Body text</span><select id="brandBody">${fontOptions(brand.body)}</select></div>
    <button class="btn ghost block" id="brandApply" style="margin-top:8px">${ic('wand-sparkles')} Apply brand fonts to this design</button>
    <div class="sec"><h3>Brand logos</h3><button id="brandLogoBtn">+ Add</button></div>
    <div class="grid g3" id="brandLogos">${brand.logos.map((l, i) => `<div class="tile" data-blogo="${i}" title="Add to slide"><img src="${l.src}" style="width:80%;height:80%;object-fit:contain"><button class="tile-x" data-blrm="${i}">${ic('x')}</button></div>`).join('')}</div>
    ${brand.logos.length ? '' : '<p class="hint">Add your logo once — it stays here for every design.</p>'}
    <input type="file" id="brandLogoFile" accept="image/*" hidden>`);
  translateDom(body);
  const rerender = () => { body.innerHTML = ''; brandPanel(body, addItem); };
  const useKit = (k) => { brand = k; brandSwatches.list = brand.colors; saveBrand(); rerender(); };
  body.querySelector('#kitPick').onchange = (e) => useKit(kits.find((k) => k.id === e.target.value));
  body.querySelector('#kitNew').onclick = () => askName(tr('New brand kit'), tr('Brand kit {n}', { n: kits.length + 1 }), (name) => { const k = newKit(name); kits.push(k); useKit(k); });
  body.querySelector('#kitRename').onclick = () => askName(tr('Rename'), brand.name, (name) => { brand.name = name; saveBrand(); rerender(); });
  const del = body.querySelector('#kitDel');
  if (del) del.onclick = (e) => popover(e.currentTarget, `<div style="font-weight:600;margin-bottom:6px">${tr('Delete “{name}”?', { name: brand.name.replace(/</g, '&lt;') })}</div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost" data-no>Cancel</button><button class="btn primary" data-yes style="background:#C0354F;box-shadow:none">Delete</button></div>`, (p) => {
    p.querySelector('[data-no]').onclick = closePopover;
    p.querySelector('[data-yes]').onclick = () => { closePopover(); kits = kits.filter((k) => k !== brand); useKit(kits[0]); };
  });
  body.querySelector('#brandAddColor').onclick = (e) => openColorPopover(e.currentTarget, '#6C4CF5', () => {}, null, { onFinal: (c) => { if (!brand.colors.includes(c)) brand.colors.push(c); brandSwatches.list = brand.colors; saveBrand(); closePopover(); rerender(); } });
  body.querySelectorAll('[data-brm]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); brand.colors.splice(+b.dataset.brm, 1); saveBrand(); rerender(); }));
  body.querySelectorAll('[data-bc]').forEach((b) => (b.onclick = () => applyColor(b.dataset.bc)));
  body.querySelector('#brandHeading').onchange = (e) => { brand.heading = e.target.value || null; saveBrand(); };
  body.querySelector('#brandBody').onchange = (e) => { brand.body = e.target.value || null; saveBrand(); };
  body.querySelector('#brandApply').onclick = () => {
    if (!brand.heading && !brand.body) { toast('Choose your brand fonts first'); return; }
    let n = 0;
    for (const s of state.doc.slides) for (const el of s.elements) {
      if (el.type === 'text') { const f = el.size >= 60 ? brand.heading : brand.body; if (f) { el.font = f; n++; } }
      else if (el.type === 'table' && brand.body) { el.style.font = brand.body; n++; }
      else if (el.type === 'chart' && brand.body) { el.opts.font = brand.body; n++; }
      else if (el.type === 'shape' && el.text && brand.body) { el.text.font = brand.body; n++; }
    }
    commit(); emit('all'); toast(tr('Brand fonts applied to {n} texts', { n }));
  };
  body.querySelector('#brandLogoBtn').onclick = () => body.querySelector('#brandLogoFile').click();
  body.querySelector('#brandLogoFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const src = await fileToDataUrl(f); const img = await loadImg(src);
    brand.logos.push({ src, w: img?.width || 400, h: img?.height || 400 }); saveBrand(); rerender();
  };
  body.querySelectorAll('[data-blogo]').forEach((b) => (b.onclick = (e) => {
    if (e.target.closest('[data-blrm]')) { brand.logos.splice(+e.target.closest('[data-blrm]').dataset.blrm, 1); saveBrand(); rerender(); return; }
    const l = brand.logos[+b.dataset.blogo]; addItem({ k: 'photo', src: l.src, w: l.w, h: l.h });
  }));
}
function fontOptions(cur) {
  return `<option value="">—</option>` + packs.fonts.map((f) => `<option ${f === cur ? 'selected' : ''} style="font-family:'${f}'">${f}</option>`).join('');
}
// a brand colour clicked: colours the selection (text, shape, icon) or the slide background
function applyColor(c) {
  const els = selected();
  if (!els.length) { curSlide().bg = { type: 'color', value: c }; commit(); emit('canvas'); return; }
  for (const el of els) {
    if (el.type === 'text' || el.type === 'icon') el.color = c;
    else if (el.type === 'shape') { delete el.gradient; el.fill = c; }
    else if (el.type === 'line') el.stroke = c;
    else if (el.type === 'draw') { if (el.fill && el.fill !== 'none') el.fill = c; else el.stroke = c; }
    else if (el.type === 'table') el.style.headerFill = c;
    else if (el.type === 'qr') el.fg = c;
    else if (el.type === 'chart') { el.opts.colors = [c, ...(el.opts.colors || []).slice(1)]; }
  }
  commit(); emit('canvas');
}

// ======================= MAGIC RESIZE =======================
const SIZES = [['Presentation', 1920, 1080], ['Classic slides', 1600, 1200], ['Square post', 1080, 1080], ['Story / mobile', 1080, 1920], ['A4 document', 1240, 1754], ['YouTube thumbnail', 1280, 720], ['Facebook post', 1200, 630], ['A4 landscape', 1754, 1240]];
export function resizeDialog(openDoc) {
  const D = state.doc;
  modal(`<h3>${ic('scaling')} Magic resize</h3><p class="hint" style="font-size:13px">Pick a new size: every element is scaled and re-centred for you.</p>
    <div class="resize-grid">${SIZES.map(([n, w, h], i) => `<button class="resize-opt ${w === D.w && h === D.h ? 'cur' : ''}" data-rs="${i}"><span class="shape" style="width:${(w / Math.max(w, h)) * 34}px;height:${(h / Math.max(w, h)) * 34}px"></span><b>${n}</b><small>${w} × ${h}</small></button>`).join('')}</div>
    <div class="custom-size"><span>Custom size</span><input type="number" id="rsW" value="${D.w}" min="100" max="8000"> × <input type="number" id="rsH" value="${D.h}" min="100" max="8000"> px</div>
    <div class="toggle-row"><span>Keep the original and make a resized copy</span><button class="switch on" id="rsCopy"></button></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="rsGo">${ic('scaling')} Resize</button></div>`);
  const card = document.querySelector('#modalCard');
  card.querySelectorAll('[data-rs]').forEach((b) => (b.onclick = () => {
    card.querySelectorAll('[data-rs]').forEach((x) => x.classList.toggle('on', x === b));
    const [, w, h] = SIZES[+b.dataset.rs]; card.querySelector('#rsW').value = w; card.querySelector('#rsH').value = h;
  }));
  card.querySelector('#rsCopy').onclick = (e) => e.currentTarget.classList.toggle('on');
  card.querySelector('#rsGo').onclick = async () => {
    const nw = Math.round(+card.querySelector('#rsW').value), nh = Math.round(+card.querySelector('#rsH').value);
    if (!(nw >= 100 && nh >= 100 && nw <= 8000 && nh <= 8000)) { toast('Enter a size between 100 and 8000 px'); return; }
    const copy = card.querySelector('#rsCopy').classList.contains('on');
    const out = resizeDoc(copy ? clone(D) : D, nw, nh);
    if (copy) { out.id = uid(); out.title = `${D.title} (${nw}×${nh})`; out.created = out.updated = Date.now(); await saveDoc(out); closeModal(); openDoc(out); }
    else { closeModal(); commit(); emit('all'); }
    toast('Design resized');
  };
}
export function resizeDoc(doc, nw, nh) {
  const s = Math.min(nw / doc.w, nh / doc.h), ox = (nw - doc.w * s) / 2, oy = (nh - doc.h * s) / 2;
  for (const sl of doc.slides) for (const el of sl.elements) {
    el.x = el.x * s + ox; el.y = el.y * s + oy; el.w *= s; el.h *= s;
    if (el.size) el.size = Math.round(el.size * s * 10) / 10;
    if (el.strokeWidth) el.strokeWidth = Math.max(1, el.strokeWidth * s);
  }
  // full-bleed shapes / photos (covering the old slide) keep covering the new one
  for (const sl of doc.slides) for (const el of sl.elements) {
    if (Math.abs(el.w - doc.w * s) < 2 && Math.abs(el.h - doc.h * s) < 2) { el.x = 0; el.y = 0; el.w = nw; el.h = nh; }
  }
  doc.w = nw; doc.h = nh;
  return doc;
}

// ======================= VERSION HISTORY =======================
let lastVersion = 0;
export async function snapshotVersion(force = false) {
  if (!state.doc) return;
  if (!force && Date.now() - lastVersion < 5 * 60 * 1000) return; // at most every 5 minutes
  lastVersion = Date.now();
  await libPut({ id: `v-${state.doc.id}-${Date.now()}`, kind: 'version', doc: state.doc.id, t: Date.now(), data: clone(state.doc) });
  const mine = (await libAll()).filter((x) => x.kind === 'version' && x.doc === state.doc.id).sort((a, b) => b.t - a.t);
  for (const old of mine.slice(30)) await libDel(old.id); // keep the last 30
}
export async function versionsDialog() {
  await snapshotVersion(true);
  const list = (await libAll()).filter((x) => x.kind === 'version' && x.doc === state.doc.id).sort((a, b) => b.t - a.t);
  modal(`<h3>${ic('history')} Version history</h3><p class="hint" style="font-size:13px">Deckly keeps a copy of your design every few minutes while you work. Restore any of them.</p>
    <div class="versions" id="verList"></div>
    <div style="text-align:right;margin-top:12px"><button class="btn ghost" data-close>Close</button></div>`);
  const box = document.querySelector('#verList');
  list.forEach((v, i) => {
    const row = document.createElement('div'); row.className = 'ver-row';
    const when = new Date(v.t).toLocaleString(document.documentElement.lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    row.innerHTML = `<div class="ver-thumb"></div><div class="ver-meta"><b>${i === 0 ? tr('Current version') : when}</b><small>${tr('{n} slides', { n: v.data.slides.length })}${i === 0 ? '' : ''}</small></div>${i === 0 ? '' : `<button class="btn ghost" data-restore="${v.id}">${ic('rotate-ccw')} ${tr('Restore')}</button>`}`;
    row.querySelector('.ver-thumb').appendChild(miniSlide(v.data.slides[0], v.data, 120));
    box.appendChild(row);
  });
  box.onclick = (e) => {
    const id = e.target.closest('[data-restore]')?.dataset.restore; if (!id) return;
    const v = list.find((x) => x.id === id);
    state.doc = clone(v.data); state.slide = 0; state.sel = [];
    commit(); emit('all'); closeModal(); toast('Version restored — Ctrl+Z to undo');
  };
}

// ======================= CUSTOM FONTS =======================
async function registerFont(f) {
  try {
    const face = new FontFace(f.name, `url(${f.data})`);
    await face.load(); document.fonts.add(face);
    if (!packs.fonts.includes(f.name)) packs.fonts.push(f.name);
  } catch { /* broken font file */ }
}
export function uploadFont(after) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.ttf,.otf,.woff,.woff2';
  inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return;
    const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]+/g, ' ').trim();
    const f = { id: 'font-' + name, kind: 'font', t: Date.now(), name, data: await fileToDataUrl(file) };
    await registerFont(f);
    if (!packs.fonts.includes(name)) { toast('This font file could not be read'); return; }
    await libPut(f); toast(tr('Font “{name}” added', { name })); after?.();
  };
  inp.click();
}

// (animations: see anim.js and the Animate panel in animpanel.js)

// ======================= helpers =======================
export const fileToDataUrl = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
export const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
export { SIZES as RESIZE_SIZES, newDoc, resetHistory, PALETTE };

// ======================= small name window =======================
export function askName(title, value, onOk) {
  modal(`<h3>${title}</h3><input class="name-input" id="askName" maxlength="80" value="${String(value || '').replace(/"/g, '&quot;')}">
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="askOk">${ic('check')} OK</button></div>`);
  const inp = document.querySelector('#askName'); inp.focus(); inp.select();
  const ok = () => { const v = inp.value.trim(); if (!v) { inp.focus(); return; } closeModal(); onOk(v); };
  document.querySelector('#askOk').onclick = ok;
  inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') closeModal(); };
}

// ======================= MY TEMPLATES =======================
export function saveAsTemplate() {
  askName(tr('Save as my template'), state.doc.title, async (name) => {
    await libPut({ id: 'tpl-' + uid(), kind: 'usertemplate', t: Date.now(), name, w: state.doc.w, h: state.doc.h, slides: clone(state.doc.slides) });
    toast(tr('Template “{name}” saved — find it in Design → My templates', { name }));
    document.dispatchEvent(new Event('deckly-templates'));
  });
}
export async function userTemplates() {
  return (await libAll()).filter((x) => x.kind === 'usertemplate').sort((a, b) => b.t - a.t).map((u) => ({
    id: u.id, name: u.name, tag: tr('My template'), mine: true, w: u.w, h: u.h,
    build: () => clone(u.slides).map((s) => ({ ...s, id: uid(), elements: regroupIds(s.elements) })),
  }));
}
function regroupIds(els) {
  const map = {};
  return els.map((e) => ({ ...e, id: uid(), ...(e.group ? { group: (map[e.group] ||= 'g' + uid()) } : {}) }));
}
export const deleteTemplate = (id) => libDel(id);

// ======================= FOLDERS =======================
export async function getFolders() { return (await libAll()).find((x) => x.id === 'folders')?.list || []; }
export async function addFolder(name) {
  const list = await getFolders(); const f = { id: uid(), name }; list.push(f);
  await libPut({ id: 'folders', kind: 'folders', t: Date.now(), list }); return f;
}
export async function deleteFolder(id) {
  await libPut({ id: 'folders', kind: 'folders', t: Date.now(), list: (await getFolders()).filter((f) => f.id !== id) });
}
