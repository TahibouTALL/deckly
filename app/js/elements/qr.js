// QR codes, generated offline (qrcode-generator, MIT).
import { safeColor } from '../sanitize.js';

export const qrDefaults = (base = 1920) => ({ type: 'qr', text: 'https://example.com', fg: '#1E1F2B', bg: '#FFFFFF', style: 'square', margin: 2, w: Math.round(base * 0.18), h: Math.round(base * 0.18) });
const cache = new Map();
function modules(text) {
  if (cache.has(text)) return cache.get(text);
  let q = null;
  try { q = window.qrcode(0, 'M'); q.addData(text || ' '); q.make(); } catch { try { q = window.qrcode(0, 'L'); q.addData(String(text).slice(0, 1200)); q.make(); } catch { q = null; } }
  if (cache.size > 50) cache.clear();
  cache.set(text, q);
  return q;
}
export function renderQr(el) {
  const q = modules(el.text || ''); const fg = safeColor(el.fg, '#000'), bg = safeColor(el.bg, 'transparent');
  if (!q) return `<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="${bg}"/></svg>`;
  const n = q.getModuleCount(), m = el.margin ?? 2, size = n + m * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) {
    const x = c + m, y = r + m;
    if (el.style === 'dots') d += `M${x + 0.5} ${y + 0.08} a.42 .42 0 1 0 0 .84 a.42 .42 0 1 0 0 -.84 Z`;
    else if (el.style === 'rounded') d += `M${x + 0.25} ${y} h.5 a.25 .25 0 0 1 .25 .25 v.5 a.25 .25 0 0 1 -.25 .25 h-.5 a.25 .25 0 0 1 -.25 -.25 v-.5 a.25 .25 0 0 1 .25 -.25 Z`;
    else d += `M${x} ${y} h1 v1 h-1 Z`;
  }
  return `<svg viewBox="0 0 ${size} ${size}" shape-rendering="${el.style === 'square' ? 'crispEdges' : 'auto'}"><rect width="${size}" height="${size}" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>`;
}
