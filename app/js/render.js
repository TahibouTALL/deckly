// Turns the document model into DOM (editor, thumbnails, present mode and exports all use this).
import { SHAPES, shapeSvg, lucideSvg, iconifySvg, packs } from './assets.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function bgCss(bg) {
  if (!bg) return 'background:#fff';
  if (bg.type === 'gradient') return `background:${bg.value}`;
  if (bg.type === 'image') return `background:#ddd url("${bg.value}") center/cover no-repeat`;
  return `background:${bg.value}`;
}

function shapeClip(key, id) {
  const s = SHAPES[key] || SHAPES.rect;
  let body;
  if (s.circle) body = '<ellipse cx="50" cy="50" rx="50" ry="50"/>';
  else if (s.css) body = `<rect width="100" height="100" rx="${s.radius || 0}"/>`;
  else if (s.pts) body = `<polygon points="${s.pts}"/>`;
  else body = `<path d="${s.d}" ${s.evenodd ? 'clip-rule="evenodd"' : ''}/>`;
  return `<clipPath id="${id}" clipPathUnits="objectBoundingBox"><g transform="scale(.01)">${body}</g></clipPath>`;
}

export function filterCss(f = {}) {
  const p = [];
  if (f.brightness != null && f.brightness !== 100) p.push(`brightness(${f.brightness}%)`);
  if (f.contrast != null && f.contrast !== 100) p.push(`contrast(${f.contrast}%)`);
  if (f.saturate != null && f.saturate !== 100) p.push(`saturate(${f.saturate}%)`);
  if (f.grayscale) p.push(`grayscale(${f.grayscale}%)`);
  if (f.sepia) p.push(`sepia(${f.sepia}%)`);
  if (f.blur) p.push(`blur(${f.blur}px)`);
  if (f.hue) p.push(`hue-rotate(${f.hue}deg)`);
  return p.join(' ');
}

export function innerHtml(el) {
  switch (el.type) {
    case 'text': {
      const st = [
        `font-family:'${el.font || 'Inter'}',sans-serif`, `font-size:${el.size || 32}px`, `color:${el.color || '#1E1F2B'}`,
        `font-weight:${el.bold ? 700 : 400}`, `font-style:${el.italic ? 'italic' : 'normal'}`,
        `text-decoration:${[el.underline && 'underline', el.strike && 'line-through'].filter(Boolean).join(' ') || 'none'}`,
        `text-align:${el.align || 'left'}`, `line-height:${el.lineHeight || 1.25}`, `letter-spacing:${(el.spacing || 0) / 100}em`,
        `text-transform:${el.upper ? 'uppercase' : 'none'}`,
      ];
      if (el.shadow) st.push(`text-shadow:0 ${el.size * 0.06}px ${el.size * 0.18}px rgba(0,0,0,.35)`);
      if (el.outline) st.push(`-webkit-text-stroke:${Math.max(1, el.size * 0.03)}px ${el.outlineColor || '#000'}`);
      if (el.highlight) st.push(`background:${el.highlight};padding:.15em .35em;border-radius:.2em;box-decoration-break:clone;-webkit-box-decoration-break:clone`);
      return `<div class="txt" style="${st.join(';')}">${el.html ?? esc(el.text)}</div>`;
    }
    case 'shape': {
      const s = SHAPES[el.shape];
      if (s?.line) {
        const sw = el.strokeWidth || 6, c = el.stroke || '#1E1F2B';
        const dash = s.dash ? `stroke-dasharray="${sw * 3} ${sw * 2}"` : s.dot ? `stroke-dasharray="0.1 ${sw * 2}" stroke-linecap="round"` : 'stroke-linecap="round"';
        const head = s.arrow ? `<path d="M${el.w - sw * 3.2} ${el.h / 2 - sw * 2.2} L${el.w - sw * 0.6} ${el.h / 2} L${el.w - sw * 3.2} ${el.h / 2 + sw * 2.2}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>` : '';
        return `<svg viewBox="0 0 ${el.w} ${el.h}" preserveAspectRatio="none"><line x1="${sw / 2}" y1="${el.h / 2}" x2="${el.w - (s.arrow ? sw : sw / 2)}" y2="${el.h / 2}" stroke="${c}" stroke-width="${sw}" ${dash}/>${head}</svg>`;
      }
      if (s?.css && !s.circle) {
        const r = el.shape === 'rounded' ? (el.radius ?? 18) : (el.radius || 0);
        const border = el.strokeWidth ? `border:${el.strokeWidth}px solid ${el.stroke || '#000'};` : '';
        return `<div style="width:100%;height:100%;background:${el.fill};border-radius:${(r / 100) * Math.min(el.w, el.h)}px;${border}"></div>`;
      }
      return shapeSvg(el.shape, el.fill || '#6C4CF5', el.strokeWidth ? el.stroke || '#000' : 'none', el.strokeWidth || 0);
    }
    case 'icon': return lucideSvg(el.name, el.color || '#1E1F2B', el.sw || 2);
    case 'sticker': { const it = packs.stickers[el.name] || el.data; return it ? iconifySvg(it) : ''; }
    case 'logo': { const it = packs.logos[el.name] || el.data; return it ? iconifySvg(it) : ''; }
    case 'svg': return el.data ? iconifySvg(el.data) : '';
    case 'image': {
      const cid = 'c' + el.id;
      const frame = el.frame || 'rect';
      const r = frame === 'rect' && el.radius ? el.radius : 0;
      const flip = el.flipX ? `transform="translate(${el.w} 0) scale(-1 1)"` : '';
      const fx = el.focusX ?? 50, fy = el.focusY ?? 50;
      const par = `x${fx <= 25 ? 'Min' : fx >= 75 ? 'Max' : 'Mid'}Y${fy <= 25 ? 'Min' : fy >= 75 ? 'Max' : 'Mid'} slice`;
      const clip = frame !== 'rect' ? `<defs>${shapeClip(frame, cid)}</defs>` : r ? `<defs><clipPath id="${cid}"><rect width="${el.w}" height="${el.h}" rx="${(r / 100) * Math.min(el.w, el.h)}"/></clipPath></defs>` : '';
      const useClip = frame !== 'rect' || r ? `clip-path="url(#${cid})"` : '';
      return `<svg viewBox="0 0 ${el.w} ${el.h}" preserveAspectRatio="none" style="filter:${filterCss(el.filters)}">${clip}<g ${useClip}><image href="${el.src}" width="${el.w}" height="${el.h}" preserveAspectRatio="${par}" ${flip}/></g></svg>`;
    }
  }
  return '';
}

export function elStyle(el) {
  return `left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.type === 'text' ? 'auto' : el.h + 'px'};`
    + `transform:rotate(${el.rot || 0}deg);opacity:${el.opacity ?? 1};`
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
