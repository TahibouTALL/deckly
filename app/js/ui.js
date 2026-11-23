// Small UI helpers: toast (with an optional action), popovers, context menus, colour picker, modal.
import { PALETTE, GRADIENTS, ic } from './assets.js';
import { t as tr, translateDom } from './i18n.js';

const $ = (s) => document.querySelector(s);
let tt;
export function toast(msg, action) {
  const t = $('#toast'); t.innerHTML = ''; t.append(document.createTextNode(tr(msg)));
  if (action) { const b = document.createElement('button'); b.className = 'toast-act'; b.textContent = tr(action.label); b.onclick = () => { action.fn(); t.classList.remove('show'); }; t.appendChild(b); }
  t.classList.add('show');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), action ? 5000 : 2200);
}

let popClose = null, popStack = [];
export function popover(anchor, html, onOpen, opts = {}) {
  closePopover();
  const p = $('#popover'); p.innerHTML = html; translateDom(p); p.classList.remove('hidden');
  p.style.width = opts.width ? opts.width + 'px' : '';
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor; // anchor may be {left, top, bottom, right}
  const pw = p.offsetWidth, ph = p.offsetHeight;
  let left = Math.min(window.innerWidth - pw - 10, Math.max(10, r.left));
  let top = r.bottom + 8; if (top + ph > window.innerHeight - 10) top = Math.max(10, r.top - ph - 8);
  p.style.left = left + 'px'; p.style.top = top + 'px';
  onOpen?.(p);
  setTimeout(() => {
    popClose = (e) => { if (!p.contains(e.target) && !(anchor.contains && anchor.contains(e.target))) closePopover(); };
    document.addEventListener('pointerdown', popClose);
  });
  return p;
}
// a popover at screen coordinates (right-click menus)
export const popoverAt = (x, y, html, onOpen, opts) => popover({ left: x, top: y, bottom: y, right: x }, html, onOpen, opts);
export function closePopover() {
  const p = $('#popover'); if (p.classList.contains('hidden')) return;
  p.classList.add('hidden');
  if (popClose) { document.removeEventListener('pointerdown', popClose); popClose = null; }
  document.dispatchEvent(new Event('popover-closed'));
}
// a list of actions: [{icon, label, act, kbd, danger, disabled}] or 'sep'
export function menuHtml(items) {
  return `<div class="pop-list ctx">${items.map((it) => (it === 'sep' ? '<hr>' : `<button data-m="${it.act}" ${it.disabled ? 'disabled' : ''} class="${it.danger ? 'danger' : ''}">${it.icon ? ic(it.icon) : '<span class="ic"></span>'}<span>${tr(it.label)}</span>${it.kbd ? `<kbd>${it.kbd}</kbd>` : ''}</button>`)).join('')}</div>`;
}
export function contextMenu(x, y, items, onPick) {
  popoverAt(x, y, menuHtml(items), (p) => { p.onclick = (e) => { const m = e.target.closest('[data-m]'); if (!m || m.disabled) return; closePopover(); onPick(m.dataset.m); }; }, { width: 250 });
}

const recent = [];
export const brandSwatches = { list: [] };
export const docColors = { list: [] };
export function openColorPopover(anchor, value, onPick, onDone, opts = {}) {
  const sw = (c) => `<button class="sw" style="background:${c}" data-c="${c}" title="${c}"></button>`;
  const html = (brandSwatches.list.length ? `<h4>Brand colours</h4><div class="swatches">${brandSwatches.list.map(sw).join('')}</div>` : '')
    + (docColors.list.length ? `<h4>Document colours</h4><div class="swatches">${docColors.list.slice(0, 14).map(sw).join('')}</div>` : '')
    + (recent.length ? `<h4>Recently used</h4><div class="swatches">${recent.map(sw).join('')}</div>` : '')
    + `<h4 style="margin-top:10px">Colours</h4><div class="swatches">${PALETTE.map(sw).join('')}</div>`
    + (opts.gradients ? `<h4 style="margin-top:10px">Gradients</h4><div class="swatches">${GRADIENTS.map((g) => `<button class="sw grad" style="background:${g}" data-c="${g}"></button>`).join('')}</div>` : '')
    + `<div class="custom-color"><input type="color" value="${/^#[0-9a-f]{6}$/i.test(value) ? value : '#6C4CF5'}"><input type="text" value="${/^#/.test(value) ? value : ''}" placeholder="#RRGGBB">${window.EyeDropper ? `<button class="cb" data-eye title="${tr('Pick a colour on screen')}">${ic('pipette')}</button>` : ''}</div>`;
  popover(anchor, html, (p) => {
    const pick = (c, final) => { onPick(c); if (final) { remember(c); onDone?.(); opts.onFinal?.(c); } };
    p.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => pick(b.dataset.c, true)));
    const ci = p.querySelector('input[type=color]'), ti = p.querySelector('input[type=text]');
    ci.oninput = () => { ti.value = ci.value; pick(ci.value, false); };
    ci.onchange = () => { remember(ci.value); onDone?.(); opts.onFinal?.(ci.value); };
    ti.onchange = () => { if (/^#[0-9a-f]{6}$/i.test(ti.value)) pick(ti.value, true); };
    p.querySelector('[data-eye]')?.addEventListener('click', async () => { try { const r = await new window.EyeDropper().open(); pick(r.sRGBHex.toUpperCase(), true); } catch { /* cancelled */ } });
  });
}
function remember(c) { const i = recent.indexOf(c); if (i >= 0) recent.splice(i, 1); recent.unshift(c); recent.length = Math.min(recent.length, 7); }

