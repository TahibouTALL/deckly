// The shape library: 170+ shapes drawn in a 100 x 100 box (they stretch with the element), grouped by category,
// with the area where text sits inside each one. Lines live in elements/line.js.
//   d:    an SVG path          pts: a polygon point list        css: a plain box (rect / rounded / circle)
//   t:    [x, y, w, h] of the text area (percent)               stroke: drawn as an outline only (brackets…)
//   ratio: keep the proportions when added
const f2 = (v) => +v.toFixed(2);
const pt = (x, y) => `${f2(x)},${f2(y)}`;
const rad = (deg) => (deg * Math.PI) / 180;
export const polyPts = (n, r = 50, rot = -90, cx = 50, cy = 50) =>
  Array.from({ length: n }, (_, i) => pt(cx + r * Math.cos(rad(rot + (360 / n) * i)), cy + r * Math.sin(rad(rot + (360 / n) * i)))).join(' ');
export const starPts = (n, ro = 50, ri = 22, rot = -90) =>
  Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? ri : ro; const a = rad(rot + (180 / n) * i); return pt(50 + r * Math.cos(a), 50 + r * Math.sin(a)); }).join(' ');
// scalloped circle (a seal): n bumps of the given depth
const sealPts = (n, depth = 7) => {
  const k = n * 10, out = [];
  for (let i = 0; i < k; i++) { const th = (i / k) * Math.PI * 2; const r = 50 - depth * (0.5 - 0.5 * Math.cos(n * th)); out.push(pt(50 + r * Math.cos(th), 50 + r * Math.sin(th))); }
  return out.join(' ');
};
// a cog with flat teeth
const gearPts = (teeth = 8, ro = 50, ri = 39) => {
  const out = []; const w = 360 / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = -90 + i * w;
    for (const [da, r] of [[-w * 0.5, ri], [-w * 0.22, ri], [-w * 0.16, ro], [w * 0.16, ro], [w * 0.22, ri]]) out.push(pt(50 + r * Math.cos(rad(a + da)), 50 + r * Math.sin(rad(a + da))));
  }
  return out.join(' ');
};
// pie slice / ring segment from a0 to a1 degrees (clockwise from 12 o'clock)
const arcPath = (a0, a1, ro = 50, ri = 0) => {
  const p = (a, r) => `${f2(50 + r * Math.sin(rad(a)))} ${f2(50 - r * Math.cos(rad(a)))}`;
  const big = a1 - a0 > 180 ? 1 : 0;
  if (!ri) return `M50 50 L${p(a0, ro)} A${ro} ${ro} 0 ${big} 1 ${p(a1, ro)} Z`;
  return `M${p(a0, ro)} A${ro} ${ro} 0 ${big} 1 ${p(a1, ro)} L${p(a1, ri)} A${ri} ${ri} 0 ${big} 0 ${p(a0, ri)} Z`;
};
const rotPts = (pts, deg, cx = 50, cy = 50) => pts.split(' ').map((p) => { const [x, y] = p.split(',').map(Number); const a = rad(deg); return pt(cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)); }).join(' ');
const flipX = (pts) => pts.split(' ').map((p) => { const [x, y] = p.split(',').map(Number); return pt(100 - x, y); }).join(' ');
const flipY = (pts) => pts.split(' ').map((p) => { const [x, y] = p.split(',').map(Number); return pt(x, 100 - y); }).join(' ');
const ARROW_R = '2,34 60,34 60,10 98,50 60,90 60,66 2,66';
const CHEVRON = '2,2 70,2 98,50 70,98 2,98 30,50';
const PENT = '2,2 75,2 98,50 75,98 2,98';

const S = {}; // id -> shape
const add = (cat, id, name, def) => { S[id] = { cat, name, ...def }; };
const sq = [10, 10, 80, 80];

