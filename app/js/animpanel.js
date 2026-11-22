// The "Animate" side panel: element animations, page animations and transitions, with live previews.
import { state, emit, commit, curSlide, selected } from './store.js';
import { ic } from './assets.js';
import { t as tr, translateDom } from './i18n.js';
import { EFFECTS, LOOPS, TRANSITIONS, animOf, slideTransition, playIn, startLoop, playOut, stepsOf, demo, hasAnim } from './anim.js';
import { toast } from './ui.js';

const DIRS = [['up', 'arrow-up'], ['down', 'arrow-down'], ['left', 'arrow-left'], ['right', 'arrow-right']];
const sec = (t, extra = '') => `<div class="sec"><h3>${t}</h3>${extra}</div>`;

export function animatePanel(body) {
  const els = selected().filter((e) => !e.locked);
  if (els.length) elementPanel(body, els); else pagePanel(body);
  translateDom(body);
  // hover previews on the tiles
  body.querySelectorAll('[data-demo]').forEach((t) => {
    const d = t.querySelector('.an-demo');
    t.addEventListener('mouseenter', () => demo(d, t.dataset.demo, t.dataset.kind || 'in'));
  });
}

// ---------- one or more elements ----------
function elementPanel(body, els) {
  const el = els[0], a = animOf(el) || {};
  const isText = els.every((e) => e.type === 'text'), isImg = els.every((e) => e.type === 'image');
  const list = Object.entries(EFFECTS).filter(([, e]) => (!e.img || isImg) && (!e.text || e.text === 'line' || isText));
  const tile = (k, e, on, kind = 'in') => `<button class="an-tile ${on ? 'on' : ''}" data-${kind === 'loop' ? 'loop' : 'eff'}="${k}" data-demo="${k}" data-kind="${kind}"><span class="an-demo ${isImg && kind === 'in' ? 'img' : ''}">${isImg && kind === 'in' ? ic('image') : 'Aa'}</span><small>${tr(e.n)}</small></button>`;
  body.insertAdjacentHTML('beforeend', `
    <div class="an-head">${ic('sparkles')}<div><b>${tr(els.length > 1 ? '{n} elements' : 'Element animation', { n: els.length })}</b><small>${tr('Plays when the slide appears in Present mode')}</small></div></div>
    <div class="an-grid">
      <button class="an-tile ${!a.in ? 'on' : ''}" data-eff=""><span class="an-demo none">${ic('ban')}</span><small>${tr('None')}</small></button>
      ${list.map(([k, e]) => tile(k, e, a.in === k)).join('')}
    </div>
    <div id="anOpts"></div>`);
  const opts = body.querySelector('#anOpts');
  if (a.in || a.out || a.loop) {
    const eff = EFFECTS[a.in] || {};
    opts.innerHTML = `
      ${eff.dirs ? sec(tr('Direction')) + `<div class="chips">${DIRS.map(([d, i]) => `<button class="chip icon ${(a.dir || eff.dirs) === d ? 'on' : ''}" data-dir="${d}" title="${d}">${ic(i)}</button>`).join('')}</div>` : ''}
      ${isText && a.in && !eff.block ? sec(tr('Animate')) + `<div class="chips">${[['element', 'Whole text'], ['line', 'By line'], ['word', 'By word'], ['letter', 'By letter']].map(([k, n]) => `<button class="chip ${(a.by || eff.text || 'element') === k ? 'on' : ''}" data-by="${k}">${tr(n)}</button>`).join('')}</div>` : ''}
      <div class="range-row"><label>${tr('Speed')}</label><input type="range" id="anSpeed" min="0.4" max="2.5" step="0.1" value="${a.speed || 1}"><span class="v">×${(a.speed || 1).toFixed(1)}</span></div>
      <div class="range-row"><label>${tr('Delay')}</label><input type="range" id="anDelay" min="0" max="5" step="0.1" value="${a.delay || 0}"><span class="v">${(a.delay || 0).toFixed(1)} s</span></div>
      ${sec(tr('Start'))}<div class="seg"><button class="${a.trigger !== 'click' ? 'on' : ''}" data-trig="auto">${ic('play')} ${tr('Automatically')}</button><button class="${a.trigger === 'click' ? 'on' : ''}" data-trig="click">${ic('mouse-pointer-click')} ${tr('On click')}</button></div>
      <p class="hint">${tr(a.trigger === 'click' ? 'In Present mode, it appears at your next click or arrow key.' : 'It plays as soon as the slide appears.')}</p>
      ${sec(tr('Exit animation'))}<select class="an-select" id="anOut"><option value="">${tr('None')}</option>${Object.entries(EFFECTS).filter(([, e]) => !e.block && !e.text && !e.img).map(([k, e]) => `<option value="${k}" ${a.out === k ? 'selected' : ''}>${tr(e.n)}</option>`).join('')}</select>
      <p class="hint">${tr('Plays when you leave the slide.')}</p>`;
  }
  body.insertAdjacentHTML('beforeend', sec(tr('Loop effect')) + `<div class="an-grid">
      <button class="an-tile ${!a.loop ? 'on' : ''}" data-loop=""><span class="an-demo none">${ic('ban')}</span><small>${tr('None')}</small></button>
      ${Object.entries(LOOPS).map(([k, e]) => tile(k, e, a.loop === k, 'loop')).join('')}</div>
    <div class="an-actions"><button class="btn primary" id="anPreview">${ic('play')} ${tr('Preview')}</button>${hasAnim(el) ? `<button class="btn ghost" id="anRemove">${ic('trash-2')} ${tr('Remove')}</button>` : ''}</div>`);

  const set = (patch) => {
    for (const e of els) {
      const cur = animOf(e) || { speed: 1, delay: 0, trigger: 'auto' };
      const next = { ...cur, ...patch };
      e.anim = next.in || next.out || next.loop ? next : null; delete e.animDelay;
    }
    commit(); emit('canvas');
  };
  body.querySelectorAll('[data-eff]').forEach((b) => (b.onclick = () => { set({ in: b.dataset.eff || null, dir: null, by: null }); if (b.dataset.eff) setTimeout(() => preview(els), 60); }));
  body.querySelectorAll('[data-loop]').forEach((b) => (b.onclick = () => set({ loop: b.dataset.loop || null })));
  body.querySelectorAll('[data-dir]').forEach((b) => (b.onclick = () => { set({ dir: b.dataset.dir }); setTimeout(() => preview(els), 60); }));
  body.querySelectorAll('[data-by]').forEach((b) => (b.onclick = () => { set({ by: b.dataset.by }); setTimeout(() => preview(els), 60); }));
  body.querySelectorAll('[data-trig]').forEach((b) => (b.onclick = () => set({ trigger: b.dataset.trig })));
  const sp = body.querySelector('#anSpeed'); if (sp) { sp.oninput = () => (sp.nextElementSibling.textContent = '×' + (+sp.value).toFixed(1)); sp.onchange = () => set({ speed: +sp.value }); }
  const dl = body.querySelector('#anDelay'); if (dl) { dl.oninput = () => (dl.nextElementSibling.textContent = (+dl.value).toFixed(1) + ' s'); dl.onchange = () => set({ delay: +dl.value }); }
  const out = body.querySelector('#anOut'); if (out) out.onchange = () => set({ out: out.value || null });
  body.querySelector('#anPreview').onclick = () => preview(els);
  const rm = body.querySelector('#anRemove'); if (rm) rm.onclick = () => { els.forEach((e) => { e.anim = null; delete e.animDelay; }); commit(); emit('canvas'); toast('Animation removed'); };
}