let lastFocus = null;
export function modal(html, opts = {}) {
  lastFocus = document.activeElement;
  const card = $('#modalCard'); card.innerHTML = html; translateDom(card);
  card.style.width = opts.width ? `min(${opts.width}px,96vw)` : '';
  $('#modal').classList.remove('hidden');
  $('#modal').onclick = (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); };
  const first = card.querySelector('input,button,select,textarea,[tabindex]'); first?.focus({ preventScroll: true });
}
export const closeModal = () => { if ($('#modal').classList.contains('hidden')) return; $('#modal').classList.add('hidden'); lastFocus?.focus?.(); document.dispatchEvent(new Event('modal-closed')); };
export const isModalOpen = () => !$('#modal').classList.contains('hidden');
// Escape closes what is open (popover first, then the window)
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#popover').classList.contains('hidden')) { closePopover(); e.stopPropagation(); return; }
  if (isModalOpen()) { closeModal(); e.stopPropagation(); }
}, true);
// focus stays inside an open window
document.addEventListener('focusin', (e) => { if (isModalOpen() && !$('#modal').contains(e.target) && !$('#popover').contains(e.target)) $('#modalCard').querySelector('input,button,select,textarea')?.focus(); });

export function confirmPopover(anchor, text, onYes, yesLabel = 'Delete') {
  popover(anchor, `<div style="font-weight:600;margin-bottom:6px">${text}</div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost" data-no>Cancel</button><button class="btn primary danger-btn" data-yes>${tr(yesLabel)}</button></div>`, (p) => {
    p.querySelector('[data-no]').onclick = closePopover;
    p.querySelector('[data-yes]').onclick = () => { closePopover(); onYes(); };
  });
}

export function shortcutsModal() {
  const rows = [['Add text', 'T'], ['Draw', 'D'], ['Edit selected text', 'Enter'], ['Stop editing', 'Esc'], ['Undo / Redo', 'Ctrl Z / Ctrl Y'], ['Duplicate', 'Ctrl D'], ['Copy / Cut / Paste', 'Ctrl C / Ctrl X / Ctrl V'],
    ['Copy / paste the style', 'Ctrl Alt C / Ctrl Alt V'], ['Delete', tr('Del')], ['Group / Ungroup', 'Ctrl G / Ctrl Shift G'], ['Select all', 'Ctrl A'], ['Bring forward / send backward', 'Ctrl ] / Ctrl ['], ['Nudge (×10 with Shift)', '← ↑ → ↓'],
    ['Duplicate while dragging', 'Alt + drag'], ['No snapping while dragging', 'Ctrl + drag'], ['Free resize (images) / keep ratio (shapes)', 'Shift + corner'], ['Zoom', 'Ctrl + wheel'], ['Fit to screen', 'Ctrl 0'], ['New slide', 'Ctrl Enter'], ['Present', 'F5'], ['Shortcuts', 'Ctrl /']];
  modal(`<h3>${ic('keyboard')} ${tr('Keyboard shortcuts')}</h3><div class="kbd-list">${rows.map(([a, b]) => `<span>${tr(a)}</span><span>${b.split(' / ').map((k) => `<kbd>${k}</kbd>`).join(' / ')}</span>`).join('')}</div>
    <div style="text-align:right;margin-top:18px"><button class="btn primary" data-close>Got it</button></div>`, { width: 620 });
}
export { ic };
