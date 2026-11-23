// Lines and connectors: two draggable ends, caps at each end, straight / elbow / curved.
// The ends are stored as fractions of the element box, so moving, scaling and rotating the box moves the line.
import { safeColor } from '../sanitize.js';

export const CAPS = ['none', 'arrow', 'triangle', 'circle', 'square', 'bar', 'diamond'];
export const DASHES = ['solid', 'dashed', 'dotted'];
export const KINDS = ['straight', 'elbow', 'curve'];
export const PAD = (sw) => sw * 3 + 6;

export const lineDefaults = (o = {}) => ({ type: 'line', stroke: '#1E1F2B', strokeWidth: 6, dash: 'solid', capStart: 'none', capEnd: 'none', kind: 'straight', bend: 0.5, a: [0, 0.5], b: [1, 0.5], ...o });

// absolute end points of a line element
export const ends = (el) => ({ x1: el.x + el.a[0] * el.w, y1: el.y + el.a[1] * el.h, x2: el.x + el.b[0] * el.w, y2: el.y + el.b[1] * el.h });
// set the ends (absolute) and recompute the box around them
export function setEnds(el, x1, y1, x2, y2) {
  const pad = PAD(el.strokeWidth || 6);
  const bx = Math.min(x1, x2) - pad, by = Math.min(y1, y2) - pad;
  el.x = bx; el.y = by; el.w = Math.abs(x2 - x1) + pad * 2; el.h = Math.abs(y2 - y1) + pad * 2;
  el.a = [(x1 - bx) / el.w, (y1 - by) / el.h]; el.b = [(x2 - bx) / el.w, (y2 - by) / el.h];
}
// a new line from (x1,y1) to (x2,y2)
export function makeLine(x1, y1, x2, y2, o = {}) { const el = lineDefaults(o); setEnds(el, x1, y1, x2, y2); return el; }
// old shape-lines (rect box, horizontal line, rotation) become real lines
export function lineFromShape(el) {
  const kind = { line: ['none', 'none', 'solid'], arrowLine: ['none', 'arrow', 'solid'], dashLine: ['none', 'none', 'dashed'], dotLine: ['none', 'none', 'dotted'] }[el.shape];
  if (!kind) return el;
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2, r = ((el.rot || 0) * Math.PI) / 180, hw = el.w / 2;
  const x1 = cx - hw * Math.cos(r), y1 = cy - hw * Math.sin(r), x2 = cx + hw * Math.cos(r), y2 = cy + hw * Math.sin(r);
  const out = makeLine(x1, y1, x2, y2, { id: el.id, stroke: el.stroke || '#1E1F2B', strokeWidth: el.strokeWidth || 6, capStart: kind[0], capEnd: kind[1], dash: kind[2], opacity: el.opacity ?? 1, rot: 0, locked: el.locked, group: el.group, anim: el.anim, mid: el.mid });
  return out;
}