// ---------- basic ----------
add('basic', 'rect', 'Square', { css: true, t: sq });
add('basic', 'rounded', 'Rounded square', { css: true, radius: 18, t: sq });
add('basic', 'circle', 'Circle', { css: true, circle: true, t: [15, 15, 70, 70] });
add('basic', 'pill', 'Pill', { d: 'M30 10 H70 A40 40 0 0 1 70 90 H30 A40 40 0 0 1 30 10 Z', t: [18, 20, 64, 60] });
add('basic', 'triangle', 'Triangle', { d: 'M50 2 L98 98 L2 98 Z', t: [28, 48, 44, 44] });
add('basic', 'triangleDown', 'Triangle down', { d: 'M2 2 L98 2 L50 98 Z', t: [28, 8, 44, 44] });
add('basic', 'rtriangle', 'Right triangle', { d: 'M2 2 L98 98 L2 98 Z', t: [8, 50, 42, 42] });
add('basic', 'diamond', 'Diamond', { d: 'M50 1 L99 50 L50 99 L1 50 Z', t: [22, 22, 56, 56] });
add('basic', 'pentagon', 'Pentagon', { pts: polyPts(5), t: [20, 25, 60, 55] });
add('basic', 'hexagon', 'Hexagon', { pts: polyPts(6, 50, 0), t: [14, 18, 72, 64] });
add('basic', 'hexagonTall', 'Tall hexagon', { pts: polyPts(6), t: [18, 14, 64, 72] });
add('basic', 'heptagon', 'Heptagon', { pts: polyPts(7), t: [18, 18, 64, 64] });
add('basic', 'octagon', 'Octagon', { pts: polyPts(8, 50, 22.5), t: [15, 15, 70, 70] });
add('basic', 'decagon', 'Decagon', { pts: polyPts(10), t: [15, 15, 70, 70] });
add('basic', 'dodecagon', 'Dodecagon', { pts: polyPts(12), t: [15, 15, 70, 70] });
add('basic', 'parallelogram', 'Parallelogram', { d: 'M25 2 L98 2 L75 98 L2 98 Z', t: [24, 15, 52, 70] });
add('basic', 'parallelogramL', 'Parallelogram left', { d: 'M2 2 L75 2 L98 98 L25 98 Z', t: [24, 15, 52, 70] });
add('basic', 'trapezoid', 'Trapezoid', { d: 'M22 2 L78 2 L98 98 L2 98 Z', t: [18, 15, 64, 70] });
add('basic', 'trapezoidDown', 'Trapezoid down', { d: 'M2 2 L98 2 L78 98 L22 98 Z', t: [18, 15, 64, 70] });
add('basic', 'kite', 'Kite', { d: 'M50 1 L92 38 L50 99 L8 38 Z', t: [25, 25, 50, 45] });
add('basic', 'rhombus', 'Rhombus', { d: 'M35 2 L98 2 L65 98 L2 98 Z', t: [28, 20, 44, 60] });
add('basic', 'cross', 'Cross', { d: 'M36 2 H64 V36 H98 V64 H64 V98 H36 V64 H2 V36 H36 Z', t: [36, 36, 28, 28] });
add('basic', 'crossRounded', 'Rounded cross', { d: 'M38 4 H62 Q68 4 68 10 V32 H90 Q96 32 96 38 V62 Q96 68 90 68 H68 V90 Q68 96 62 96 H38 Q32 96 32 90 V68 H10 Q4 68 4 62 V38 Q4 32 10 32 H32 V10 Q32 4 38 4 Z', t: [34, 34, 32, 32] });
add('basic', 'squircle', 'Squircle', { d: 'M50 2 C84 2 98 16 98 50 C98 84 84 98 50 98 C16 98 2 84 2 50 C2 16 16 2 50 2 Z', t: [12, 12, 76, 76] });
// ---------- rounded corners ----------
add('rounded', 'roundTop', 'Rounded top', { d: 'M2 98 V26 Q2 2 26 2 H74 Q98 2 98 26 V98 Z', t: sq });
add('rounded', 'roundBottom', 'Rounded bottom', { d: 'M2 2 H98 V74 Q98 98 74 98 H26 Q2 98 2 74 Z', t: sq });
add('rounded', 'roundLeft', 'Rounded left', { d: 'M26 2 H98 V98 H26 Q2 98 2 74 V26 Q2 2 26 2 Z', t: sq });
add('rounded', 'roundRight', 'Rounded right', { d: 'M2 2 H74 Q98 2 98 26 V74 Q98 98 74 98 H2 Z', t: sq });
add('rounded', 'leaf', 'Leaf', { d: 'M2 98 V50 C2 20 20 2 50 2 H98 V50 C98 80 80 98 50 98 Z', t: [12, 14, 76, 72] });
add('rounded', 'leaf2', 'Leaf mirrored', { d: 'M2 2 H50 C80 2 98 20 98 50 V98 H50 C20 98 2 80 2 50 Z', t: [12, 14, 76, 72] });
add('rounded', 'roundOne', 'One rounded corner', { d: 'M2 2 H62 Q98 2 98 38 V98 H2 Z', t: sq });
add('rounded', 'arch', 'Arch', { d: 'M2 98 V50 A48 48 0 0 1 98 50 V98 Z', t: [14, 30, 72, 60] });
add('rounded', 'archDown', 'Arch down', { d: 'M2 2 H98 V50 A48 48 0 0 1 2 50 Z', t: [14, 10, 72, 60] });
add('rounded', 'tombstone', 'Tombstone', { d: 'M2 98 V40 A48 40 0 0 1 98 40 V98 Z', t: [14, 28, 72, 62] });
// ---------- stars & bursts ----------
add('stars', 'star4', 'Sparkle', { d: 'M50 0 C54 38 62 46 100 50 C62 54 54 62 50 100 C46 62 38 54 0 50 C38 46 46 38 50 0 Z', t: [34, 34, 32, 32] });
add('stars', 'star4b', '4-point star', { pts: starPts(4, 50, 18), t: [34, 34, 32, 32] });
add('stars', 'star5', 'Star', { pts: starPts(5, 50, 21), t: [30, 36, 40, 32] });
add('stars', 'star6', '6-point star', { pts: starPts(6, 50, 29), t: [30, 30, 40, 40] });
add('stars', 'star7', '7-point star', { pts: starPts(7, 50, 32), t: [28, 28, 44, 44] });
add('stars', 'star8', '8-point star', { pts: starPts(8, 50, 34), t: [27, 27, 46, 46] });
add('stars', 'star10', '10-point star', { pts: starPts(10, 50, 38), t: [25, 25, 50, 50] });
add('stars', 'star12', '12-point star', { pts: starPts(12, 50, 40), t: [25, 25, 50, 50] });
add('stars', 'burst', 'Burst', { pts: starPts(16, 50, 38), t: [24, 24, 52, 52] });
add('stars', 'burst24', 'Big burst', { pts: starPts(24, 50, 42), t: [22, 22, 56, 56] });
add('stars', 'burst32', 'Burst 32', { pts: starPts(32, 50, 43), t: [22, 22, 56, 56] });
add('stars', 'sparkleThin', 'Thin sparkle', { d: 'M50 0 C52 44 56 48 100 50 C56 52 52 56 50 100 C48 56 44 52 0 50 C44 48 48 44 50 0 Z', t: [40, 40, 20, 20] });
add('stars', 'seal', 'Seal', { pts: sealPts(12, 7), t: [22, 22, 56, 56] });
add('stars', 'seal16', 'Seal 16', { pts: sealPts(16, 5), t: [22, 22, 56, 56] });
add('stars', 'seal20', 'Scalloped circle', { pts: sealPts(20, 4), t: [20, 20, 60, 60] });
add('stars', 'seal8', 'Flower seal', { pts: sealPts(8, 10), t: [22, 22, 56, 56] });
// ---------- arrows ----------
add('arrows', 'arrowR', 'Arrow', { pts: ARROW_R, t: [6, 36, 54, 28] });
add('arrows', 'arrowL', 'Arrow left', { pts: flipX(ARROW_R), t: [40, 36, 54, 28] });
add('arrows', 'arrowU', 'Arrow up', { pts: rotPts(ARROW_R, -90), t: [36, 40, 28, 54] });
add('arrows', 'arrowD', 'Arrow down', { pts: rotPts(ARROW_R, 90), t: [36, 6, 28, 54] });
add('arrows', 'arrowLR', 'Double arrow', { pts: '2,50 30,16 30,36 70,36 70,16 98,50 70,84 70,64 30,64 30,84', t: [30, 38, 40, 24] });
add('arrows', 'arrowUD', 'Double arrow vertical', { pts: rotPts('2,50 30,16 30,36 70,36 70,16 98,50 70,84 70,64 30,64 30,84', 90), t: [38, 30, 24, 40] });
add('arrows', 'arrowQuad', 'Four-way arrow', { d: 'M50 2 L68 22 H58 V42 H78 V32 L98 50 L78 68 V58 H58 V78 H68 L50 98 L32 78 H42 V58 H22 V68 L2 50 L22 32 V42 H42 V22 H32 Z', t: [38, 38, 24, 24] });
add('arrows', 'arrowThin', 'Thin arrow', { pts: '2,42 66,42 66,24 98,50 66,76 66,58 2,58', t: [6, 44, 56, 12] });
add('arrows', 'arrowWide', 'Wide arrow', { pts: '2,20 55,20 55,2 98,50 55,98 55,80 2,80', t: [6, 26, 48, 48] });
add('arrows', 'chevron', 'Chevron', { pts: CHEVRON, t: [30, 20, 42, 60] });
add('arrows', 'chevronL', 'Chevron left', { pts: flipX(CHEVRON), t: [28, 20, 42, 60] });
add('arrows', 'chevronD', 'Chevron down', { pts: rotPts(CHEVRON, 90), t: [20, 28, 60, 42] });
add('arrows', 'pentArrow', 'Tag arrow', { pts: PENT, t: [8, 15, 64, 70] });
add('arrows', 'pentArrowL', 'Tag arrow left', { pts: flipX(PENT), t: [28, 15, 64, 70] });
add('arrows', 'notchedArrow', 'Notched arrow', { pts: '2,30 60,30 60,10 98,50 60,90 60,70 2,70 18,50', t: [20, 36, 40, 28] });
add('arrows', 'bentArrow', 'Bent arrow', { d: 'M2 98 V40 Q2 14 28 14 H62 V2 L98 28 L62 54 V42 H34 Q30 42 30 46 V98 Z', t: [34, 56, 30, 36] });
add('arrows', 'bentArrowL', 'Bent arrow left', { d: 'M98 98 V40 Q98 14 72 14 H38 V2 L2 28 L38 54 V42 H66 Q70 42 70 46 V98 Z', t: [36, 56, 30, 36] });
add('arrows', 'uTurn', 'U-turn arrow', { d: 'M8 98 V40 A32 32 0 0 1 72 40 V56 H88 L66 82 L44 56 H60 V40 A20 20 0 0 0 20 40 V98 Z', t: [20, 40, 30, 50] });
add('arrows', 'curvedR', 'Curved arrow', { d: 'M8 92 C8 40 30 14 70 14 V2 L98 24 L70 46 V34 C44 34 24 54 24 92 Z', t: [30, 50, 36, 30] });
add('arrows', 'curvedL', 'Curved arrow left', { d: 'M92 92 C92 40 70 14 30 14 V2 L2 24 L30 46 V34 C56 34 76 54 76 92 Z', t: [34, 50, 36, 30] });
add('arrows', 'circularArrow', 'Circular arrow', { d: 'M50 6 A44 44 0 1 1 10 56 H24 A30 30 0 1 0 50 20 V34 L22 18 L50 2 Z', t: [30, 30, 40, 40] });
add('arrows', 'stripedArrow', 'Striped arrow', { d: 'M2 34 H10 V66 H2 Z M16 34 H24 V66 H16 Z M30 34 H60 V10 L98 50 L60 90 V66 H30 Z', t: [32, 38, 30, 24] });
add('arrows', 'arrowCallout', 'Callout arrow', { d: 'M2 2 H60 V40 H74 V26 L98 50 L74 74 V60 H60 V98 H2 Z', t: [8, 8, 46, 84] });
add('arrows', 'triangleArrow', 'Triangle arrow', { d: 'M2 10 L98 50 L2 90 Z', t: [8, 36, 44, 28] });
add('arrows', 'chevronBand', 'Chevron band', { pts: '2,2 78,2 98,50 78,98 2,98 22,50', t: [24, 22, 50, 56] });
add('arrows', 'doubleChevron', 'Double chevron', { d: 'M2 2 H30 L58 50 L30 98 H2 L30 50 Z M42 2 H70 L98 50 L70 98 H42 L70 50 Z', t: [30, 30, 40, 40] });
// ---------- callouts ----------
add('callouts', 'bubble', 'Speech bubble', { d: 'M12 4 H88 Q98 4 98 14 V62 Q98 72 88 72 H40 L18 96 L22 72 H12 Q2 72 2 62 V14 Q2 4 12 4 Z', t: [10, 10, 80, 54] });
add('callouts', 'bubbleR', 'Speech bubble right', { d: 'M12 4 H88 Q98 4 98 14 V62 Q98 72 88 72 H78 L82 96 L60 72 H12 Q2 72 2 62 V14 Q2 4 12 4 Z', t: [10, 10, 80, 54] });
add('callouts', 'bubbleTop', 'Speech bubble top', { d: 'M12 28 H60 L82 4 L78 28 H88 Q98 28 98 38 V86 Q98 96 88 96 H12 Q2 96 2 86 V38 Q2 28 12 28 Z', t: [10, 34, 80, 54] });
add('callouts', 'bubbleRound', 'Round bubble', { d: 'M50 4 C78 4 98 20 98 40 C98 60 78 76 50 76 C44 76 38 75 33 74 L12 92 L20 68 C9 61 2 51 2 40 C2 20 22 4 50 4 Z', t: [16, 16, 68, 46] });
add('callouts', 'bubbleOval', 'Oval bubble', { d: 'M50 2 A48 36 0 1 1 30 70 L14 96 L26 66 A48 36 0 0 1 50 2 Z', t: [16, 14, 68, 42] });
add('callouts', 'cloudy', 'Thought cloud', { d: 'M27 80 C10 80 2 68 6 56 C-2 46 6 30 20 32 C22 14 42 8 54 18 C64 6 86 10 88 28 C100 32 102 52 90 58 C96 72 82 84 68 78 C60 90 38 92 27 80 Z', t: [18, 26, 64, 46] });
add('callouts', 'thought', 'Thought bubble', { d: 'M50 2 A44 32 0 1 1 49 66 A44 32 0 0 1 50 2 Z M28 76 A7 6 0 1 0 28.01 76 Z M14 90 A5 4 0 1 0 14.01 90 Z', t: [16, 12, 68, 42] });
add('callouts', 'bubbleSquare', 'Square bubble', { d: 'M2 2 H98 V70 H34 L18 96 L20 70 H2 Z', t: [8, 8, 84, 54] });
add('callouts', 'bubbleLeft', 'Speech bubble left', { d: 'M24 4 H88 Q98 4 98 14 V82 Q98 92 88 92 H24 Q14 92 14 82 V58 L2 50 L14 42 V14 Q14 4 24 4 Z', t: [20, 10, 72, 76] });
// ---------- banners & ribbons ----------
add('banners', 'ribbon', 'Ribbon', { d: 'M2 22 H98 L86 50 L98 78 H2 L14 50 Z', t: [16, 32, 68, 36] });
add('banners', 'ribbonFold', 'Folded ribbon', { d: 'M14 30 H86 V70 H14 Z M2 22 H14 V78 H2 L10 50 Z M86 22 H98 L90 50 L98 78 H86 Z', t: [18, 36, 64, 28] });
add('banners', 'ribbonCurved', 'Curved ribbon', { d: 'M2 30 Q50 44 98 30 V70 Q50 84 2 70 Z', t: [10, 40, 80, 24] });
add('banners', 'ribbonWave', 'Wavy ribbon', { d: 'M2 40 Q26 22 50 40 T98 40 V68 Q74 86 50 68 T2 68 Z', t: [10, 44, 80, 20] });
add('banners', 'pennant', 'Pennant', { d: 'M2 2 H98 L74 50 L98 98 H2 Z', t: [8, 20, 60, 60] });
add('banners', 'pennantTail', 'Flag', { d: 'M2 2 H98 V98 H2 L30 50 Z', t: [34, 20, 60, 60] });
add('banners', 'bannerDown', 'Hanging banner', { d: 'M2 2 H98 V78 L50 98 L2 78 Z', t: [10, 10, 80, 60] });
add('banners', 'bannerNotch', 'Notched banner', { d: 'M2 2 H98 V98 L50 80 L2 98 Z', t: [10, 10, 80, 60] });
add('banners', 'tag', 'Tag', { d: 'M2 36 L30 8 H98 V92 H30 L2 64 Z M22 50 A6 6 0 1 0 22.01 50 Z', t: [34, 20, 58, 60] });
add('banners', 'label', 'Label', { d: 'M2 10 H80 L98 50 L80 90 H2 Z', t: [8, 20, 68, 60] });
add('banners', 'ticket', 'Ticket', { d: 'M2 12 Q2 4 10 4 H90 Q98 4 98 12 V42 A8 8 0 0 0 98 58 V88 Q98 96 90 96 H10 Q2 96 2 88 V58 A8 8 0 0 0 2 42 Z', t: [12, 16, 76, 68] });
add('banners', 'ticketStub', 'Ticket stub', { d: 'M2 10 H98 V90 H2 Z M70 10 A4 4 0 0 0 70 18 M70 26 A4 4 0 0 0 70 34 M70 42 A4 4 0 0 0 70 50 M70 58 A4 4 0 0 0 70 66 M70 74 A4 4 0 0 0 70 82', t: [8, 20, 56, 60], evenodd: true });
add('banners', 'bookmark', 'Bookmark', { d: 'M12 2 H88 V98 L50 72 L12 98 Z', t: [20, 10, 60, 50] });
add('banners', 'awardRibbon', 'Award ribbon', { d: 'M50 2 L60 10 L72 7 L76 19 L88 24 L85 36 L94 46 L85 56 L88 68 L76 73 L72 85 L60 82 L50 90 L40 82 L28 85 L24 73 L12 68 L15 56 L6 46 L15 36 L12 24 L24 19 L28 7 L40 10 Z', t: [28, 26, 44, 40] });
add('banners', 'certificate', 'Certificate', { d: 'M8 2 H92 L98 8 V92 L92 98 H8 L2 92 V8 Z M14 14 H86 V86 H14 Z', evenodd: true, t: [18, 18, 64, 64] });
// ---------- flowchart ----------
add('flowchart', 'process', 'Process', { css: true, t: sq });
add('flowchart', 'decision', 'Decision', { d: 'M50 2 L98 50 L50 98 L2 50 Z', t: [24, 30, 52, 40] });
add('flowchart', 'terminator', 'Start / end', { d: 'M25 18 H75 A32 32 0 0 1 75 82 H25 A32 32 0 0 1 25 18 Z', t: [18, 30, 64, 40] });
add('flowchart', 'data', 'Data', { d: 'M22 10 H98 L78 90 H2 Z', t: [22, 20, 56, 60] });
add('flowchart', 'document', 'Document', { d: 'M2 2 H98 V80 C74 66 50 96 26 86 C18 82 10 84 2 90 Z', t: [10, 10, 80, 60] });
add('flowchart', 'multidoc', 'Multiple documents', { d: 'M14 14 H98 V70 C74 58 50 86 26 76 C22 74 18 74 14 76 Z M8 8 H92 V14 H14 V76 H8 Z M2 2 H86 V8 H8 V70 H2 Z', t: [20, 20, 70, 44] });
add('flowchart', 'database', 'Database', { d: 'M2 16 A48 12 0 0 1 98 16 V84 A48 12 0 0 1 2 84 Z M2 16 A48 12 0 0 0 98 16', t: [12, 30, 76, 50] });
add('flowchart', 'manualInput', 'Manual input', { d: 'M2 30 L98 8 V98 H2 Z', t: [10, 36, 80, 54] });
add('flowchart', 'preparation', 'Preparation', { d: 'M20 2 H80 L98 50 L80 98 H20 L2 50 Z', t: [18, 15, 64, 70] });
add('flowchart', 'delay', 'Delay', { d: 'M2 2 H60 A48 48 0 0 1 60 98 H2 Z', t: [8, 20, 60, 60] });
add('flowchart', 'display', 'Display', { d: 'M20 2 H78 A20 48 0 0 1 78 98 H20 L2 50 Z', t: [20, 20, 56, 60] });
add('flowchart', 'storedData', 'Stored data', { d: 'M20 2 H98 A20 48 0 0 0 98 98 H20 A20 48 0 0 1 20 2 Z', t: [20, 20, 56, 60] });
add('flowchart', 'offPage', 'Off-page connector', { d: 'M2 2 H98 V70 L50 98 L2 70 Z', t: [10, 10, 80, 56] });
add('flowchart', 'connector', 'Connector', { css: true, circle: true, t: [15, 15, 70, 70] });
add('flowchart', 'card', 'Card', { d: 'M22 2 H98 V98 H2 V22 Z', t: [10, 25, 80, 60] });
add('flowchart', 'merge', 'Merge', { d: 'M2 2 H98 L50 98 Z', t: [28, 8, 44, 44] });
add('flowchart', 'orGate', 'Or', { d: 'M50 2 A48 48 0 1 0 50.01 2 Z M48 2 H52 V98 H48 Z M2 48 H98 V52 H2 Z', evenodd: true, t: [20, 20, 60, 60] });
add('flowchart', 'summing', 'Summing junction', { d: 'M50 2 A48 48 0 1 0 50.01 2 Z M14 16 L84 84 L80 88 L10 20 Z M86 16 L16 84 L20 88 L90 20 Z', evenodd: true, t: [20, 20, 60, 60] });
add('flowchart', 'punchedTape', 'Punched tape', { d: 'M2 18 Q26 2 50 18 T98 18 V82 Q74 98 50 82 T2 82 Z', t: [10, 26, 80, 48] });
add('flowchart', 'sequential', 'Sequential access', { d: 'M50 2 A48 48 0 1 0 84 84 H98 V98 H50 A48 48 0 0 0 50 2 Z', t: [20, 20, 56, 56] });
// ---------- badges & shields ----------
add('badges', 'shield', 'Shield', { d: 'M50 2 L96 16 V46 C96 72 76 90 50 98 C24 90 4 72 4 46 V16 Z', t: [18, 20, 64, 50] });
add('badges', 'shield2', 'Pointed shield', { d: 'M4 4 H96 V58 L50 98 L4 58 Z', t: [14, 14, 72, 48] });
add('badges', 'hexBadge', 'Hexagon badge', { pts: polyPts(6, 50, -90), t: [18, 20, 64, 60] });
add('badges', 'rosette', 'Rosette', { d: 'M50 2 L58 12 L70 6 L74 18 L87 17 L86 30 L98 36 L92 47 L100 58 L89 64 L90 77 L77 78 L73 91 L61 86 L50 96 L39 86 L27 91 L23 78 L10 77 L11 64 L0 58 L8 47 L2 36 L14 30 L13 17 L26 18 L30 6 L42 12 Z', t: [28, 28, 44, 44] });
add('badges', 'medal', 'Medal', { d: 'M30 2 H70 L60 36 H40 Z M50 30 A32 32 0 1 0 50.01 30 Z', t: [28, 44, 44, 44] });
add('badges', 'crest', 'Crest', { d: 'M10 2 H90 V40 C90 70 70 90 50 98 C30 90 10 70 10 40 Z', t: [20, 16, 60, 50] });
add('badges', 'policeBadge', 'Badge', { d: 'M50 2 L64 14 L82 10 L86 28 L98 40 L88 56 L92 74 L74 80 L64 96 L50 88 L36 96 L26 80 L8 74 L12 56 L2 40 L14 28 L18 10 L36 14 Z', t: [28, 28, 44, 44] });
add('badges', 'bevel', 'Bevel', { d: 'M2 2 H98 V98 H2 Z M16 16 H84 V84 H16 Z', evenodd: true, t: [20, 20, 60, 60] });
add('badges', 'frame', 'Hollow square', { d: 'M2 2 H98 V98 H2 Z M14 14 V86 H86 V14 Z', evenodd: true, t: [20, 20, 60, 60] });
add('badges', 'frameRound', 'Hollow rounded square', { d: 'M18 2 H82 Q98 2 98 18 V82 Q98 98 82 98 H18 Q2 98 2 82 V18 Q2 2 18 2 Z M22 14 Q14 14 14 22 V78 Q14 86 22 86 H78 Q86 86 86 78 V22 Q86 14 78 14 Z', evenodd: true, t: [20, 20, 60, 60] });
add('badges', 'ring', 'Ring', { d: 'M50 2 A48 48 0 1 0 50.01 2 Z M50 26 A24 24 0 1 1 49.99 26 Z', evenodd: true, t: [30, 30, 40, 40] });
add('badges', 'ringThin', 'Thin ring', { d: 'M50 2 A48 48 0 1 0 50.01 2 Z M50 14 A36 36 0 1 1 49.99 14 Z', evenodd: true, t: [25, 25, 50, 50] });
// ---------- brackets (outlines) ----------
add('brackets', 'braceL', 'Left brace', { d: 'M70 2 C50 2 50 12 50 24 V40 C50 48 42 50 30 50 C42 50 50 52 50 60 V76 C50 88 50 98 70 98', stroke: true, t: [60, 10, 40, 80] });
add('brackets', 'braceR', 'Right brace', { d: 'M30 2 C50 2 50 12 50 24 V40 C50 48 58 50 70 50 C58 50 50 52 50 60 V76 C50 88 50 98 30 98', stroke: true, t: [0, 10, 40, 80] });
add('brackets', 'bracketL', 'Left bracket', { d: 'M70 2 H40 V98 H70', stroke: true, t: [50, 10, 50, 80] });
add('brackets', 'bracketR', 'Right bracket', { d: 'M30 2 H60 V98 H30', stroke: true, t: [0, 10, 50, 80] });
add('brackets', 'parenL', 'Left parenthesis', { d: 'M70 2 C30 30 30 70 70 98', stroke: true, t: [50, 10, 50, 80] });
add('brackets', 'parenR', 'Right parenthesis', { d: 'M30 2 C70 30 70 70 30 98', stroke: true, t: [0, 10, 50, 80] });
add('brackets', 'braceH', 'Horizontal brace', { d: 'M2 70 C2 50 12 50 24 50 H40 C48 50 50 42 50 30 C50 42 52 50 60 50 H76 C88 50 98 50 98 70', stroke: true, t: [10, 70, 80, 30] });
add('brackets', 'angleL', 'Angle left', { d: 'M70 2 L30 50 L70 98', stroke: true, t: [50, 10, 50, 80] });
add('brackets', 'angleR', 'Angle right', { d: 'M30 2 L70 50 L30 98', stroke: true, t: [0, 10, 50, 80] });
add('brackets', 'cornerTL', 'Corner', { d: 'M2 60 V2 H60', stroke: true, t: [20, 20, 70, 70] });
add('brackets', 'cornerBR', 'Corner bottom right', { d: 'M98 40 V98 H40', stroke: true, t: [10, 10, 70, 70] });
add('brackets', 'arcOutline', 'Arc', { d: 'M2 98 A48 48 0 0 1 98 98', stroke: true, t: [20, 50, 60, 40] });
add('brackets', 'circleOutline', 'Circle outline', { d: 'M50 2 A48 48 0 1 0 50.01 2 Z', stroke: true, t: [20, 20, 60, 60] });
add('brackets', 'squareOutline', 'Square outline', { d: 'M4 4 H96 V96 H4 Z', stroke: true, t: [15, 15, 70, 70] });
add('brackets', 'roundedOutline', 'Rounded outline', { d: 'M20 4 H80 Q96 4 96 20 V80 Q96 96 80 96 H20 Q4 96 4 80 V20 Q4 4 20 4 Z', stroke: true, t: [15, 15, 70, 70] });
add('brackets', 'triangleOutline', 'Triangle outline', { d: 'M50 6 L96 94 L4 94 Z', stroke: true, t: [28, 48, 44, 40] });
add('brackets', 'squiggle', 'Squiggle', { d: 'M2 50 C14 20 26 20 38 50 S62 80 74 50 S98 20 98 50', stroke: true, t: [10, 60, 80, 40] });
add('brackets', 'zigzag', 'Zigzag', { d: 'M2 70 L18 30 L34 70 L50 30 L66 70 L82 30 L98 70', stroke: true, t: [10, 70, 80, 30] });
add('brackets', 'underline', 'Underline stroke', { d: 'M2 50 C30 40 70 60 98 50', stroke: true, t: [10, 10, 80, 30] });
// ---------- math ----------
add('math', 'plus', 'Plus', { d: 'M38 2 H62 V38 H98 V62 H62 V98 H38 V62 H2 V38 H38 Z', t: [38, 38, 24, 24] });
add('math', 'minus', 'Minus', { d: 'M2 38 H98 V62 H2 Z', t: [10, 40, 80, 20] });
add('math', 'multiply', 'Multiply', { d: 'M20 2 L50 32 L80 2 L98 20 L68 50 L98 80 L80 98 L50 68 L20 98 L2 80 L32 50 L2 20 Z', t: [36, 36, 28, 28] });
add('math', 'divide', 'Divide', { d: 'M50 4 A12 12 0 1 0 50.01 4 Z M2 40 H98 V60 H2 Z M50 72 A12 12 0 1 0 50.01 72 Z', t: [10, 40, 80, 20] });
add('math', 'equal', 'Equal', { d: 'M2 22 H98 V42 H2 Z M2 58 H98 V78 H2 Z', t: [10, 42, 80, 16] });
add('math', 'notEqual', 'Not equal', { d: 'M2 22 H98 V42 H2 Z M2 58 H98 V78 H2 Z M60 2 L76 8 L40 98 L24 92 Z', t: [10, 42, 80, 16] });
add('math', 'percent', 'Percent', { d: 'M26 2 A20 20 0 1 0 26.01 2 Z M74 58 A20 20 0 1 0 74.01 58 Z M78 2 L92 12 L22 98 L8 88 Z', t: [30, 40, 40, 20] });
// ---------- blobs ----------
add('blobs', 'blob1', 'Blob', { d: 'M70 8 C88 16 98 36 94 56 C90 78 72 96 48 94 C24 92 6 76 4 52 C2 28 22 6 44 4 C54 3 62 4 70 8 Z', t: [18, 18, 64, 64] });
add('blobs', 'blob2', 'Pebble', { d: 'M60 4 C84 6 100 28 96 52 C92 74 80 98 52 96 C26 94 2 82 4 54 C6 26 30 2 60 4 Z', t: [18, 18, 64, 64] });
add('blobs', 'blob3', 'Blob 3', { d: 'M42 6 C64 2 88 10 94 30 C100 52 86 70 76 84 C64 100 36 100 22 84 C4 64 2 40 14 22 C20 12 30 8 42 6 Z', t: [20, 18, 60, 62] });
add('blobs', 'blob4', 'Blob 4', { d: 'M56 2 C78 2 98 18 98 42 C98 62 86 70 80 82 C72 98 50 100 34 92 C12 82 0 62 4 40 C8 18 34 2 56 2 Z', t: [18, 18, 62, 62] });
add('blobs', 'blob5', 'Blob 5', { d: 'M48 2 C70 0 96 12 98 36 C100 58 84 64 82 80 C80 96 60 100 42 96 C22 92 2 80 2 58 C2 34 24 4 48 2 Z', t: [18, 20, 62, 60] });
add('blobs', 'blob6', 'Blob 6', { d: 'M30 10 C48 -4 76 2 90 20 C104 40 96 66 82 82 C68 98 40 102 22 88 C4 74 -2 50 8 30 C12 20 20 16 30 10 Z', t: [20, 20, 60, 60] });
add('blobs', 'blob7', 'Blob 7', { d: 'M62 4 C82 8 96 26 96 48 C96 70 84 92 62 96 C42 100 18 90 8 70 C-2 48 6 20 26 10 C36 4 50 2 62 4 Z', t: [18, 18, 64, 64] });
add('blobs', 'blob8', 'Blob 8', { d: 'M50 4 C70 4 84 14 92 32 C100 52 94 72 80 86 C64 100 36 100 20 86 C4 72 0 50 8 30 C16 12 30 4 50 4 Z', t: [18, 18, 64, 64] });
add('blobs', 'splat', 'Splat', { d: 'M50 6 L58 24 L76 12 L72 32 L94 34 L80 48 L96 62 L76 64 L82 86 L64 76 L56 96 L48 78 L30 92 L34 70 L12 68 L26 54 L8 40 L28 36 L22 14 L40 26 Z', t: [30, 30, 40, 40] });
add('blobs', 'drop', 'Drop', { d: 'M50 2 C50 2 90 44 90 64 A40 40 0 0 1 10 64 C10 44 50 2 50 2 Z', t: [25, 45, 50, 40] });
add('blobs', 'egg', 'Egg', { d: 'M50 2 C76 2 94 36 94 62 A44 38 0 0 1 6 62 C6 36 24 2 50 2 Z', t: [20, 30, 60, 50] });
add('blobs', 'lens', 'Lens', { d: 'M2 50 C20 10 80 10 98 50 C80 90 20 90 2 50 Z', t: [20, 34, 60, 32] });
add('blobs', 'petal', 'Petal', { d: 'M50 2 C85 2 98 40 98 50 C98 60 85 98 50 98 C15 98 2 60 2 50 C2 40 15 2 50 2 Z', t: [18, 18, 64, 64] });
add('blobs', 'leafShape', 'Leaf shape', { d: 'M2 98 C2 40 40 2 98 2 C98 60 60 98 2 98 Z', t: [22, 22, 56, 56] });
// ---------- abstract ----------
add('abstract', 'half', 'Half circle', { d: 'M2 98 A48 48 0 0 1 98 98 Z', t: [20, 50, 60, 40] });
add('abstract', 'halfDown', 'Half circle down', { d: 'M2 2 A48 48 0 0 0 98 2 Z', t: [20, 8, 60, 40] });
add('abstract', 'quarter', 'Quarter circle', { d: 'M2 98 V2 A96 96 0 0 1 98 98 Z', t: [10, 50, 50, 40] });
add('abstract', 'quarterTR', 'Quarter circle right', { d: 'M98 98 V2 A96 96 0 0 0 2 98 Z', t: [40, 50, 50, 40] });
add('abstract', 'pieQuarter', 'Pie quarter', { d: arcPath(0, 90), t: [52, 10, 40, 40] });
add('abstract', 'pieHalf', 'Pie half', { d: arcPath(0, 180), t: [52, 20, 40, 60] });
add('abstract', 'pieThree', 'Three-quarter pie', { d: arcPath(0, 270), t: [20, 40, 50, 50] });
add('abstract', 'pieSlice', 'Pie slice', { d: arcPath(-30, 30), t: [38, 4, 24, 30] });
add('abstract', 'ringHalf', 'Half ring', { d: arcPath(-90, 90, 50, 26), t: [50, 30, 36, 40] });
add('abstract', 'ringQuarter', 'Quarter ring', { d: arcPath(0, 90, 50, 26), t: [52, 10, 30, 30] });
add('abstract', 'ringThree', 'Three-quarter ring', { d: arcPath(0, 270, 50, 30), t: [25, 25, 50, 50] });
add('abstract', 'moon', 'Moon', { d: 'M50 2 A48 48 0 1 0 50 98 A60 60 0 0 1 50 2 Z', t: [8, 30, 30, 40] });
add('abstract', 'wave', 'Wave band', { d: 'M0 30 C20 10 40 10 50 30 C60 50 80 50 100 30 V100 H0 Z', t: [10, 50, 80, 40] });
add('abstract', 'waveTop', 'Wave top', { d: 'M0 0 H100 V70 C80 90 60 90 50 70 C40 50 20 50 0 70 Z', t: [10, 10, 80, 40] });
add('abstract', 'zigzagBand', 'Zigzag band', { d: 'M0 20 L12 2 L25 20 L37 2 L50 20 L62 2 L75 20 L87 2 L100 20 V100 H0 Z', t: [10, 40, 80, 50] });
add('abstract', 'lShape', 'L shape', { d: 'M2 2 H40 V60 H98 V98 H2 Z', t: [8, 8, 28, 50] });
add('abstract', 'tShape', 'T shape', { d: 'M2 2 H98 V36 H66 V98 H34 V36 H2 Z', t: [10, 6, 80, 26] });
add('abstract', 'uShape', 'U shape', { d: 'M2 2 H34 V66 H66 V2 H98 V98 H2 Z', t: [10, 70, 80, 24] });
add('abstract', 'cornerSquare', 'Corner square', { d: 'M2 2 H98 V40 H40 V98 H2 Z', t: [8, 8, 28, 28] });
add('abstract', 'chevronStripe', 'Chevron stripe', { d: 'M0 0 H100 V30 L50 60 L0 30 Z', t: [20, 8, 60, 24] });
add('abstract', 'diagonal', 'Diagonal band', { d: 'M0 100 L100 0 H100 V40 L40 100 Z', t: [40, 20, 50, 40] });
add('abstract', 'triangleWide', 'Wide triangle', { d: 'M2 98 L50 30 L98 98 Z', t: [30, 60, 40, 32] });
add('abstract', 'triangleObtuse', 'Obtuse triangle', { d: 'M2 98 L30 2 L98 98 Z', t: [24, 56, 44, 36] });
add('abstract', 'crescentBand', 'Crescent band', { d: 'M2 2 H98 V98 C70 60 30 60 2 98 Z', t: [20, 10, 60, 40] });
add('abstract', 'speechLine', 'Line callout', { d: 'M2 2 H98 V60 H40 L2 98 Z', t: [8, 8, 84, 46] });
// ---------- symbols ----------
add('symbols', 'heart', 'Heart', { d: 'M50 92 C20 70 2 52 2 30 C2 14 14 4 28 4 C38 4 46 10 50 18 C54 10 62 4 72 4 C86 4 98 14 98 30 C98 52 80 70 50 92 Z', t: [24, 24, 52, 40] });
add('symbols', 'heartRound', 'Round heart', { d: 'M50 94 C18 70 4 52 4 32 C4 16 16 6 30 6 C40 6 47 12 50 20 C53 12 60 6 70 6 C84 6 96 16 96 32 C96 52 82 70 50 94 Z', t: [24, 24, 52, 40] });
add('symbols', 'lightning', 'Lightning', { d: 'M58 2 L18 56 H44 L36 98 L82 40 H56 Z', t: [34, 34, 30, 30] });
add('symbols', 'sun', 'Sun', { d: `M50 26 A24 24 0 1 0 50.01 26 Z ${Array.from({ length: 8 }, (_, i) => { const a = rad(i * 45); const x1 = 50 + 32 * Math.cos(a), y1 = 50 + 32 * Math.sin(a), x2 = 50 + 48 * Math.cos(a), y2 = 50 + 48 * Math.sin(a); const px = -Math.sin(a) * 4, py = Math.cos(a) * 4; return `M${f2(x1 + px)} ${f2(y1 + py)} L${f2(x2 + px * 0.6)} ${f2(y2 + py * 0.6)} L${f2(x2 - px * 0.6)} ${f2(y2 - py * 0.6)} L${f2(x1 - px)} ${f2(y1 - py)} Z`; }).join(' ')}`, t: [34, 34, 32, 32] });
add('symbols', 'cloud', 'Cloud', { d: 'M28 86 C12 86 2 76 2 64 C2 52 10 44 20 42 C22 24 36 12 52 12 C66 12 78 20 82 32 C92 34 98 44 98 56 C98 72 86 86 70 86 Z', t: [16, 34, 68, 40] });
add('symbols', 'droplet', 'Droplet', { d: 'M50 2 C56 22 86 50 86 66 A36 36 0 0 1 14 66 C14 50 44 22 50 2 Z', t: [26, 48, 48, 36] });
add('symbols', 'flame', 'Flame', { d: 'M52 2 C58 22 80 34 80 62 A30 30 0 0 1 20 62 C20 50 26 42 32 36 C32 48 40 54 44 52 C44 36 40 20 52 2 Z', t: [28, 50, 44, 36] });
add('symbols', 'gear', 'Gear', { pts: gearPts(8), t: [25, 25, 50, 50] });
add('symbols', 'gear12', 'Gear 12', { pts: gearPts(12, 50, 41), t: [25, 25, 50, 50] });
add('symbols', 'puzzle', 'Puzzle piece', { d: 'M2 30 H30 V22 A10 10 0 0 1 50 22 V30 H78 V58 A10 10 0 0 0 78 78 V98 H50 V90 A10 10 0 0 0 30 90 V98 H2 V70 A10 10 0 0 1 2 50 Z', t: [12, 40, 60, 48] });
add('symbols', 'pin', 'Location pin', { d: 'M50 2 A34 34 0 0 1 84 36 C84 60 50 98 50 98 C50 98 16 60 16 36 A34 34 0 0 1 50 2 Z', t: [30, 18, 40, 36] });
add('symbols', 'house', 'House', { d: 'M50 2 L98 42 H86 V98 H60 V68 H40 V98 H14 V42 H2 Z', t: [20, 44, 60, 24] });
add('symbols', 'check', 'Check mark', { d: 'M2 56 L18 40 L40 62 L82 10 L98 26 L40 94 Z', t: [40, 40, 20, 20] });
add('symbols', 'xmark', 'X mark', { d: 'M16 2 L50 36 L84 2 L98 16 L64 50 L98 84 L84 98 L50 64 L16 98 L2 84 L36 50 L2 16 Z', t: [36, 36, 28, 28] });
add('symbols', 'infinity', 'Infinity', { d: 'M28 30 C40 30 44 40 50 50 C56 60 60 70 72 70 A20 20 0 0 0 72 30 C60 30 56 40 50 50 C44 60 40 70 28 70 A20 20 0 0 1 28 30 Z', stroke: true, t: [30, 40, 40, 20] });
add('symbols', 'bell', 'Bell', { d: 'M50 2 A6 6 0 0 1 56 8 C76 14 80 32 80 60 L90 80 H10 L20 60 C20 32 24 14 44 8 A6 6 0 0 1 50 2 Z M38 86 H62 A12 12 0 0 1 38 86 Z', t: [28, 30, 44, 36] });
add('symbols', 'crown', 'Crown', { d: 'M2 30 L26 54 L50 10 L74 54 L98 30 L88 90 H12 Z', t: [22, 54, 56, 28] });
add('symbols', 'trophy', 'Trophy', { d: 'M20 2 H80 V14 H98 C98 40 84 52 70 54 C66 62 60 66 56 68 V82 H72 V98 H28 V82 H44 V68 C40 66 34 62 30 54 C16 52 2 40 2 14 H20 Z M12 24 C12 36 18 42 26 44 C22 36 20 30 20 24 Z M88 24 C88 36 82 42 74 44 C78 36 80 30 80 24 Z', evenodd: true, t: [30, 16, 40, 30] });
add('symbols', 'magnet', 'Magnet', { d: 'M2 50 A48 48 0 0 1 98 50 V98 H70 V50 A20 20 0 0 0 30 50 V98 H2 Z', t: [30, 20, 40, 20] });
add('symbols', 'speechDots', 'Chat', { d: 'M12 4 H88 Q98 4 98 14 V62 Q98 72 88 72 H40 L18 96 L22 72 H12 Q2 72 2 62 V14 Q2 4 12 4 Z M28 32 A6 6 0 1 0 28.01 32 Z M50 32 A6 6 0 1 0 50.01 32 Z M72 32 A6 6 0 1 0 72.01 32 Z', evenodd: true, t: [10, 10, 80, 50] });
add('symbols', 'cursor', 'Cursor', { d: 'M12 4 L84 48 L54 56 L72 86 L58 94 L40 64 L18 86 Z', t: [30, 30, 30, 30] });
add('symbols', 'play', 'Play', { d: 'M18 6 L92 50 L18 94 Z', t: [26, 36, 36, 28] });
add('symbols', 'pause', 'Pause', { d: 'M14 6 H40 V94 H14 Z M60 6 H86 V94 H60 Z', t: [10, 40, 80, 20] });
add('symbols', 'hashtag', 'Hashtag', { d: 'M30 2 H44 L40 30 H58 L62 2 H76 L72 30 H92 V44 H70 L68 56 H90 V70 H66 L62 98 H48 L52 70 H34 L30 98 H16 L20 70 H2 V56 H22 L24 44 H4 V30 H26 Z M38 44 L36 56 H54 L56 44 Z', evenodd: true, t: [30, 30, 40, 40] });
add('symbols', 'at', 'At sign', { d: 'M50 2 A48 48 0 1 0 90 72 H78 A36 36 0 1 1 86 50 V58 A8 8 0 0 1 70 58 V50 A20 20 0 1 0 64 64 A14 14 0 0 0 86 72 A20 20 0 0 0 98 50 A48 48 0 0 0 50 2 Z M50 62 A12 12 0 1 1 50.01 62 Z', evenodd: true, t: [30, 30, 40, 40] });
add('symbols', 'ampersand', 'Ampersand', { d: 'M62 98 L54 88 C46 96 36 98 28 98 C12 98 2 88 2 74 C2 62 10 54 22 46 C16 38 12 32 12 24 C12 10 22 2 36 2 C50 2 58 10 58 22 C58 34 50 40 40 46 L58 68 C62 60 64 52 64 44 H78 C78 56 74 66 68 76 L86 98 Z M30 56 C22 62 18 66 18 72 C18 80 24 84 30 84 C36 84 42 80 46 76 Z M30 36 C38 30 42 26 42 22 C42 16 40 14 36 14 C30 14 28 18 28 22 C28 26 28 30 30 36 Z', evenodd: true, t: [30, 30, 40, 40] });

