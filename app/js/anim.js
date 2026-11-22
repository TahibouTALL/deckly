// Animation engine: entrance / exit / loop effects for elements, page transitions and "Match & move".
// Works on any rendered slide (present mode, editor preview, panel demos) through the Web Animations API.
import { bgCss } from './render.js';

// ---------- effects ----------
// motion vectors: the direction the element MOVES toward
const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const EASE = 'cubic-bezier(.2,.8,.2,1)', SPRING = 'cubic-bezier(.34,1.56,.64,1)';
const tr = (dir, d) => { const [x, y] = VEC[dir] || VEC.up; return `translate(${-x * d}px,${-y * d}px)`; };
const wipeFrom = { right: 'inset(0 100% 0 0)', left: 'inset(0 0 0 100%)', up: 'inset(100% 0 0 0)', down: 'inset(0 0 100% 0)' };

// k: key, n: name, dirs: default direction (or null), text: default split for text, img: images only, dur: seconds
export const EFFECTS = {
  rise: { n: 'Rise', dirs: 'up', dur: 0.8, kf: (d) => [{ opacity: 0, transform: tr(d, 60) }, { opacity: 1, transform: 'none' }], ease: EASE },
  pan: { n: 'Pan', dirs: 'right', dur: 1, kf: (d) => [{ opacity: 0, transform: tr(d, 160) }, { opacity: 1, transform: 'none' }], ease: 'cubic-bezier(.16,1,.3,1)' },
  fade: { n: 'Fade', dur: 0.8, kf: () => [{ opacity: 0 }, { opacity: 1 }], ease: 'ease-out' },
  pop: { n: 'Pop', dur: 0.6, kf: () => [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1.08)', offset: 0.7 }, { opacity: 1, transform: 'none' }], ease: 'ease-out' },
  wipe: { n: 'Wipe', dirs: 'right', dur: 0.8, kf: (d) => [{ clipPath: wipeFrom[d] || wipeFrom.right }, { clipPath: 'inset(0 0 0 0)' }], ease: 'cubic-bezier(.65,0,.35,1)' },
  blur: { n: 'Blur', dur: 0.9, kf: () => [{ opacity: 0, filter: 'blur(24px)' }, { opacity: 1, filter: 'blur(0px)' }], ease: 'ease-out' },
  breathe: { n: 'Breathe', dur: 1.2, kf: () => [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'scale(1.03)', offset: 0.7 }, { opacity: 1, transform: 'none' }], ease: 'ease-in-out' },
  baseline: { n: 'Baseline', text: 'line', dur: 0.8, kf: () => [{ transform: 'translateY(100%)', clipPath: 'inset(0 0 100% 0)' }, { transform: 'none', clipPath: 'inset(0 0 0% 0)' }], ease: 'cubic-bezier(.16,1,.3,1)' },
  drift: { n: 'Drift', dirs: 'right', dur: 1.8, kf: (d) => [{ opacity: 0, transform: tr(d, 50) }, { opacity: 1, transform: 'none' }], ease: 'ease-out' },
  tectonic: { n: 'Tectonic', dur: 0.9, kf: () => [{ opacity: 0, transform: 'translateY(-120px) rotate(4deg)' }, { opacity: 1, transform: 'translateY(8px) rotate(-1deg)', offset: 0.7 }, { opacity: 1, transform: 'none' }], ease: 'ease-out' },
  tumble: { n: 'Tumble', dur: 0.9, kf: () => [{ opacity: 0, transform: 'translate(-60px,30px) rotate(-35deg) scale(.7)' }, { opacity: 1, transform: 'none' }], ease: EASE },
  neon: { n: 'Neon', dur: 1.3, kf: () => [{ opacity: 0, filter: 'brightness(2)' }, { opacity: 1, offset: 0.1 }, { opacity: 0.15, offset: 0.2 }, { opacity: 1, offset: 0.32 }, { opacity: 0.35, offset: 0.45 }, { opacity: 1, offset: 0.55, filter: 'brightness(1.6)' }, { opacity: 1, filter: 'brightness(1)' }], ease: 'linear' },
  scrapbook: { n: 'Scrapbook', dur: 0.8, kf: () => [{ opacity: 0, transform: 'rotate(-9deg) scale(.8)', easing: 'steps(1,end)' }, { opacity: 1, transform: 'rotate(7deg) scale(1.06)', offset: 0.33, easing: 'steps(1,end)' }, { opacity: 1, transform: 'rotate(-3deg) scale(.97)', offset: 0.66, easing: 'steps(1,end)' }, { opacity: 1, transform: 'none' }], ease: 'linear' },
  stomp: { n: 'Stomp', dur: 0.55, kf: () => [{ opacity: 0, transform: 'scale(2.4)' }, { opacity: 1, transform: 'scale(.94)', offset: 0.75 }, { opacity: 1, transform: 'none' }], ease: 'ease-in' },
  bounce: { n: 'Bounce', dur: 1.1, kf: () => [{ opacity: 0, transform: 'translateY(-160px)' }, { opacity: 1, transform: 'translateY(0)', offset: 0.45, easing: 'ease-out' }, { transform: 'translateY(-40px)', offset: 0.65, easing: 'ease-in' }, { transform: 'translateY(0)', offset: 0.8, easing: 'ease-out' }, { transform: 'translateY(-10px)', offset: 0.9, easing: 'ease-in' }, { opacity: 1, transform: 'none' }], ease: 'linear' },
  roll: { n: 'Roll', dirs: 'right', dur: 1, kf: (d) => [{ opacity: 0, transform: `${tr(d, 220)} rotate(${d === 'left' ? 200 : -200}deg)` }, { opacity: 1, transform: 'none' }], ease: EASE },
  skate: { n: 'Skate', dirs: 'right', dur: 0.9, kf: (d) => [{ opacity: 0, transform: `${tr(d, 200)} skewX(${d === 'left' ? -30 : 30}deg)` }, { opacity: 1, transform: `${tr(d, -12)} skewX(${d === 'left' ? 8 : -8}deg)`, offset: 0.75 }, { opacity: 1, transform: 'none' }], ease: 'ease-out' },
  spread: { n: 'Spread', dur: 0.8, kf: () => [{ opacity: 0, transform: 'scaleX(.15)', letterSpacing: '.5em' }, { opacity: 1, transform: 'none' }], ease: EASE },
  burst: { n: 'Burst', dur: 0.7, kf: () => [{ opacity: 0, transform: 'scale(0) rotate(-30deg)' }, { opacity: 1, transform: 'scale(1.2) rotate(6deg)', offset: 0.6 }, { opacity: 1, transform: 'none' }], ease: 'ease-out' },
  clarify: { n: 'Clarify', dur: 1.1, kf: () => [{ opacity: 0, filter: 'blur(14px)', transform: 'scale(1.15)' }, { opacity: 1, filter: 'blur(0px)', transform: 'none' }], ease: 'ease-out' },
  block: { n: 'Block', dirs: 'right', dur: 1, block: true },
  ascend: { n: 'Ascend', text: 'letter', dur: 0.6, kf: () => [{ opacity: 0, transform: 'translateY(60%)' }, { opacity: 1, transform: 'none' }], ease: EASE },
  shift: { n: 'Shift', text: 'word', dur: 0.6, kf: () => [{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], ease: EASE },
  merge: { n: 'Merge', text: 'word', dur: 0.8, kf: (d, i) => [{ opacity: 0, transform: `translateX(${i % 2 ? 90 : -90}px)` }, { opacity: 1, transform: 'none' }], ease: EASE },
  typewriter: { n: 'Typewriter', text: 'letter', dur: 0.05, kf: () => [{ opacity: 0 }, { opacity: 1 }], ease: 'steps(1,end)', step: 0.06 },
  photoZoom: { n: 'Photo zoom', img: true, dur: 2.6, kf: () => [{ transform: 'scale(1.3)', opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: 'none', opacity: 1 }], ease: 'cubic-bezier(.2,.6,.3,1)' },
  photoFlow: { n: 'Photo flow', img: true, dirs: 'left', dur: 3, kf: (d) => [{ transform: `scale(1.2) ${tr(d, 60)}`, opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: 'none', opacity: 1 }], ease: 'ease-out' },
};
export const LOOPS = {
  breathe: { n: 'Breathe', dur: 2.4, kf: [{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }], dir: 'alternate', ease: 'ease-in-out' },
  pulse: { n: 'Pulse', dur: 1.6, kf: [{ opacity: 1 }, { opacity: 0.55 }], dir: 'alternate', ease: 'ease-in-out' },
  wiggle: { n: 'Wiggle', dur: 0.9, kf: [{ transform: 'rotate(-3deg)' }, { transform: 'rotate(3deg)' }], dir: 'alternate', ease: 'ease-in-out' },
  float: { n: 'Float', dur: 2.6, kf: [{ transform: 'translateY(0)' }, { transform: 'translateY(-12px)' }], dir: 'alternate', ease: 'ease-in-out' },
  spin: { n: 'Spin', dur: 8, kf: [{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], dir: 'normal', ease: 'linear' },
  flicker: { n: 'Flicker', dur: 3, kf: [{ opacity: 1 }, { opacity: 1, offset: 0.9 }, { opacity: 0.4, offset: 0.93 }, { opacity: 1, offset: 0.96 }, { opacity: 1 }], dir: 'normal', ease: 'linear' },
};
export const TRANSITIONS = {
  fade: { n: 'Dissolve', dur: 0.6 },
  slide: { n: 'Slide', dirs: 'left', dur: 0.6 },
  push: { n: 'Push', dirs: 'left', dur: 0.7 },
  wipe: { n: 'Wipe', dirs: 'left', dur: 0.7 },
  circle: { n: 'Circle wipe', dur: 0.8 },
  colorWipe: { n: 'Colour wipe', dirs: 'left', dur: 1 },
  stack: { n: 'Stack', dur: 0.7 },
  zoom: { n: 'Zoom', dur: 0.6 },
  flip: { n: 'Flip', dur: 0.8 },
  morph: { n: 'Match & move', dur: 0.9 },
};
const OLD = { slide: 'pan', drop: 'tectonic' }; // names from version 1.1

// ---------- element animation settings ----------
// el.anim = { in, dir, by, speed, delay, trigger: 'auto'|'click', out, outDir, loop }
export function animOf(el) {
  if (!el.anim) return null;
  if (typeof el.anim === 'string') return { in: OLD[el.anim] || el.anim, delay: el.animDelay || 0, speed: 1, trigger: 'auto' };
  return el.anim;
}
export const hasAnim = (el) => { const a = animOf(el); return !!(a && (a.in || a.out || a.loop)); };
export function slideTransition(slide) {
  const t = slide.transition;
  if (!t) return null;
  return typeof t === 'string' ? { type: t === 'flip' ? 'flip' : t, dur: (TRANSITIONS[t] || {}).dur || 0.6 } : t;
}

// ---------- text splitting (letter / word / line) ----------
function splitText(inner, by) {
  const txt = inner.querySelector('.txt'); if (!txt) return [inner];
  const words = [];
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const part of child.nodeValue.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
          const w = document.createElement('span'); w.className = 'an-w'; w.style.display = 'inline-block';
          if (by === 'letter') for (const ch of part) { const l = document.createElement('span'); l.className = 'an-l'; l.style.display = 'inline-block'; l.textContent = ch; w.appendChild(l); }
          else w.textContent = part;
          frag.appendChild(w); words.push(w);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && child.tagName !== 'BR') walk(child);
    }
  };
  walk(txt);
  if (by === 'letter') return [...txt.querySelectorAll('.an-l')];
  if (by === 'line') { // words on the same line move together
    const lines = new Map();
    for (const w of words) { const top = Math.round(w.offsetTop / 4); if (!lines.has(top)) lines.set(top, []); lines.get(top).push(w); }
    return [...lines.values()];
  }
  return words;
}