function capPath(kind, x, y, ang, sw) {
  const k = sw * 2.4; // cap size
  const c = Math.cos(ang), s = Math.sin(ang);
  const P = (dx, dy) => `${(x + dx * c - dy * s).toFixed(1)} ${(y + dx * s + dy * c).toFixed(1)}`;
  switch (kind) {
    case 'arrow': return { d: `M${P(-k, -k * 0.75)} L${P(0, 0)} L${P(-k, k * 0.75)}`, fill: false, trim: 0 };
    case 'triangle': return { d: `M${P(-k * 1.1, -k * 0.7)} L${P(0, 0)} L${P(-k * 1.1, k * 0.7)} Z`, fill: true, trim: k * 1.0 };
    case 'circle': return { d: `M${P(-k * 0.55, 0)} a${(k * 0.55).toFixed(1)} ${(k * 0.55).toFixed(1)} 0 1 0 ${(k * 1.1).toFixed(1)} 0 a${(k * 0.55).toFixed(1)} ${(k * 0.55).toFixed(1)} 0 1 0 ${(-k * 1.1).toFixed(1)} 0 Z`, fill: true, trim: k * 0.55 };
    case 'square': return { d: `M${P(-k, -k * 0.5)} L${P(0, -k * 0.5)} L${P(0, k * 0.5)} L${P(-k, k * 0.5)} Z`, fill: true, trim: k * 0.5 };
    case 'diamond': return { d: `M${P(-k * 1.2, 0)} L${P(-k * 0.6, -k * 0.6)} L${P(0, 0)} L${P(-k * 0.6, k * 0.6)} Z`, fill: true, trim: k * 0.6 };
    case 'bar': return { d: `M${P(0, -k * 0.8)} L${P(0, k * 0.8)}`, fill: false, trim: 0 };
    default: return null;
  }
}
// the line's path and the tangent angles at both ends (local coordinates)
function geometry(el) {
  const x1 = el.a[0] * el.w, y1 = el.a[1] * el.h, x2 = el.b[0] * el.w, y2 = el.b[1] * el.h;
  if (el.kind === 'elbow') {
    const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
    const t = el.bend ?? 0.5;
    if (horizontal) { const mx = x1 + (x2 - x1) * t; return { d: `M${x1} ${y1} H${mx} V${y2} H${x2}`, a0: x2 >= x1 ? Math.PI : 0, a1: x2 >= x1 ? 0 : Math.PI, x1, y1, x2, y2 }; }
    const my = y1 + (y2 - y1) * t; return { d: `M${x1} ${y1} V${my} H${x2} V${y2}`, a0: y2 >= y1 ? -Math.PI / 2 : Math.PI / 2, a1: y2 >= y1 ? Math.PI / 2 : -Math.PI / 2, x1, y1, x2, y2 };
  }
  if (el.kind === 'curve') {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / len, ny = (x2 - x1) / len, off = (el.bend ?? 0.5) * len * 0.6;
    const cx = mx + nx * off, cy = my + ny * off;
    return { d: `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`, a0: Math.atan2(y1 - cy, x1 - cx), a1: Math.atan2(y2 - cy, x2 - cx), x1, y1, x2, y2 };
  }
  const ang = Math.atan2(y2 - y1, x2 - x1);
  return { d: `M${x1} ${y1} L${x2} ${y2}`, a0: ang + Math.PI, a1: ang, x1, y1, x2, y2, straight: true };
}
export function renderLine(el) {
  const sw = el.strokeWidth || 6, c = safeColor(el.stroke, '#1E1F2B');
  const g = geometry(el);
  const dash = el.dash === 'dashed' ? `stroke-dasharray="${sw * 3} ${sw * 2}"` : el.dash === 'dotted' ? `stroke-dasharray="0.1 ${sw * 2}" stroke-linecap="round"` : 'stroke-linecap="round"';
  const caps = [];
  let d = g.d;
  for (const [kind, x, y, ang, isEnd] of [[el.capStart, g.x1, g.y1, g.a0, false], [el.capEnd, g.x2, g.y2, g.a1, true]]) {
    const cp = capPath(kind, x, y, ang, sw); if (!cp) continue;
    caps.push(`<path d="${cp.d}" fill="${cp.fill ? c : 'none'}" stroke="${c}" stroke-width="${cp.fill ? sw * 0.6 : sw}" stroke-linecap="round" stroke-linejoin="round"/>`);
    if (g.straight && cp.trim) { // shorten a straight line under a filled cap so it does not poke out
      const t = cp.trim; const dx = Math.cos(ang) * t, dy = Math.sin(ang) * t;
      if (isEnd) d = `M${g.x1} ${g.y1} L${g.x2 - dx} ${g.y2 - dy}`; else d = d.replace(/^M[^L]+L/, `M${g.x1 - dx} ${g.y1 - dy} L`);
    }
  }
  return `<svg viewBox="0 0 ${el.w} ${el.h}" preserveAspectRatio="none" overflow="visible"><path d="${d}" fill="none" stroke="${c}" stroke-width="${sw}" ${dash} stroke-linejoin="round"/>${caps.join('')}</svg>`;
}
