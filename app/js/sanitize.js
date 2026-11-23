// Text safety: the HTML of text boxes, table cells and shape labels only ever holds a few formatting tags.
// Everything else (scripts, event handlers, links, styles) is removed — files from other people, pasted
// content and Claude's connector all go through here.
const TAGS = new Set(['B', 'I', 'U', 'S', 'STRIKE', 'BR', 'DIV', 'SPAN', 'STRONG', 'EM', 'P', 'LI', 'UL', 'OL', 'FONT']);
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i;

export function sanitizeHtml(html) {
  if (html == null) return '';
  const s = String(html);
  if (!/[<&]/.test(s)) return s;
  const doc = new DOMParser().parseFromString(`<div>${s}</div>`, 'text/html');
  const root = doc.body.firstChild;
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) continue;
      if (child.nodeType !== 1 || !TAGS.has(child.tagName)) { // unknown tag: keep its text, drop the tag
        child.replaceWith(...[...child.childNodes]);
        continue;
      }
      // keep only a colour / size / weight on spans and fonts, nothing else
      const keep = {};
      if (child.tagName === 'SPAN' || child.tagName === 'FONT') {
        const st = child.getAttribute('style') || '';
        const m = /color\s*:\s*([^;]+)/i.exec(st); if (m && COLOR.test(m[1].trim())) keep.color = m[1].trim();
        const f = /font-size\s*:\s*(\d+(\.\d+)?)(px|em|%)/i.exec(st); if (f) keep.size = f[1] + f[3];
        const w = /font-weight\s*:\s*(bold|[5-9]00)/i.exec(st); if (w) keep.bold = true;
        const fc = child.getAttribute('color'); if (fc && COLOR.test(fc)) keep.color = fc;
      }
      for (const a of [...child.attributes]) child.removeAttribute(a.name);
      if (keep.color || keep.size || keep.bold) child.setAttribute('style', [keep.color && `color:${keep.color}`, keep.size && `font-size:${keep.size}`, keep.bold && 'font-weight:700'].filter(Boolean).join(';'));
      if (child.tagName === 'FONT') { const sp = doc.createElement('span'); if (child.getAttribute('style')) sp.setAttribute('style', child.getAttribute('style')); sp.append(...child.childNodes); child.replaceWith(sp); walk(sp); continue; }
      walk(child);
    }
  };
  walk(root);
  return root.innerHTML;
}
export const plainText = (html) => { const d = document.createElement('div'); d.innerHTML = sanitizeHtml(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|li)>\s*<(div|p|li)>/gi, '\n'); return d.textContent; };
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// a CSS colour or gradient, or the fallback
export const safeColor = (c, fb = '#000000') => (typeof c === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|(linear|radial)-gradient\([^;<>"]*\)|transparent|[a-z]+)$/i.test(c.trim()) ? c.trim() : fb);
export const safeFont = (f) => String(f || 'Inter').replace(/["'<>;\\]/g, '').slice(0, 60);
export const safeSrc = (s) => (typeof s === 'string' && /^(data:image\/|blob:|assets\/|media\/|https:\/\/)/.test(s) ? s : '');