// ---------- playing ----------
const STAGGER = { letter: 0.035, word: 0.09, line: 0.2 };
function animateTargets(targets, eff, a, dir, baseDelay, reverse) {
  const speed = a.speed || 1;
  const dur = (eff.dur / speed) * 1000;
  const step = ((eff.step || STAGGER[a.by || eff.text] || 0) / speed) * 1000;
  let end = 0;
  targets.forEach((t, i) => {
    const group = Array.isArray(t) ? t : [t];
    const delay = baseDelay + i * step;
    for (const n of group) {
      let kf = eff.kf(dir, i);
      if (reverse) kf = [...kf].reverse().map((f, j, arr) => ({ ...f, offset: f.offset != null ? 1 - f.offset : undefined }));
      n.animate(kf, { duration: dur, delay, easing: eff.ease || EASE, fill: 'both', direction: 'normal' });
    }
    end = Math.max(end, delay + dur);
  });
  return end;
}
function blockReveal(inner, a, dir, baseDelay, color) {
  const speed = a.speed || 1, dur = (1 / speed) * 1000;
  const bar = document.createElement('div');
  bar.style.cssText = `position:absolute;inset:0;background:${color};z-index:5;pointer-events:none;transform-origin:${dir === 'left' ? 'right' : 'left'} center`;
  inner.style.position = 'relative'; inner.appendChild(bar);
  const content = [...inner.children].filter((c) => c !== bar);
  bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)', offset: 0.45 }, { transform: 'scaleX(1)', transformOrigin: `${dir === 'left' ? 'left' : 'right'} center`, offset: 0.55 }, { transform: 'scaleX(0)', transformOrigin: `${dir === 'left' ? 'left' : 'right'} center` }], { duration: dur, delay: baseDelay, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' });
  content.forEach((c) => c.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.51 }, { opacity: 1 }], { duration: dur, delay: baseDelay, fill: 'both' }));
  setTimeout(() => bar.remove(), baseDelay + dur + 50);
  return baseDelay + dur;
}

