// Turns the document model into DOM (editor, thumbnails, present mode and exports all use this).
import { SHAPES, shapeSvg, shapeClipBody, textArea, isStrokeShape } from './shapes.js';
import { lucideSvg, iconifySvg, packs } from './assets.js';
import { renderLine } from './elements/line.js';
import { renderTable } from './elements/table.js';
import { renderChart } from './elements/chart.js';
import { renderQr } from './elements/qr.js';
import { renderDraw } from './elements/draw.js';
import { packSvg, lib } from './library.js';
import { sanitizeHtml, escapeHtml as esc, safeColor, safeFont, safeSrc } from './sanitize.js';

export function bgCss(bg) {
  if (!bg) return 'background:#fff';
  if (bg.type === 'gradient') return `background:${safeColor(bg.value, '#fff')}`;
  if (bg.type === 'image') return `background:#ddd url("${safeSrc(bg.value)}") center/cover no-repeat`;
  return `background:${safeColor(bg.value, '#fff')}`;
}

export function filterCss(f = {}) {
  const p = [];
  if (f.brightness != null && f.brightness !== 100) p.push(`brightness(${+f.brightness}%)`);
  if (f.contrast != null && f.contrast !== 100) p.push(`contrast(${+f.contrast}%)`);
  if (f.saturate != null && f.saturate !== 100) p.push(`saturate(${+f.saturate}%)`);
  if (f.grayscale) p.push(`grayscale(${+f.grayscale}%)`);
  if (f.sepia) p.push(`sepia(${+f.sepia}%)`);
  if (f.blur) p.push(`blur(${+f.blur}px)`);
  if (f.hue) p.push(`hue-rotate(${+f.hue}deg)`);
  return p.join(' ');
}

// ---------- photo frames ----------
// a frame = a clip (in a 100 x 100 box) + an optional drawing around the picture (device bezels, polaroid…)
const DEVICE = {
  phone: { inset: [7, 3.5, 86, 93], rx: 7, over: '<rect x="0.5" y="0.5" width="99" height="99" rx="11" fill="none" stroke="#1E1F2B" stroke-width="7"/><rect x="34" y="0" width="32" height="7" rx="3" fill="#1E1F2B"/>', ratio: 0.5 },
  tablet: { inset: [5.5, 5.5, 89, 89], rx: 3, over: '<rect x="1" y="1" width="98" height="98" rx="7" fill="none" stroke="#1E1F2B" stroke-width="6"/>', ratio: 0.75 },
  laptop: { inset: [7.5, 4, 85, 76], rx: 1.5, over: '<rect x="4" y="1" width="92" height="82" rx="4" fill="none" stroke="#1E1F2B" stroke-width="5"/><path d="M0 84 H100 L96 92 Q95 94 92 94 H8 Q5 94 4 92 Z" fill="#2E3040"/><rect x="38" y="84" width="24" height="3" rx="1" fill="#5B5E73"/>', ratio: 1.6 },
  monitor: { inset: [2.5, 2.5, 95, 72], rx: 1, over: '<rect x="1" y="1" width="98" height="75" rx="3" fill="none" stroke="#1E1F2B" stroke-width="4"/><path d="M40 78 H60 L64 90 H36 Z" fill="#2E3040"/><rect x="28" y="90" width="44" height="4" rx="2" fill="#2E3040"/>', ratio: 1.5 },
  browser: { inset: [0, 11, 100, 89], rx: 0, over: '<rect x="0" y="0" width="100" height="100" rx="3" fill="none" stroke="#D9DBE6" stroke-width="1.5"/><path d="M0 11 V3 Q0 0 3 0 H97 Q100 0 100 3 V11 Z" fill="#F3F4F8"/><circle cx="5" cy="5.5" r="1.8" fill="#FF5F57"/><circle cx="10.5" cy="5.5" r="1.8" fill="#FEBC2E"/><circle cx="16" cy="5.5" r="1.8" fill="#28C840"/><rect x="24" y="2.8" width="60" height="5.4" rx="2.7" fill="#fff"/>', ratio: 1.6 },
  polaroid: { inset: [6, 6, 88, 72], rx: 0, over: '<rect x="0" y="0" width="100" height="100" fill="#fff" stroke="#E6E7EF" stroke-width="1"/>', under: true, ratio: 0.85 },
  film: { inset: [4, 14, 92, 72], rx: 0, over: '<rect x="0" y="0" width="100" height="100" fill="#1E1F2B"/>' + Array.from({ length: 8 }, (_, i) => `<rect x="${4 + i * 12}" y="3.5" width="7" height="7" rx="1.5" fill="#F3F4F8"/><rect x="${4 + i * 12}" y="89.5" width="7" height="7" rx="1.5" fill="#F3F4F8"/>`).join(''), under: true, ratio: 1.5 },
  circleRing: { inset: [6, 6, 88, 88], rx: 0, clip: '<ellipse cx="50" cy="50" rx="50" ry="50"/>', over: '<circle cx="50" cy="50" r="47" fill="none" stroke="#fff" stroke-width="6"/>', ratio: 1 },
  cardShadow: { inset: [4, 4, 92, 88], rx: 2, over: '<rect x="0" y="0" width="100" height="100" rx="3" fill="#fff" stroke="#E6E7EF"/>', under: true, ratio: 1.3 },
};
export const DEVICE_FRAMES = Object.keys(DEVICE);
export function frameSpec(frame) {
  if (!frame || frame === 'rect') return { clip: '', inset: [0, 0, 100, 100] };
  if (frame.startsWith('glyph:')) { const d = lib.glyphs?.[frame.slice(6)]; return d ? { clip: `<path d="${d}" clip-rule="evenodd"/>`, inset: [0, 0, 100, 100] } : { clip: '', inset: [0, 0, 100, 100] }; }
  if (frame.startsWith('device:')) {
    const dv = DEVICE[frame.slice(7)]; if (!dv) return { clip: '', inset: [0, 0, 100, 100] };
    const [x, y, w, h] = dv.inset;
    return { clip: dv.clip || `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${dv.rx || 0}"/>`, inset: dv.inset, over: dv.over, under: dv.under, ratio: dv.ratio };
  }
  if (SHAPES[frame]) return { clip: shapeClipBody(frame), inset: [0, 0, 100, 100] };
  return { clip: '', inset: [0, 0, 100, 100] };
}

