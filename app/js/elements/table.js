// Tables: rows and columns of editable cells, header row, banded rows, borders, presets.
import { sanitizeHtml, safeColor, safeFont } from '../sanitize.js';

export const PRESETS = {
  header: { name: 'Coloured header', headerFill: '#6C4CF5', headerColor: '#FFFFFF', fill: '#FFFFFF', bandFill: '#F4F1FF', banded: true, border: 'horizontal', borderColor: '#E6E7EF', borderWidth: 2 },
  simple: { name: 'Simple', headerFill: '#F3F4F8', headerColor: '#1E1F2B', fill: '#FFFFFF', bandFill: '#FFFFFF', banded: false, border: 'all', borderColor: '#D9DBE6', borderWidth: 2 },
  zebra: { name: 'Zebra', headerFill: '#1E1F2B', headerColor: '#FFFFFF', fill: '#FFFFFF', bandFill: '#F3F4F8', banded: true, border: 'none', borderColor: '#E6E7EF', borderWidth: 0 },
  minimal: { name: 'Minimal', headerFill: 'transparent', headerColor: '#1E1F2B', fill: 'transparent', bandFill: 'transparent', banded: false, border: 'horizontal', borderColor: '#9295A8', borderWidth: 2 },
  dark: { name: 'Dark', headerFill: '#0F1B3D', headerColor: '#FFFFFF', fill: '#1E1F2B', bandFill: '#2E3040', banded: true, border: 'none', borderColor: '#5B5E73', borderWidth: 0, color: '#FFFFFF' },
  colorful: { name: 'Colourful', headerFill: '#FF6B8B', headerColor: '#FFFFFF', fill: '#FFF0F4', bandFill: '#FFFFFF', banded: true, border: 'outer', borderColor: '#FF6B8B', borderWidth: 3 },
  outline: { name: 'Outlined', headerFill: '#FFFFFF', headerColor: '#6C4CF5', fill: '#FFFFFF', bandFill: '#FFFFFF', banded: false, border: 'all', borderColor: '#6C4CF5', borderWidth: 3 },
  soft: { name: 'Soft', headerFill: '#CFF5E2', headerColor: '#127A4C', fill: '#FFFFFF', bandFill: '#F3FBF7', banded: true, border: 'none', borderColor: '#CFF5E2', borderWidth: 0 },
};
export const cell = (html = '') => ({ h: html });
export function tableDefaults(rows = 3, cols = 3, preset = 'header', base = 1920) {
  const cells = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => cell(r === 0 ? `Titre ${c + 1}` : '')));
  const w = Math.round(base * 0.5), rowH = Math.round(base * 0.05);
  return { type: 'table', w, h: rowH * rows, rows, cols, cells, colW: Array(cols).fill(1 / cols), rowH: Array(rows).fill(rowH),
    style: { preset, header: true, font: 'Inter', size: Math.round(base * 0.018), color: '#1E1F2B', pad: Math.round(base * 0.012), align: 'left', radius: 0, ...PRESETS[preset], name: undefined } };
}
export function applyPreset(el, preset) { const p = { ...PRESETS[preset] }; delete p.name; el.style = { ...el.style, preset, ...p, color: p.color || '#1E1F2B' }; }

// ---------- structure ----------
export function addRow(el, at = el.rows) { el.cells.splice(at, 0, Array.from({ length: el.cols }, () => cell())); el.rowH.splice(at, 0, el.rowH[Math.min(at, el.rowH.length - 1)] || 60); el.rows++; el.h = el.rowH.reduce((a, b) => a + b, 0); }
export function delRow(el, at = el.rows - 1) { if (el.rows <= 1) return; el.cells.splice(at, 1); el.rowH.splice(at, 1); el.rows--; el.h = el.rowH.reduce((a, b) => a + b, 0); }
export function addCol(el, at = el.cols) {
  for (const r of el.cells) r.splice(at, 0, cell());
  const f = 1 / (el.cols + 1); el.colW = el.colW.map((w) => w * (1 - f)); el.colW.splice(at, 0, f); el.cols++;
  el.w = el.w * (1 + f);
}
export function delCol(el, at = el.cols - 1) {
  if (el.cols <= 1) return;
  for (const r of el.cells) r.splice(at, 1);
  const gone = el.colW.splice(at, 1)[0]; const k = 1 / (1 - gone); el.colW = el.colW.map((w) => w * k); el.cols--;
  el.w = el.w * (1 - gone);
}

// ---------- render ----------
function cellStyle(el, r, c, cl) {
  const s = el.style, header = s.header && r === 0;
  const bw = s.borderWidth || 0, bc = safeColor(s.borderColor, '#E6E7EF');
  const line = `${bw}px solid ${bc}`;
  let border = '';
  if (bw && s.border === 'all') border = `border:${line};`;
  else if (bw && s.border === 'horizontal') border = `border-bottom:${line};`;
  else if (bw && s.border === 'outer') border = `${r === 0 ? `border-top:${line};` : ''}${r === el.rows - 1 ? `border-bottom:${line};` : ''}${c === 0 ? `border-left:${line};` : ''}${c === el.cols - 1 ? `border-right:${line};` : ''}`;
  const fill = cl.fill ? safeColor(cl.fill) : header ? safeColor(s.headerFill, '#6C4CF5') : s.banded && r % 2 === 0 ? safeColor(s.bandFill, '#F4F1FF') : safeColor(s.fill, '#FFFFFF');
  const color = cl.color ? safeColor(cl.color) : header ? safeColor(s.headerColor, '#FFFFFF') : safeColor(s.color, '#1E1F2B');
  const bold = cl.bold ?? header;
  return `background:${fill};color:${color};font-weight:${bold ? 700 : 400};${cl.italic ? 'font-style:italic;' : ''}text-align:${cl.align || s.align || 'left'};vertical-align:${cl.valign || 'middle'};padding:${s.pad || 16}px;${border}font-size:${cl.size || s.size || 32}px;`;
}
export function renderTable(el) {
  const s = el.style;
  const cols = el.colW.map((w) => `<col style="width:${(w * 100).toFixed(3)}%">`).join('');
  const rows = el.cells.map((row, r) => `<tr style="height:${el.rowH[r] || 60}px">${row.map((cl, c) => `<td data-r="${r}" data-c="${c}" style="${cellStyle(el, r, c, cl)}"><div class="cell">${sanitizeHtml(cl.h) || '<br>'}</div></td>`).join('')}</tr>`).join('');
  return `<div class="tbl" style="width:100%;font-family:'${safeFont(s.font)}',sans-serif;line-height:1.3;border-radius:${s.radius || 0}px;overflow:hidden"><table style="width:100%;border-collapse:collapse;table-layout:fixed;border-spacing:0">${cols ? `<colgroup>${cols}</colgroup>` : ''}<tbody>${rows}</tbody></table></div>`;
}
// after a render: rows that grew with their text are measured, the element height follows
export function measureTable(el, node) {
  const trs = node.querySelectorAll('tr'); let h = 0, changed = false;
  trs.forEach((tr, i) => { const rh = Math.ceil(tr.offsetHeight); if (rh && Math.abs(rh - el.rowH[i]) > 1) { el.rowH[i] = rh; changed = true; } h += el.rowH[i]; });
  if (h && Math.abs(h - el.h) > 1) { el.h = h; changed = true; }
  return changed;
}
// plain rows for exports (PowerPoint)
export const plainCells = (el) => el.cells.map((row) => row.map((cl) => { const d = document.createElement('div'); d.innerHTML = sanitizeHtml(cl.h).replace(/<br\s*\/?>/gi, '\n'); return d.textContent; }));