// Plays the entrance of one element (rendered node = .el). Returns the end time in ms.
export function playIn(node, el, extraDelay = 0, accent = '#6C4CF5') {
  const a = animOf(el); if (!a?.in) return 0;
  const eff = EFFECTS[a.in]; if (!eff) return 0;
  const inner = node.querySelector(':scope > .inner'); if (!inner) return 0;
  const delay = ((a.delay || 0) * 1000) + extraDelay;
  if (eff.block) return blockReveal(inner, a, a.dir || eff.dirs, delay, el.color || accent);
  const by = el.type === 'text' ? (a.by || eff.text || 'element') : 'element';
  const targets = by === 'element' ? [inner] : splitText(inner, by);
  return animateTargets(targets, eff, { ...a, by }, a.dir || eff.dirs, delay, false);
}
export function playOut(node, el) {
  const a = animOf(el); if (!a?.out) return 0;
  const eff = EFFECTS[a.out]; if (!eff || eff.block) return 0;
  const inner = node.querySelector(':scope > .inner'); if (!inner) return 0;
  inner.getAnimations().forEach((x) => x.cancel());
  return animateTargets([inner], eff, { ...a, by: 'element' }, a.outDir || eff.dirs, 0, true);
}
export function startLoop(node, el, delay = 0) {
  const a = animOf(el); if (!a?.loop || !LOOPS[a.loop]) return;
  const L = LOOPS[a.loop];
  // the loop runs on the content inside .inner, so it never fights with the entrance animation on .inner
  const inner = node.querySelector(':scope > .inner'); if (!inner) return;
  (inner.firstElementChild || inner).animate(L.kf, { duration: L.dur * 1000, delay, iterations: Infinity, direction: L.dir, easing: L.ease });
}
// hide every element that waits for a click, until its step comes
export function hideForClick(node, slide) {
  for (const el of slide.elements) {
    const a = animOf(el); if (a?.trigger !== 'click') continue;
    const n = node.querySelector(`[data-id="${el.id}"]`); if (n) n.style.visibility = 'hidden';
  }
}
// The steps of a slide: [auto elements], then one group per click
export function stepsOf(slide) {
  const auto = [], clicks = [];
  for (const el of slide.elements) {
    if (el.hidden) continue;
    const a = animOf(el);
    if (a?.trigger === 'click') clicks.push([el]); else auto.push(el);
  }
  return { auto, clicks };
}
// play a group of elements (their own delays apply), returns the end time
export function playGroup(node, els, accent) {
  let end = 0;
  for (const el of els) {
    const n = node.querySelector(`[data-id="${el.id}"]`); if (!n) continue;
    n.style.visibility = '';
    const t = playIn(n, el, 0, accent);
    startLoop(n, el, t);
    end = Math.max(end, t);
  }
  return end;
}
export function playOutAll(node, slide) {
  let end = 0;
  for (const el of slide.elements) { const n = node.querySelector(`[data-id="${el.id}"]`); if (n) end = Math.max(end, playOut(n, el)); }
  return end;
}

