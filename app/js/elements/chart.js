// Data-driven charts drawn as SVG: columns, bars, lines, areas, pie, donut (+ a stat card).
import { safeColor, safeFont, escapeHtml } from '../sanitize.js';

export const KINDS = [['column', 'Columns'], ['bar', 'Bars'], ['line', 'Line'], ['area', 'Area'], ['pie', 'Pie'], ['donut', 'Donut']];
export const PALETTES = {
  deckly: ['#6C4CF5', '#FF6B8B', '#2EC27E', '#FFC83D', '#3D8BFF', '#B455E8', '#FF8A3D', '#1FB5A6'],
  ocean: ['#1C4FA8', '#3D8BFF', '#1FB5A6', '#C8F1EC', '#0E6B62', '#D4E5FF'],
  warm: ['#FF5A5F', '#FF8A3D', '#FFC83D', '#B85A12', '#FFD6D8', '#9C7400'],
  forest: ['#127A4C', '#2EC27E', '#CFF5E2', '#5B5E73', '#0E6B62', '#C8A97E'],
  mono: ['#1E1F2B', '#5B5E73', '#9295A8', '#D9DBE6', '#2E3040', '#F3F4F8'],
};
export function chartDefaults(kind = 'column', base = 1920) {
  return { type: 'chart', kind, w: Math.round(base * 0.45), h: Math.round(base * 0.28),
    labels: ['T1', 'T2', 'T3', 'T4'], series: [{ name: 'Ventes', values: [42, 68, 55, 90] }],
    opts: { legend: true, values: true, grid: true, rounded: true, font: 'Inter', size: Math.round(base * 0.015), color: '#1E1F2B', palette: 'deckly', colors: [], lineWidth: 8, smooth: true, hole: 55, stacked: false, min: null, max: null } };
}
export const colorOf = (el, i) => safeColor(el.opts.colors?.[i] || PALETTES[el.opts.palette || 'deckly'][i % PALETTES[el.opts.palette || 'deckly'].length]);
const fmt = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('fr-FR') : +(+v).toFixed(2) + '');