export const SHAPES = S;
export const SHAPE_CATS = [
  ['basic', 'Basic'], ['rounded', 'Rounded'], ['stars', 'Stars & badges'], ['arrows', 'Arrows'], ['callouts', 'Speech bubbles'], ['banners', 'Banners & ribbons'],
  ['flowchart', 'Flowchart'], ['badges', 'Shields & frames'], ['brackets', 'Outlines'], ['math', 'Math'], ['blobs', 'Organic'], ['abstract', 'Abstract'], ['symbols', 'Symbols'],
];
// the shapes offered as photo frames (every shape works; these are the ones shown first)
export const FRAME_SHAPES = ['rect', 'rounded', 'circle', 'squircle', 'pill', 'arch', 'archDown', 'leaf', 'leaf2', 'hexagon', 'hexagonTall', 'octagon', 'diamond', 'triangle', 'star5', 'star4', 'burst', 'seal', 'seal20', 'heart', 'heartRound', 'blob1', 'blob2', 'blob3', 'blob4', 'blob5', 'drop', 'egg', 'lens', 'petal', 'leafShape', 'moon', 'half', 'quarter', 'bubble', 'bubbleRound', 'cloud', 'shield', 'hexBadge', 'rosette', 'ticket', 'bookmark', 'parallelogram', 'trapezoid', 'kite', 'pentagon', 'roundTop', 'roundBottom', 'pin', 'splat'];
export const FRAMES = FRAME_SHAPES; // kept for older code