// ---------- the whole slide ----------
function pagePanel(body) {
  const slide = curSlide(), t = slideTransition(slide) || {};
  const pageEff = slide.elements.length && slide.elements.every((e) => animOf(e)?.in === animOf(slide.elements[0])?.in) ? animOf(slide.elements[0])?.in : null;
  const ttile = (k, e) => `<button class="an-tile ${t.type === k ? 'on' : ''}" data-tr="${k}"><span class="an-demo tr tr-${k}">${ic({ fade: 'blend', slide: 'move-right', push: 'chevrons-right', wipe: 'panel-left-open', circle: 'circle-dashed', colorWipe: 'paintbrush', stack: 'layers', zoom: 'zoom-in', flip: 'flip-horizontal-2', morph: 'wand-sparkles' }[k])}</span><small>${tr(e.n)}</small></button>`;
  body.insertAdjacentHTML('beforeend', `
    <div class="an-head">${ic('layout-template')}<div><b>${tr('Page animation')}</b><small>${tr('Animates every element of this slide, one after another')}</small></div></div>
    <div class="an-grid">
      <button class="an-tile ${!pageEff ? 'on' : ''}" data-page=""><span class="an-demo none">${ic('ban')}</span><small>${tr('None')}</small></button>
      ${['rise', 'pan', 'fade', 'pop', 'wipe', 'blur', 'breathe', 'baseline', 'drift', 'tectonic', 'tumble', 'neon', 'scrapbook', 'stomp', 'clarify', 'bounce'].map((k) => `<button class="an-tile ${pageEff === k ? 'on' : ''}" data-page="${k}" data-demo="${k}"><span class="an-demo">Aa</span><small>${tr(EFFECTS[k].n)}</small></button>`).join('')}
    </div>
    ${sec(tr('Transition to this slide'))}
    <div class="an-grid">
      <button class="an-tile ${!t.type ? 'on' : ''}" data-tr=""><span class="an-demo none">${ic('ban')}</span><small>${tr('None')}</small></button>
      ${Object.entries(TRANSITIONS).map(([k, e]) => ttile(k, e)).join('')}
    </div>
    ${t.type === 'morph' ? `<div class="online-box">${ic('wand-sparkles')} <b>${tr('Match & move')}</b> — ${tr('Duplicate this slide, then move, resize or recolour things on the copy: in Present mode they glide from one place to the other.')}</div>` : ''}
    ${t.type && TRANSITIONS[t.type]?.dirs ? sec(tr('Direction')) + `<div class="chips">${DIRS.map(([d, i]) => `<button class="chip icon ${(t.dir || TRANSITIONS[t.type].dirs) === d ? 'on' : ''}" data-tdir="${d}">${ic(i)}</button>`).join('')}</div>` : ''}
    ${t.type ? `<div class="range-row"><label>${tr('Duration')}</label><input type="range" id="trDur" min="0.3" max="2.5" step="0.1" value="${t.dur || TRANSITIONS[t.type].dur}"><span class="v">${(t.dur || TRANSITIONS[t.type].dur).toFixed(1)} s</span></div>` : ''}
    <div class="toggle-row"><span>${tr('Apply to all slides')}</span><button class="switch" id="anAll"></button></div>
    <div class="an-actions"><button class="btn primary" id="anPreviewSlide">${ic('play')} ${tr('Preview this slide')}</button></div>
    <p class="hint">${tr('Tip: select an element to give it its own animation, exit or loop.')}</p>`);
  const all = () => body.querySelector('#anAll').classList.contains('on');
  body.querySelector('#anAll').onclick = (e) => e.currentTarget.classList.toggle('on');
  const slides = () => (all() ? state.doc.slides : [curSlide()]);
  body.querySelectorAll('[data-page]').forEach((b) => (b.onclick = () => {
    const k = b.dataset.page;
    for (const s of slides()) s.elements.forEach((e, i) => { e.anim = k ? { in: k, delay: Math.round(i * 0.15 * 10) / 10, speed: 1, trigger: 'auto' } : null; delete e.animDelay; });
    commit(); emit('canvas'); if (k) setTimeout(() => preview(curSlide().elements), 60);
  }));
  body.querySelectorAll('[data-tr]').forEach((b) => (b.onclick = () => {
    const k = b.dataset.tr;
    for (const s of slides()) s.transition = k ? { type: k, dur: TRANSITIONS[k].dur } : null;
    commit(); emit('canvas');
    if (k === 'morph' && curSlide().elements.length) toast('Now duplicate the slide and move things on the copy');
  }));
  body.querySelectorAll('[data-tdir]').forEach((b) => (b.onclick = () => { for (const s of slides()) if (s.transition) s.transition = { ...slideTransition(s), dir: b.dataset.tdir }; commit(); emit('canvas'); }));
  const d = body.querySelector('#trDur'); if (d) { d.oninput = () => (d.nextElementSibling.textContent = (+d.value).toFixed(1) + ' s'); d.onchange = () => { for (const s of slides()) if (s.transition) s.transition = { ...slideTransition(s), dur: +d.value }; commit(); }; }
  body.querySelector('#anPreviewSlide').onclick = () => {
    const { auto, clicks } = stepsOf(curSlide());
    preview([...auto, ...clicks.flat()]);
  };
}

// ---------- preview on the canvas ----------
let resetT;
export function preview(els) {
  const stage = document.querySelector('#stage'); if (!stage) return;
  clearTimeout(resetT);
  document.querySelector('#overlay').style.visibility = 'hidden';
  let end = 0;
  for (const el of els) {
    const n = stage.querySelector(`[data-id="${el.id}"]`); if (!n) continue;
    n.querySelector(':scope > .inner')?.getAnimations({ subtree: true }).forEach((x) => x.cancel());
    const t = playIn(n, el);
    startLoop(n, el, t);
    end = Math.max(end, t);
  }
  // show the exit too, after a short pause, then put everything back
  const outs = els.filter((e) => animOf(e)?.out);
  if (outs.length) setTimeout(() => outs.forEach((el) => { const n = stage.querySelector(`[data-id="${el.id}"]`); if (n) playOut(n, el); }), end + 500);
  resetT = setTimeout(() => { document.querySelector('#overlay').style.visibility = ''; emit('canvas'); }, end + (outs.length ? 1700 : 900) + (els.some((e) => animOf(e)?.loop) ? 2400 : 0));
}