export function renderChart(el) {
  const o = el.opts, W = el.w, H = el.h, fs = o.size || 28, col = safeColor(o.color, '#1E1F2B'), font = safeFont(o.font);
  const series = (el.series || []).map((s) => ({ ...s, values: (s.values || []).map((v) => +v || 0) }));
  const labels = el.labels || [];
  let body = '';
  const T = (x, y, t, a = 'middle', size = fs, extra = '') => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${a}" font-size="${size}" fill="${col}" ${extra}>${escapeHtml(t)}</text>`;
  const legendH = o.legend && series.length > 1 ? fs * 1.8 : 0;
  if (el.kind === 'pie' || el.kind === 'donut') {
    const vals = series[0]?.values || []; const tot = vals.reduce((a, b) => a + b, 0) || 1;
    const lw = o.legend ? Math.min(W * 0.4, fs * 12) : 0;
    const cx = (W - lw) / 2, cy = H / 2, r = Math.min(W - lw, H) / 2 - fs * 0.6;
    let a0 = -Math.PI / 2;
    const ri = el.kind === 'donut' ? r * ((o.hole || 55) / 100) : 0;
    vals.forEach((v, i) => {
      const a1 = a0 + (v / tot) * Math.PI * 2; const big = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a, rr) => `${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
      const d = ri ? `M${p(a0, r)} A${r} ${r} 0 ${big} 1 ${p(a1, r)} L${p(a1, ri)} A${ri} ${ri} 0 ${big} 0 ${p(a0, ri)} Z` : `M${cx} ${cy} L${p(a0, r)} A${r} ${r} 0 ${big} 1 ${p(a1, r)} Z`;
      body += `<path d="${d}" fill="${colorOf(el, i)}" stroke="#fff" stroke-width="${Math.max(2, fs * 0.12)}"/>`;
      if (o.values && v / tot > 0.04) { const am = (a0 + a1) / 2, rr = ri ? (r + ri) / 2 : r * 0.62; body += T(cx + rr * Math.cos(am), cy + rr * Math.sin(am) + fs * 0.35, Math.round((v / tot) * 100) + ' %', 'middle', fs * 0.9, 'fill="#fff" font-weight="700"'); }
      a0 = a1;
    });
    if (o.legend) labels.forEach((l, i) => { const y = cy - (labels.length - 1) * fs * 0.9 + i * fs * 1.8; body += `<rect x="${W - lw + fs * 0.4}" y="${y - fs * 0.6}" width="${fs * 0.9}" height="${fs * 0.9}" rx="${fs * 0.2}" fill="${colorOf(el, i)}"/>` + T(W - lw + fs * 1.7, y + fs * 0.1, `${l} · ${fmt(vals[i] || 0)}`, 'start', fs * 0.9); });
  } else {
    const n = labels.length, horizontal = el.kind === 'bar';
    const all = series.flatMap((s) => s.values);
    let max = o.max ?? Math.max(1, ...all), min = o.min ?? Math.min(0, ...all);
    if (o.stacked && series.length > 1 && (el.kind === 'column' || el.kind === 'bar')) max = o.max ?? Math.max(1, ...labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0)));
    // round axis: steps of 1, 2, 2.5 or 5 x 10^n
    const ticks = 4;
    const nice = (v) => { const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
    const step = nice((max - min) / ticks || 1);
    if (o.max == null) max = Math.ceil(max / step) * step; if (o.min == null && min < 0) min = Math.floor(min / step) * step;
    const padL = horizontal ? fs * 5 : fs * 2.6, padB = fs * 1.9, padT = legendH + fs * 1.2, padR = fs * 0.8;
    const cw = W - padL - padR, ch = H - padT - padB;
    const sy = (v) => padT + ch - ((v - min) / (max - min)) * ch;
    const sx = (v) => padL + ((v - min) / (max - min)) * cw;
    // grid + axis labels
    const nTicks = Math.round((max - min) / step);
    for (let t = 0; t <= nTicks; t++) {
      const v = min + step * t;
      if (horizontal) { const x = sx(v); if (o.grid) body += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + ch}" stroke="${col}" stroke-opacity=".12"/>`; body += T(x, H - padB + fs * 1.2, fmt(v), 'middle', fs * 0.8, 'opacity=".6"'); }
      else { const y = sy(v); if (o.grid) body += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${col}" stroke-opacity=".12"/>`; body += T(padL - fs * 0.5, y + fs * 0.3, fmt(v), 'end', fs * 0.8, 'opacity=".6"'); }
    }
    const band = (horizontal ? ch : cw) / Math.max(1, n);
    labels.forEach((l, i) => { if (horizontal) body += T(padL - fs * 0.5, padT + band * i + band / 2 + fs * 0.3, l, 'end', fs * 0.9); else body += T(padL + band * i + band / 2, H - padB + fs * 1.2, l, 'middle', fs * 0.9); });
    if (el.kind === 'column' || el.kind === 'bar') {
      const groups = o.stacked ? 1 : series.length, bw = (band * 0.68) / groups, gap = band * 0.16;
      const acc = Array(n).fill(0);
      series.forEach((s, si) => s.values.forEach((v, i) => {
        if (i >= n) return;
        const c = colorOf(el, si), rx = o.rounded ? Math.min(bw / 2, fs * 0.4) : 0;
        if (horizontal) {
          const y = padT + band * i + gap + (o.stacked ? 0 : si * bw), x0 = o.stacked ? sx(acc[i]) : sx(Math.max(min, 0)), x1 = o.stacked ? sx(acc[i] + v) : sx(v);
          body += `<rect x="${Math.min(x0, x1).toFixed(1)}" y="${y.toFixed(1)}" width="${Math.abs(x1 - x0).toFixed(1)}" height="${bw.toFixed(1)}" rx="${rx}" fill="${c}"/>`;
          if (o.values) body += T(Math.max(x0, x1) + fs * 0.3, y + bw / 2 + fs * 0.3, fmt(v), 'start', fs * 0.8);
        } else {
          const x = padL + band * i + gap + (o.stacked ? 0 : si * bw), y0 = o.stacked ? sy(acc[i]) : sy(Math.max(min, 0)), y1 = o.stacked ? sy(acc[i] + v) : sy(v);
          body += `<rect x="${x.toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.abs(y1 - y0).toFixed(1)}" rx="${rx}" fill="${c}"/>`;
          if (o.values) body += T(x + bw / 2, Math.min(y0, y1) - fs * 0.35, fmt(v), 'middle', fs * 0.8);
        }
        acc[i] += v;
      }));
    } else { // line / area
      series.forEach((s, si) => {
        const pts = s.values.slice(0, n).map((v, i) => [padL + band * i + band / 2, sy(v)]);
        if (!pts.length) return;
        let d = `M${pts[0][0]} ${pts[0][1]}`;
        for (let i = 1; i < pts.length; i++) {
          if (o.smooth) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const cx = (x0 + x1) / 2; d += ` C${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`; } else d += ` L${pts[i][0]} ${pts[i][1]}`;
        }
        const c = colorOf(el, si);
        if (el.kind === 'area') body += `<path d="${d} L${pts[pts.length - 1][0]} ${sy(Math.max(min, 0))} L${pts[0][0]} ${sy(Math.max(min, 0))} Z" fill="${c}" fill-opacity=".18"/>`;
        body += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${o.lineWidth || 8}" stroke-linecap="round" stroke-linejoin="round"/>`;
        pts.forEach(([x, y], i) => { body += `<circle cx="${x}" cy="${y}" r="${(o.lineWidth || 8) * 0.9}" fill="#fff" stroke="${c}" stroke-width="${(o.lineWidth || 8) * 0.6}"/>`; if (o.values) body += T(x, y - fs * 0.8, fmt(s.values[i]), 'middle', fs * 0.8); });
      });
    }
    if (legendH) { let x = padL; series.forEach((s, i) => { body += `<rect x="${x}" y="${fs * 0.2}" width="${fs * 0.9}" height="${fs * 0.9}" rx="${fs * 0.25}" fill="${colorOf(el, i)}"/>` + T(x + fs * 1.2, fs * 0.95, s.name || `Série ${i + 1}`, 'start', fs * 0.9); x += fs * 1.6 + (s.name || 'Série 1').length * fs * 0.62; }); }
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" font-family="'${font}',sans-serif" overflow="visible">${body}</svg>`;
}
// tab-separated / comma-separated text (pasted from Excel) -> labels + series
export function parseTable(text) {
  const rows = text.trim().split(/\r?\n/).map((l) => l.split(/\t|;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.trim().replace(/^"|"$/g, '')));
  if (!rows.length) return null;
  const hasHeader = rows[0].slice(1).some((c) => isNaN(parseFloat(c)));
  const head = hasHeader ? rows.shift() : null;
  const labels = rows.map((r) => r[0]);
  const nSeries = Math.max(...rows.map((r) => r.length)) - 1;
  const series = Array.from({ length: Math.max(1, nSeries) }, (_, i) => ({ name: head?.[i + 1] || `Série ${i + 1}`, values: rows.map((r) => parseFloat(String(r[i + 1] || '0').replace(',', '.')) || 0) }));
  return { labels, series };
}