const esc = (s) => String(s).replace(/"/g, '&quot;');
// the SVG of a shape (fills the whole box; the stroke keeps its width when the box stretches)
export function shapeSvg(key, fill, stroke = 'none', sw = 0, extra = '') {
  const s = S[key] || S.rect;
  fill = esc(fill || '#6C4CF5'); stroke = esc(stroke);
  const st = s.stroke
    ? `fill="none" stroke="${fill}" stroke-width="${Math.max(sw || 0, 6)}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"`
    : `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" vector-effect="non-scaling-stroke" stroke-linejoin="round"`;
  let body;
  if (s.circle) body = `<ellipse cx="50" cy="50" rx="50" ry="50" ${st}/>`;
  else if (s.css) body = `<rect x="0" y="0" width="100" height="100" rx="${s.radius || 0}" ${st}/>`;
  else if (s.pts) body = `<polygon points="${s.pts}" ${st}/>`;
  else body = `<path d="${s.d}" ${st} ${s.evenodd ? 'fill-rule="evenodd"' : ''}/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" ${extra}>${body}</svg>`;
}
// the clip (0..1 object bounding box units) of a shape, for photo frames
export function shapeClipBody(key) {
  const s = S[key] || S.rect;
  if (s.circle) return '<ellipse cx="50" cy="50" rx="50" ry="50"/>';
  if (s.css) return `<rect width="100" height="100" rx="${s.radius || 0}"/>`;
  if (s.pts) return `<polygon points="${s.pts}"/>`;
  return `<path d="${s.d}" ${s.evenodd ? 'clip-rule="evenodd"' : ''}/>`;
}
export function clipPathFor(key) {
  const s = S[key];
  if (!s || key === 'rect') return '';
  if (s.circle) return 'ellipse(50% 50% at 50% 50%)';
  if (s.css) return `inset(0 round ${s.radius || 0}%)`;
  if (s.pts) return `polygon(${s.pts.split(' ').map((p) => p.split(',').map((v) => v + '%').join(' ')).join(',')})`;
  return `path-${key}`;
}
// the text area of a shape, in element pixels
export function textArea(el) {
  const t = (S[el.shape] || S.rect).t || sq;
  return { x: (t[0] / 100) * el.w, y: (t[1] / 100) * el.h, w: (t[2] / 100) * el.w, h: (t[3] / 100) * el.h };
}
export const isStrokeShape = (key) => !!S[key]?.stroke;
