// Freehand drawing: pen (pressure-sensitive outline via perfect-freehand), marker and highlighter strokes.
import { safeColor } from '../sanitize.js';
import { getStroke } from '../../vendor/perfect-freehand.js';

export const TOOLS = { pen: { size: 10, opacity: 1 }, marker: { size: 24, opacity: 0.85 }, highlighter: { size: 48, opacity: 0.4 } };

// points [[x,y,pressure]…] in slide coordinates -> a draw element whose path is relative to its box
export function strokeElement(points, tool, color, size) {
  if (points.length < 2) points = [points[0], [points[0][0] + 0.5, points[0][1] + 0.5, 0.5]];
  const sw = size || TOOLS[tool].size;
  let d, xs, ys;
  if (tool === 'pen') {
    const outline = getStroke(points, { size: sw, thinning: 0.55, smoothing: 0.6, streamline: 0.5, simulatePressure: !points.some((p) => p[2] && p[2] !== 0.5), last: true });
    xs = outline.map((p) => p[0]); ys = outline.map((p) => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    d = outline.map((p, i) => `${i ? 'L' : 'M'}${(p[0] - x0).toFixed(1)} ${(p[1] - y0).toFixed(1)}`).join(' ') + ' Z';
    return finish(d, x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0, { tool, fill: color, stroke: 'none', strokeWidth: 0, opacity: TOOLS.pen.opacity });
  }
  xs = points.map((p) => p[0]); ys = points.map((p) => p[1]);
  const pad = sw / 2 + 2, x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  const pts = points.map((p) => [p[0] - x0, p[1] - y0]);
  d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
  d += ` L${pts[pts.length - 1][0].toFixed(1)} ${pts[pts.length - 1][1].toFixed(1)}`;
  return finish(d, x0, y0, Math.max(...xs) + pad - x0, Math.max(...ys) + pad - y0, { tool, fill: 'none', stroke: color, strokeWidth: sw, opacity: TOOLS[tool].opacity });
}
function finish(d, x, y, w, h, o) { return { type: 'draw', d, x, y, w: Math.max(w, 2), h: Math.max(h, 2), ...o }; }
export function renderDraw(el) {
  const blend = el.tool === 'highlighter' ? 'style="mix-blend-mode:multiply"' : '';
  const cap = el.tool === 'highlighter' ? 'butt' : 'round';
  return `<svg viewBox="0 0 ${el.w} ${el.h}" preserveAspectRatio="none" overflow="visible" ${blend}><path d="${el.d}" fill="${safeColor(el.fill, 'none')}" stroke="${safeColor(el.stroke, 'none')}" stroke-width="${el.strokeWidth || 0}" stroke-linecap="${cap}" stroke-linejoin="round" vector-effect="non-scaling-stroke" opacity="${el.opacity ?? 1}"/></svg>`;
}
