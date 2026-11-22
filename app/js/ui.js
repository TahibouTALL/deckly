// Small UI helpers: toast, popovers, colour picker, modal.
import { PALETTE, GRADIENTS, ic } from './assets.js';
import { t as tr, translateDom } from './i18n.js';

const $ = (s) => document.querySelector(s);
let tt;
export function toast(msg) {
  const t = $('#toast'); t.textContent = tr(msg); t.classList.add('show');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2200);
}

let popClose = null;
export function popover(anchor, html, onOpen) {
  closePopover();
  const p = $('#popover'); p.innerHTML = html; translateDom(p); p.classList.remove('hidden');
  const r = anchor.getBoundingClientRect();
  const pw = p.offsetWidth, ph = p.offsetHeight;
  let left = Math.min(window.innerWidth - pw - 10, Math.max(10, r.left));
  let top = r.bottom + 8; if (top + ph > window.innerHeight - 10) top = Math.max(10, r.top - ph - 8);
  p.style.left = left + 'px'; p.style.top = top + 'px';
  onOpen?.(p);
  setTimeout(() => {
    popClose = (e) => { if (!p.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
    document.addEventListener('pointerdown', popClose);
  });
  return p;
}
export function closePopover() {
  $('#popover').classList.add('hidden');
  if (popClose) { document.removeEventListener('pointerdown', popClose); popClose = null; document.dispatchEvent(new Event('popover-closed')); }
}

const recent = [];
export const brandSwatches = { list: [] };
export function openColorPopover(anchor, value, onPick, onDone, opts = {}) {
  const sw = (c) => `<button class="sw" style="background:${c}" data-c="${c}" title="${c}"></button>`;
  const html = (brandSwatches.list.length ? `<h4>Brand colours</h4><div class="swatches">${brandSwatches.list.map(sw).join('')}</div>` : '') + (recent.length ? `<h4>Recently used</h4><div class="swatches">${recent.map(sw).join('')}</div>` : '')
    + `<h4 style="margin-top:10px">Colours</h4><div class="swatches">${PALETTE.map(sw).join('')}</div>`
    + (opts.gradients ? `<h4 style="margin-top:10px">Gradients</h4><div class="swatches">${GRADIENTS.map((g) => `<button class="sw grad" style="background:${g}" data-c="${g}"></button>`).join('')}</div>` : '')
    + `<div class="custom-color"><input type="color" value="${/^#[0-9a-f]{6}$/i.test(value) ? value : '#6C4CF5'}"><input type="text" value="${/^#/.test(value) ? value : ''}" placeholder="#RRGGBB"></div>`;
  popover(anchor, html, (p) => {
    const pick = (c, final) => { onPick(c); if (final) { remember(c); onDone?.(); opts.onFinal?.(c); } };
    p.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => pick(b.dataset.c, true)));
    const ci = p.querySelector('input[type=color]'), ti = p.querySelector('input[type=text]');
    ci.oninput = () => { ti.value = ci.value; pick(ci.value, false); };
    ci.onchange = () => { remember(ci.value); onDone?.(); opts.onFinal?.(ci.value); };
    ti.onchange = () => { if (/^#[0-9a-f]{6}$/i.test(ti.value)) pick(ti.value, true); };
  });
}
function remember(c) { const i = recent.indexOf(c); if (i >= 0) recent.splice(i, 1); recent.unshift(c); recent.length = Math.min(recent.length, 7); }

export function modal(html) {
  $('#modalCard').innerHTML = html; translateDom($('#modalCard')); $('#modal').classList.remove('hidden');
  $('#modal').onclick = (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); };
}
export const closeModal = () => $('#modal').classList.add('hidden');

export function shortcutsModal() {
  const rows = [['Add text', 'T'], ['Edit selected text', 'Enter'], ['Stop editing', 'Esc'], ['Undo / Redo', 'Ctrl Z / Ctrl Y'], ['Duplicate', 'Ctrl D'], ['Copy / Paste', 'Ctrl C / Ctrl V'],
    ['Delete', tr('Del')], ['Select all', 'Ctrl A'], ['Nudge (×10 with Shift)', '← ↑ → ↓'], ['Duplicate while dragging', 'Alt + drag'], ['No snapping while dragging', 'Ctrl + drag'],
    ['Free resize (images) / keep ratio (shapes)', 'Shift + corner'], ['Zoom', 'Ctrl + wheel'], ['Fit to screen', 'Ctrl 0'], ['Present', 'F5']];
  modal(`<h3>Keyboard shortcuts</h3><div class="kbd-list">${rows.map(([a, b]) => `<span>${a}</span><span>${b.split(' / ').map((k) => `<kbd>${k}</kbd>`).join(' / ')}</span>`).join('')}</div>
    <div style="text-align:right;margin-top:18px"><button class="btn primary" data-close>Got it</button></div>`);
}
export { ic };