// ---------- transitions between slides ----------
// oldNode / newNode: two absolutely positioned slide nodes in the same stage, newNode on top.
export function playTransition(oldNode, newNode, t, ctx = {}) {
  if (!t || !TRANSITIONS[t.type]) return 0;
  const T = TRANSITIONS[t.type];
  const dur = (t.dur || T.dur) * 1000, dir = t.dir || T.dirs || 'left';
  const [vx, vy] = VEC[dir] || VEC.left;
  const opts = { duration: dur, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' };
  const pct = (x, y) => `translate(${-vx * x}%, ${-vy * y}%)`;
  switch (t.type) {
    case 'fade': newNode.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, easing: 'ease' }); break;
    case 'slide': newNode.animate([{ translate: `${-vx * 100}% ${-vy * 100}%` }, { translate: '0 0' }], opts); break;
    case 'push':
      newNode.animate([{ translate: `${-vx * 100}% ${-vy * 100}%` }, { translate: '0 0' }], opts);
      oldNode?.animate([{ translate: '0 0' }, { translate: `${vx * 100}% ${vy * 100}%` }], opts); break;
    case 'wipe': newNode.animate([{ clipPath: { left: 'inset(0 0 0 100%)', right: 'inset(0 100% 0 0)', up: 'inset(100% 0 0 0)', down: 'inset(0 0 100% 0)' }[dir] }, { clipPath: 'inset(0 0 0 0)' }], opts); break;
    case 'circle': newNode.animate([{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }], { ...opts, easing: 'cubic-bezier(.4,0,.2,1)' }); break;
    case 'colorWipe': {
      const panel = document.createElement('div');
      panel.style.cssText = `position:absolute;inset:0;background:${ctx.accent || '#6C4CF5'};z-index:20;pointer-events:none`;
      newNode.parentNode.appendChild(panel);
      panel.animate([{ translate: `${-vx * 100}% ${-vy * 100}%` }, { translate: '0 0', offset: 0.45 }, { translate: '0 0', offset: 0.55 }, { translate: `${vx * 100}% ${vy * 100}%` }], { duration: dur, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' });
      newNode.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.51 }, { opacity: 1 }], { duration: dur, fill: 'both' });
      setTimeout(() => panel.remove(), dur + 30); break;
    }
    case 'stack':
      newNode.animate([{ translate: '0 100%', boxShadow: '0 -30px 60px rgba(0,0,0,.4)' }, { translate: '0 0', boxShadow: '0 0 0 rgba(0,0,0,0)' }], opts);
      oldNode?.animate([{ scale: '1', filter: 'brightness(1)' }, { scale: '.9', filter: 'brightness(.6)' }], opts); break;
    case 'zoom': newNode.animate([{ opacity: 0, scale: '.85' }, { opacity: 1, scale: '1' }], { ...opts, easing: 'cubic-bezier(.2,.8,.2,1)' }); break;
    case 'flip':
      newNode.parentNode.style.perspective = '2000px';
      newNode.animate([{ opacity: 0, rotate: 'y 90deg' }, { opacity: 0, rotate: 'y 90deg', offset: 0.45 }, { opacity: 1, rotate: 'y 0deg' }], opts);
      oldNode?.animate([{ rotate: 'y 0deg', opacity: 1 }, { rotate: 'y -90deg', opacity: 0, offset: 0.5 }, { rotate: 'y -90deg', opacity: 0 }], opts); break;
    case 'morph': morph(oldNode, newNode, ctx.oldSlide, ctx.newSlide, dur); break;
  }
  return dur;
}