export function innerHtml(el) {
  switch (el.type) {
    case 'text': {
      const size = +el.size || 32;
      const st = [
        `font-family:'${safeFont(el.font)}',sans-serif`, `font-size:${size}px`, `color:${safeColor(el.color, '#1E1F2B')}`,
        `font-weight:${el.bold ? 700 : 400}`, `font-style:${el.italic ? 'italic' : 'normal'}`,
        `text-decoration:${[el.underline && 'underline', el.strike && 'line-through'].filter(Boolean).join(' ') || 'none'}`,
        `text-align:${['left', 'center', 'right', 'justify'].includes(el.align) ? el.align : 'left'}`, `line-height:${+el.lineHeight || 1.25}`, `letter-spacing:${(+el.spacing || 0) / 100}em`,
        `text-transform:${el.upper ? 'uppercase' : 'none'}`,
      ];
      if (el.shadow) st.push(`text-shadow:0 ${size * 0.06}px ${size * 0.18}px rgba(0,0,0,.35)`);
      if (el.outline) st.push(`-webkit-text-stroke:${Math.max(1, size * 0.03)}px ${safeColor(el.outlineColor, '#000')}`);
      if (el.highlight) st.push(`background:${safeColor(el.highlight, '#FFE066')};padding:.15em .35em;border-radius:.2em;box-decoration-break:clone;-webkit-box-decoration-break:clone`);
      if (el.effect === 'neon') st.push(`text-shadow:0 0 ${size * 0.1}px ${safeColor(el.color, '#fff')},0 0 ${size * 0.4}px ${safeColor(el.color, '#fff')},0 0 ${size * 0.9}px ${safeColor(el.glowColor || el.color, '#fff')}`);
      if (el.effect === 'lift') st.push(`text-shadow:0 ${size * 0.08}px ${size * 0.3}px rgba(0,0,0,.45)`);
      if (el.effect === 'echo') st.push(`text-shadow:${size * 0.04}px ${size * 0.04}px 0 ${safeColor(el.glowColor, 'rgba(0,0,0,.35)')},${size * 0.09}px ${size * 0.09}px 0 rgba(0,0,0,.18)`);
      if (el.effect === 'hollow') st.push(`-webkit-text-stroke:${Math.max(1, size * 0.04)}px ${safeColor(el.color, '#000')};color:transparent`);
      if (el.effect === 'splice') st.push(`-webkit-text-stroke:${Math.max(1, size * 0.03)}px ${safeColor(el.color, '#000')};color:transparent;text-shadow:${size * 0.06}px ${size * 0.06}px 0 ${safeColor(el.glowColor, '#FF6B8B')}`);
      return `<div class="txt" style="${st.join(';')}">${el.html != null ? sanitizeHtml(el.html) : esc(el.text)}</div>`;
    }
    case 'shape': {
      const s = SHAPES[el.shape] || SHAPES.rect;
      let out;
      if (s.css && !s.circle && !el.gradient) {
        const r = el.shape === 'rounded' ? (el.radius ?? 18) : (+el.radius || 0);
        const border = el.strokeWidth ? `border:${+el.strokeWidth}px solid ${safeColor(el.stroke, '#000')};` : '';
        out = `<div style="width:100%;height:100%;background:${safeColor(el.fill, '#6C4CF5')};border-radius:${(r / 100) * Math.min(el.w, el.h)}px;${border}"></div>`;
      } else {
        const fill = el.gradient ? `url(#g${el.id})` : safeColor(el.fill, '#6C4CF5');
        let svg = shapeSvg(el.shape, fill, el.strokeWidth ? safeColor(el.stroke, '#000') : 'none', +el.strokeWidth || 0);
        if (el.gradient) svg = svg.replace('>', `><defs>${gradientDef(el.gradient, 'g' + el.id)}</defs>`);
        if (s.css && !s.circle && el.gradient) { const r = el.shape === 'rounded' ? (el.radius ?? 18) : (+el.radius || 0); svg = svg.replace(/rx="[^"]*"/, `rx="${(r / 100) * 100 * (Math.min(el.w, el.h) / Math.max(el.w, 1))}"`); }
        out = svg;
      }
      if (el.text && (el.text.html || el.id === window.__editingShape)) {
        const a = textArea(el), t = el.text;
        const st = `left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px;font-family:'${safeFont(t.font)}',sans-serif;font-size:${+t.size || 32}px;color:${safeColor(t.color, '#fff')};font-weight:${t.bold ? 700 : 400};font-style:${t.italic ? 'italic' : 'normal'};text-align:${t.align || 'center'};justify-content:${{ top: 'flex-start', bottom: 'flex-end' }[t.valign] || 'center'};line-height:${+t.lineHeight || 1.2}`;
        out += `<div class="shape-text" style="${st}"><div class="txt">${sanitizeHtml(t.html)}</div></div>`;
      }
      return out;
    }
    case 'line': return renderLine(el);
    case 'table': return renderTable(el);
    case 'chart': return renderChart(el);
    case 'qr': return renderQr(el);
    case 'draw': return renderDraw(el);
    case 'icon': {
      if (el.data) { // an icon from one of the packs (its drawing travels with the element)
        const pack = (el.name || '').split(':')[0];
        let svg = packSvg(pack, el.data, el.color);
        if (el.sw && el.sw !== 2 && el.data.b.includes('stroke')) svg = svg.replace('<svg ', `<svg class="sw-${el.id}" `).replace('>', `><style>.sw-${el.id} *{stroke-width:${+el.sw}}</style>`);
        return svg;
      }
      return lucideSvg(el.name, el.color || '#1E1F2B', el.sw || 2);
    }
    case 'sticker': { const it = packs.stickers[el.name] || el.data; return it ? iconifySvg(it) : ''; }
    case 'logo': { const it = packs.logos[el.name] || el.data; return it ? iconifySvg(it) : ''; }
    case 'svg': return el.data ? iconifySvg(el.data) : '';
    case 'image': {
      const cid = 'c' + el.id;
      const frame = el.frame || 'rect';
      const r = frame === 'rect' && el.radius ? +el.radius : 0;
      const spec = frameSpec(frame);
      const flip = `${el.flipX ? `translate(${el.w} 0) scale(-1 1)` : ''} ${el.flipY ? `translate(0 ${el.h}) scale(1 -1)` : ''}`.trim();
      const fx = el.focusX ?? 50, fy = el.focusY ?? 50;
      const par = `x${fx <= 25 ? 'Min' : fx >= 75 ? 'Max' : 'Mid'}Y${fy <= 25 ? 'Min' : fy >= 75 ? 'Max' : 'Mid'} slice`;
      const clip = spec.clip ? `<defs><clipPath id="${cid}" clipPathUnits="objectBoundingBox"><g transform="scale(.01)">${spec.clip}</g></clipPath></defs>` : r ? `<defs><clipPath id="${cid}"><rect width="${el.w}" height="${el.h}" rx="${(r / 100) * Math.min(el.w, el.h)}"/></clipPath></defs>` : '';
      const useClip = spec.clip || r ? `clip-path="url(#${cid})"` : '';
      const [ix, iy, iw, ih] = spec.inset;
      const img = `<image href="${safeSrc(el.src)}" x="${(ix / 100) * el.w}" y="${(iy / 100) * el.h}" width="${(iw / 100) * el.w}" height="${(ih / 100) * el.h}" preserveAspectRatio="${par}" ${flip ? `transform="${flip}"` : ''}/>`;
      const over = spec.over ? `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;pointer-events:none${spec.under ? ';z-index:0' : ''}">${spec.over.replace(/#1E1F2B/g, safeColor(el.frameColor, '#1E1F2B'))}</svg>` : '';
      const main = `<svg viewBox="0 0 ${el.w} ${el.h}" preserveAspectRatio="none" style="filter:${filterCss(el.filters)};position:relative;z-index:1">${clip}<g ${useClip}>${img}</g></svg>`;
      return spec.under ? over + main : main + over;
    }
  }
  return '';
}
function gradientDef(g, id) {
  const stops = (g.stops || [['#6C4CF5', 0], ['#FF6B8B', 100]]).map(([c, p]) => `<stop offset="${+p}%" stop-color="${safeColor(c, '#000')}"/>`).join('');
  if (g.type === 'radial') return `<radialGradient id="${id}" cx="50%" cy="50%" r="70%">${stops}</radialGradient>`;
  const a = ((+g.angle || 135) - 90) * Math.PI / 180;
  return `<linearGradient id="${id}" x1="${50 - 50 * Math.cos(a)}%" y1="${50 - 50 * Math.sin(a)}%" x2="${50 + 50 * Math.cos(a)}%" y2="${50 + 50 * Math.sin(a)}%" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`.replace('gradientUnits="userSpaceOnUse"', '');
}

export function elStyle(el) {
  return `left:${+el.x || 0}px;top:${+el.y || 0}px;width:${+el.w || 0}px;height:${el.type === 'text' ? 'auto' : (+el.h || 0) + 'px'};`
    + `transform:rotate(${+el.rot || 0}deg);opacity:${el.opacity ?? 1};`
    + (el.shadowBox ? 'filter:drop-shadow(0 12px 22px rgba(0,0,0,.22));' : '');
}

export function elementNode(el) {
  const n = document.createElement('div');
  n.className = `el ${el.type}${el.locked ? ' locked' : ''}`;
  n.dataset.id = el.id;
  n.style.cssText = elStyle(el);
  n.innerHTML = `<div class="inner">${innerHtml(el)}</div>`;
  if (el.type === 'text') n.querySelector('.inner').style.height = 'auto';
  return n;
}

// A full, unscaled slide node (doc.w x doc.h)
export function slideNode(slide, doc) {
  const n = document.createElement('div');
  n.className = 'slide-render';
  n.style.cssText = `width:${doc.w}px;height:${doc.h}px;${bgCss(slide.bg)}`;
  for (const el of slide.elements) if (!el.hidden) n.appendChild(elementNode(el));
  return n;
}

// Scaled preview that fits a box of the given width
export function miniSlide(slide, doc, width) {
  const s = width / doc.w;
  const wrap = document.createElement('div');
  wrap.style.cssText = `width:${width}px;height:${doc.h * s}px;position:relative;overflow:hidden`;
  const node = slideNode(slide, doc);
  node.style.position = 'absolute'; node.style.transformOrigin = '0 0'; node.style.transform = `scale(${s})`;
  node.style.pointerEvents = 'none';
  wrap.appendChild(node);
  return wrap;
}