// "Match & move": elements that exist on both slides glide from their old place to the new one.
export const matchKey = (el) => el.mid || el.id;
function contentKey(el) { return el.type + '|' + (el.src || el.name || el.html || el.shape || '').slice(0, 200); }
function morph(oldNode, newNode, oldSlide, newSlide, dur) {
  if (!oldNode || !oldSlide) { newNode.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur, fill: 'both' }); return; }
  const oldBy = new Map(), oldByContent = new Map();
  for (const e of oldSlide.elements) { oldBy.set(matchKey(e), e); const ck = contentKey(e); oldByContent.set(ck, oldByContent.has(ck) ? null : e); }
  const used = new Set();
  const opts = { duration: dur, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' };
  for (const e of newSlide.elements) {
    const n = newNode.querySelector(`[data-id="${e.id}"]`); if (!n) continue;
    let o = oldBy.get(matchKey(e)); if (!o || used.has(o)) o = oldByContent.get(contentKey(e)) || null;
    if (o && !used.has(o)) {
      used.add(o);
      const dx = o.x - e.x, dy = o.y - e.y, sx = o.w / (e.w || 1), sy = (o.h || e.h) / (e.h || 1);
      // FLIP: start where the old element was (top-left origin), end exactly on the new one, then hand back to CSS
      const origin = n.style.transformOrigin;
      n.style.transformOrigin = '0 0';
      const anim = n.animate([{ transform: `translate(${dx}px,${dy}px) scale(${sx},${e.type === 'text' ? sx : sy}) rotate(${o.rot || 0}deg)`, opacity: o.opacity ?? 1 },
        { transform: `translate(0,0) scale(1,1) rotate(${e.rot || 0}deg)`, opacity: e.opacity ?? 1 }], { ...opts, fill: 'none' });
      anim.onfinish = () => { n.style.transformOrigin = origin; };
      const old = oldNode.querySelector(`[data-id="${o.id}"]`); if (old) old.style.visibility = 'hidden';
    } else n.animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], opts);
  }
  // the old background and the old elements that are not on the new slide fade out underneath
  const under = document.createDocumentFragment();
  const bg = document.createElement('div');
  bg.style.cssText = `position:absolute;inset:0;${bgCss(oldSlide.bg)}`;
  under.appendChild(bg);
  for (const o of oldSlide.elements) {
    if (used.has(o)) continue;
    const on = oldNode.querySelector(`[data-id="${o.id}"]`); if (!on) continue;
    const c = on.cloneNode(true); c.removeAttribute('data-id'); under.appendChild(c);
  }
  const layers = [...under.childNodes];
  newNode.insertBefore(under, newNode.firstChild);
  for (const l of layers) l.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur * 0.7, easing: 'ease', fill: 'both' });
  setTimeout(() => layers.forEach((l) => l.remove()), dur + 50);
  oldNode.style.visibility = 'hidden';
}

// ---------- small demo for the panel tiles ----------
export function demo(node, key, kind = 'in') {
  node.getAnimations().forEach((a) => a.cancel());
  if (kind === 'loop') { const L = LOOPS[key]; if (L) node.animate(L.kf, { duration: L.dur * 1000, iterations: 2, direction: L.dir, easing: L.ease }); return; }
  const eff = EFFECTS[key]; if (!eff || !eff.kf) { node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600 }); return; }
  node.animate(eff.kf(eff.dirs || 'up', 1), { duration: Math.max(500, eff.dur * 1000), easing: eff.ease || EASE, fill: 'both' });
}
