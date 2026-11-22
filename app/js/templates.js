// Ready-made presentation templates (1920 x 1080). Photos come from the local library.
import { uid } from './store.js';
import { photoBy } from './assets.js';
import { t as tr } from './i18n.js';

const T = (html, x, y, w, size, o = {}) => ({ id: uid(), type: 'text', html: tr(html), x, y, w, h: size * 1.3, size, font: o.font || 'Inter', color: o.color || '#1E1F2B', bold: !!o.bold, italic: !!o.italic, align: o.align || 'left', lineHeight: o.lh || 1.2, spacing: o.sp || 0, upper: !!o.upper, highlight: o.hl, rot: 0, opacity: o.op ?? 1 });
const S = (shape, x, y, w, h, fill, o = {}) => ({ id: uid(), type: 'shape', shape, x, y, w, h, fill, stroke: o.stroke, strokeWidth: o.sw || 0, radius: o.r, rot: o.rot || 0, opacity: o.op ?? 1 });
const L = (shape, x, y, w, color, sw = 6) => ({ id: uid(), type: 'shape', shape, x, y, w, h: sw * 6, stroke: color, strokeWidth: sw, rot: 0, opacity: 1 });
const I = (name, x, y, s, color, sw = 2) => ({ id: uid(), type: 'icon', name, x, y, w: s, h: s, color, sw, rot: 0, opacity: 1 });
const P = (cat, i, x, y, w, h, o = {}) => {
  const src = photoBy(cat, i);
  return src ? { id: uid(), type: 'image', src, x, y, w, h, frame: o.frame || 'rect', radius: o.r || 0, filters: o.f || {}, rot: 0, opacity: 1 }
    : S(o.frame === 'circle' ? 'circle' : 'rounded', x, y, w, h, o.fallback || '#E3DBFF', { r: 8 });
};
const slide = (bg, elements) => ({ id: uid(), bg: typeof bg === 'string' ? (bg.includes('gradient') ? { type: 'gradient', value: bg } : { type: 'color', value: bg }) : bg, elements });
const photoBg = (cat, i, fallback) => { const s = photoBy(cat, i); return s ? { type: 'image', value: s } : { type: 'gradient', value: fallback }; };

export const TEMPLATES = [
  {
    id: 'pitch', name: 'Bold Pitch', tag: 'Business', build: () => [
      slide('linear-gradient(135deg,#6C4CF5,#B455E8 55%,#FF6B8B)', [
        S('blob1', 1240, -160, 900, 900, '#FFFFFF', { op: 0.12 }), S('circle', -140, 760, 420, 420, '#FFFFFF', { op: 0.1 }),
        T('SEED ROUND 2026', 140, 300, 900, 30, { color: '#FFFFFF', bold: true, sp: 30, op: 0.85 }),
        T('Brightpath', 140, 360, 1200, 170, { font: 'Poppins', color: '#FFFFFF', bold: true, lh: 1 }),
        T('Making clean energy simple for every home.', 140, 580, 1000, 52, { color: '#FFFFFF', op: 0.92 }),
        S('rounded', 140, 740, 300, 84, '#FFFFFF', { r: 50 }), T('Let’s talk', 140, 760, 300, 34, { color: '#6C4CF5', bold: true, align: 'center' }),
      ]),
      slide('#FFFFFF', [
        T('The problem', 140, 120, 1000, 90, { font: 'Poppins', bold: true }), S('rounded', 140, 240, 120, 12, '#FF6B8B', { r: 50 }),
        ...[['zap', 'Energy bills rose 38% in 3 years'], ['clock', 'Installers book 6 months ahead'], ['circle-help', 'Homeowners don’t know where to start']].flatMap(([ic, t], k) => [
          S('rounded', 140 + k * 560, 380, 500, 460, '#F4F1FF', { r: 10 }), S('circle', 190 + k * 560, 430, 120, 120, '#6C4CF5'),
          I(ic, 220 + k * 560, 460, 60, '#FFFFFF'), T(t, 190 + k * 560, 600, 400, 44, { font: 'Poppins', bold: true, lh: 1.15 }),
        ]),
      ]),
      slide('#0F1B3D', [
        T('Traction', 140, 120, 900, 90, { font: 'Poppins', bold: true, color: '#FFFFFF' }),
        ...[['12k', 'homes'], ['4.9★', 'rating'], ['$3.2M', 'revenue']].flatMap(([n, l], k) => [
          T(n, 140 + k * 560, 400, 520, 160, { font: 'Poppins', bold: true, color: ['#FF6B8B', '#B455E8', '#8D74FF'][k] }),
          T(l, 150 + k * 560, 600, 520, 44, { color: '#FFFFFF', op: 0.75, upper: true, sp: 20 }),
        ]),
      ]),
      slide('linear-gradient(135deg,#6C4CF5,#FF6B8B)', [
        T('Thank you', 0, 380, 1920, 160, { font: 'Poppins', bold: true, color: '#FFFFFF', align: 'center' }),
        T('hello@brightpath.example', 0, 600, 1920, 44, { color: '#FFFFFF', align: 'center', op: 0.9 }),
      ]),
    ],
  },
  {
    id: 'minimal', name: 'Clean Report', tag: 'Report', build: () => [
      slide('#FFFFFF', [
        S('rect', 0, 0, 24, 1080, '#1E1F2B'),
        T('Annual Report', 160, 360, 1300, 150, { font: 'DM Serif Display', lh: 1 }),
        T('Results, lessons and what comes next — 2026', 165, 560, 1200, 44, { color: '#5B5E73' }),
        L('line', 165, 680, 300, '#1E1F2B', 4),
      ]),
      slide('#FFFFFF', [
        T('01', 160, 140, 300, 40, { bold: true, color: '#9295A8', sp: 10 }),
        T('Highlights', 160, 200, 1000, 96, { font: 'DM Serif Display' }),
        T('• Revenue grew 24% year over year<br>• Two new offices opened<br>• Customer satisfaction at an all-time high', 160, 380, 820, 42, { lh: 1.7, color: '#2E3040' }),
        P('Business', 0, 1080, 160, 680, 760, { r: 4 }),
      ]),
      slide('#F3F4F8', [
        T('“Simplicity is the ultimate sophistication.”', 260, 380, 1400, 84, { font: 'DM Serif Display', italic: true, align: 'center', lh: 1.15 }),
        T('— Our design principle', 260, 640, 1400, 36, { align: 'center', color: '#5B5E73' }),
      ]),
    ],
  },
  {
    id: 'travel', name: 'Travel Story', tag: 'Personal', build: () => [
      slide(photoBg('Mountains', 0, 'linear-gradient(135deg,#43CEA2,#185A9D)'), [
        S('rect', 0, 0, 1920, 1080, '#000000', { op: 0.32 }),
        T('ADVENTURE AWAITS', 0, 330, 1920, 34, { color: '#FFFFFF', align: 'center', sp: 60, bold: true }),
        T('Into the Wild', 0, 390, 1920, 190, { font: 'Pacifico', color: '#FFFFFF', align: 'center' }),
        T('A two-week journey through the mountains', 0, 650, 1920, 44, { color: '#FFFFFF', align: 'center', op: 0.9 }),
      ]),
      slide('#F5EBDD', [
        T('Day 1 — Arrival', 140, 140, 800, 84, { font: 'Playfair Display', bold: true, color: '#3B2A1A' }),
        T('We landed at dawn, grabbed coffee in the old town and drove straight to the valley.', 140, 290, 700, 40, { lh: 1.5, color: '#5A4632' }),
        P('Nature', 0, 980, 120, 800, 520, { r: 4 }), P('Travel', 1, 980, 680, 390, 300, { r: 4 }), P('Ocean', 0, 1390, 680, 390, 300, { r: 4 }),
        I('map-pin', 140, 820, 56, '#C8A97E'), T('Alpine valley', 210, 826, 600, 36, { color: '#5A4632', bold: true }),
      ]),
      slide('#FFFFFF', [
        P('Ocean', 1, 0, 0, 960, 1080),
        T('Best moment', 1080, 330, 700, 40, { color: '#C8A97E', upper: true, sp: 30, bold: true }),
        T('Sunset by the lake', 1080, 400, 740, 100, { font: 'Playfair Display', bold: true, lh: 1.05 }),
        T('Nothing beats the silence after a long hike.', 1080, 650, 660, 38, { color: '#5B5E73', lh: 1.5 }),
      ]),
    ],
  },
  {
    id: 'lesson', name: 'Playful Lesson', tag: 'Education', build: () => [
      slide('#FFF6E5', [
        S('blob2', 1300, 520, 700, 700, '#FFD166'), S('circle', -120, -120, 420, 420, '#7BDFF2'), S('star5', 1560, 120, 160, 160, '#FF6B8B', { rot: 12 }),
        T('Science Class', 140, 330, 1640, 150, { font: 'Nunito', bold: true, color: '#14213D' }),
        T('Let’s explore the water cycle!', 145, 520, 1000, 54, { font: 'Nunito', color: '#3D405B' }),
        S('rounded', 145, 640, 360, 80, '#14213D', { r: 50 }), T('Unit 3 · Week 2', 145, 658, 360, 32, { color: '#FFFFFF', bold: true, align: 'center', font: 'Nunito' }),
      ]),
      slide('#FFFFFF', [
        T('The 4 stages', 140, 110, 1000, 86, { font: 'Nunito', bold: true, color: '#14213D' }),
        ...[['sun', 'Evaporation', '#FFD166'], ['cloud', 'Condensation', '#7BDFF2'], ['cloud-rain', 'Precipitation', '#B2F7EF'], ['waves', 'Collection', '#F7D6E0']].flatMap(([ic, t, c], k) => [
          S('rounded', 140 + k * 420, 340, 380, 480, c, { r: 12 }), I(ic, 260 + k * 420, 420, 140, '#14213D', 1.6),
          T(t, 140 + k * 420, 640, 380, 40, { font: 'Nunito', bold: true, align: 'center', color: '#14213D' }),
          T(String(k + 1), 170 + k * 420, 360, 80, 40, { font: 'Nunito', bold: true, color: '#14213D', op: 0.5 }),
        ]),
      ]),
      slide('#14213D', [
        T('Quiz time! 🎉', 0, 360, 1920, 140, { font: 'Nunito', bold: true, color: '#FFD166', align: 'center' }),
        T('What makes clouds form?', 0, 560, 1920, 60, { font: 'Nunito', color: '#FFFFFF', align: 'center' }),
      ]),
    ],
  },
  {
    id: 'launch', name: 'Product Launch', tag: 'Marketing', build: () => [
      slide('linear-gradient(160deg,#0B0B1A,#2A1B5C 60%,#6C4CF5)', [
        S('circle', 1200, 200, 680, 680, '#8D74FF', { op: 0.25 }), S('circle', 1320, 320, 440, 440, '#FF6B8B', { op: 0.3 }),
        T('INTRODUCING', 140, 340, 800, 32, { color: '#B9A8FF', bold: true, sp: 50 }),
        T('Nova X', 140, 390, 1000, 220, { font: 'Space Grotesk', bold: true, color: '#FFFFFF', lh: 1 }),
        T('The fastest way to plan your week.', 145, 640, 900, 50, { color: '#FFFFFF', op: 0.8 }),
      ]),
      slide('#0B0B1A', [
        T('Why you’ll love it', 140, 130, 1200, 90, { font: 'Space Grotesk', bold: true, color: '#FFFFFF' }),
        ...[['sparkles', 'Smart suggestions'], ['shield-check', 'Private by design'], ['wifi-off', 'Works offline']].flatMap(([ic, t], k) => [
          S('rounded', 140 + k * 560, 360, 500, 400, '#1A1A33', { r: 8, stroke: '#2E2E55', sw: 2 }),
          I(ic, 200 + k * 560, 420, 80, '#B9A8FF', 1.8),
          T(t, 200 + k * 560, 560, 400, 46, { font: 'Space Grotesk', bold: true, color: '#FFFFFF' }),
          T('Short line that explains the benefit.', 200 + k * 560, 640, 400, 30, { color: '#9C9CC0', lh: 1.4 }),
        ]),
      ]),
      slide('linear-gradient(135deg,#6C4CF5,#FF6B8B)', [
        T('Available today', 0, 400, 1920, 140, { font: 'Space Grotesk', bold: true, color: '#FFFFFF', align: 'center' }),
        T('novax.example · $9 / month', 0, 590, 1920, 46, { color: '#FFFFFF', align: 'center', op: 0.9 }),
      ]),
    ],
  },
  {
    id: 'portfolio', name: 'Elegant Portfolio', tag: 'Creative', build: () => [
      slide('#F5EBDD', [
        P('Architecture', 0, 1000, 0, 920, 1080),
        T('Portfolio', 140, 380, 800, 150, { font: 'Playfair Display', italic: true, color: '#14213D' }),
        T('MAYA LORENZ · DESIGNER', 145, 580, 800, 30, { color: '#14213D', sp: 40, bold: true }),
        L('line', 145, 640, 160, '#C8A97E', 4),
      ]),
      slide('#FFFFFF', [
        T('Selected work', 140, 110, 900, 80, { font: 'Playfair Display', italic: true }),
        P('Architecture', 1, 140, 260, 520, 640, { r: 2 }), P('City', 0, 700, 260, 520, 640, { r: 2 }), P('Abstract', 0, 1260, 260, 520, 640, { r: 2 }),
        T('Studio Loft', 140, 930, 520, 30, { bold: true }), T('City Lines', 700, 930, 520, 30, { bold: true }), T('Texture Study', 1260, 930, 520, 30, { bold: true }),
      ]),
      slide('#14213D', [
        T('Let’s create together', 0, 420, 1920, 110, { font: 'Playfair Display', italic: true, color: '#F5EBDD', align: 'center' }),
        T('maya@studio.example', 0, 600, 1920, 38, { color: '#C8A97E', align: 'center', sp: 10 }),
      ]),
    ],
  },
  {
    id: 'meeting', name: 'Team Update', tag: 'Work', build: () => [
      slide('#FFFFFF', [
        S('rect', 0, 0, 1920, 1080, '#EAF2FF'), S('rounded', 1060, 140, 720, 800, '#3D8BFF', { r: 6 }),
        P('Business', 1, 1100, 180, 640, 720, { r: 4 }),
        T('Weekly Team Update', 140, 360, 860, 104, { font: 'Montserrat', bold: true, color: '#0F2A5C', lh: 1.05 }),
        T('Product & Engineering · Week 47', 145, 620, 800, 38, { color: '#3D5A8A' }),
      ]),
      slide('#FFFFFF', [
        T('Agenda', 140, 120, 800, 88, { font: 'Montserrat', bold: true, color: '#0F2A5C' }),
        ...['Wins of the week', 'Metrics review', 'Blockers', 'Next steps'].flatMap((t, k) => [
          S('circle', 140, 300 + k * 160, 90, 90, '#3D8BFF'), T(String(k + 1), 140, 318 + k * 160, 90, 40, { bold: true, color: '#FFFFFF', align: 'center', font: 'Montserrat' }),
          T(t, 270, 318 + k * 160, 1000, 44, { font: 'Montserrat', bold: true, color: '#0F2A5C' }),
        ]),
      ]),
      slide('#0F2A5C', [
        T('Questions?', 0, 420, 1920, 140, { font: 'Montserrat', bold: true, color: '#FFFFFF', align: 'center' }),
      ]),
    ],
  },
  {
    id: 'eco', name: 'Green Future', tag: 'Nonprofit', build: () => [
      slide(photoBg('Nature', 1, 'linear-gradient(135deg,#11998E,#38EF7D)'), [
        S('rect', 0, 0, 1100, 1080, '#0E3B2E', { op: 0.82 }),
        I('leaf', 140, 260, 100, '#9BE7B0', 1.6),
        T('Protect what we love', 140, 400, 860, 110, { font: 'Lora', bold: true, color: '#FFFFFF', lh: 1.05 }),
        T('Our 2030 plan for cleaner rivers and greener cities.', 145, 680, 760, 40, { color: '#D7F5E1', lh: 1.4 }),
      ]),
      slide('#F2FBF5', [
        T('Our impact', 140, 120, 900, 90, { font: 'Lora', bold: true, color: '#0E3B2E' }),
        ...[['trees', '1.2M', 'trees planted'], ['droplets', '340', 'rivers cleaned'], ['users', '58k', 'volunteers']].flatMap(([ic, n, l], k) => [
          I(ic, 140 + k * 560, 380, 90, '#2EA05B', 1.6),
          T(n, 140 + k * 560, 500, 500, 130, { font: 'Lora', bold: true, color: '#0E3B2E' }),
          T(l, 145 + k * 560, 680, 500, 40, { color: '#4A7A5E' }),
        ]),
      ]),
    ],
  },
  {
    id: 'bizplan', name: 'Business Plan', tag: 'Business', build: () => [
      slide('#0B1F3A', [
        S('rect', 1180, 0, 740, 1080, '#F2B134'), P('City', 2, 1260, 140, 580, 800, { r: 2 }),
        T('BUSINESS PLAN 2026', 140, 320, 900, 32, { color: '#F2B134', bold: true, sp: 40 }),
        T('Atelier Nord', 140, 380, 1000, 150, { font: 'Montserrat', bold: true, color: '#FFFFFF', lh: 1 }),
        T('A neighbourhood bakery that delivers every morning.', 145, 580, 900, 44, { color: '#C9D4E5', lh: 1.4 }),
      ]),
      slide('#FFFFFF', [
        T('The plan in 4 steps', 140, 110, 1400, 84, { font: 'Montserrat', bold: true, color: '#0B1F3A' }),
        ...[['Market', 'Who buys and why'], ['Offer', 'What we sell, at what price'], ['Team', 'Who does what'], ['Money', 'Costs, sales, break-even']].flatMap(([a, b], k) => [
          S('rounded', 140 + k * 420, 320, 380, 520, k % 2 ? '#F5F7FB' : '#0B1F3A', { r: 6 }),
          T(String(k + 1).padStart(2, '0'), 190 + k * 420, 370, 200, 90, { font: 'Montserrat', bold: true, color: '#F2B134' }),
          T(a, 190 + k * 420, 520, 300, 52, { font: 'Montserrat', bold: true, color: k % 2 ? '#0B1F3A' : '#FFFFFF' }),
          T(b, 190 + k * 420, 600, 290, 34, { color: k % 2 ? '#5B5E73' : '#C9D4E5', lh: 1.4 }),
        ]),
      ]),
      slide('#F2B134', [
        T('We are looking for €80,000', 140, 380, 1640, 110, { font: 'Montserrat', bold: true, color: '#0B1F3A' }),
        T('to open our first shop in spring.', 145, 540, 1400, 50, { color: '#0B1F3A' }),
      ]),
    ],
  },
  {
    id: 'results', name: 'Quarterly Results', tag: 'Report', build: () => [
      slide('linear-gradient(135deg,#0F2027,#203A43,#2C5364)', [
        T('Q3 2026', 140, 340, 800, 40, { color: '#7FD1C7', bold: true, sp: 30 }),
        T('Quarterly results', 140, 400, 1400, 140, { font: 'Space Grotesk', bold: true, color: '#FFFFFF' }),
        L('line', 145, 600, 220, '#7FD1C7', 6),
      ]),
      slide('#FFFFFF', [
        T('Sales by quarter', 140, 110, 1200, 80, { font: 'Space Grotesk', bold: true, color: '#0F2027' }),
        ...[45, 60, 52, 88].flatMap((v, k) => [
          S('rounded', 220 + k * 340, 900 - v * 6, 200, v * 6, k === 3 ? '#1FB5A6' : '#C8F1EC', { r: 8 }),
          T(v + 'k', 220 + k * 340, 900 - v * 6 - 64, 200, 40, { bold: true, align: 'center', color: '#0F2027' }),
          T('Q' + (k + 1), 220 + k * 340, 920, 200, 32, { align: 'center', color: '#5B5E73' }),
        ]),
        S('rounded', 1580, 300, 260, 160, '#0F2027', { r: 10 }), T('+69%', 1580, 330, 260, 60, { font: 'Space Grotesk', bold: true, color: '#7FD1C7', align: 'center' }),
        T('vs Q2', 1580, 400, 260, 28, { color: '#FFFFFF', align: 'center', op: 0.7 }),
      ]),
      slide('#F5F7FA', [
        T('What we learned', 140, 120, 1200, 80, { font: 'Space Grotesk', bold: true, color: '#0F2027' }),
        ...[['circle-check', 'New customers came from word of mouth'], ['circle-alert', 'Delivery times grew in August'], ['target', 'Next goal: 100k in Q4']].flatMap(([ic, t2], k) => [
          I(ic, 140, 330 + k * 180, 70, ['#1FB5A6', '#FF8A3D', '#3D8BFF'][k], 2), T(t2, 250, 340 + k * 180, 1400, 46, { color: '#0F2027' }),
        ]),
      ]),
    ],
  },
  {
    id: 'roadmap', name: 'Project Roadmap', tag: 'Work', build: () => [
      slide('#FFF8F0', [
        S('blob1', 1250, 380, 760, 760, '#FFD6A5'), S('circle', 1580, 180, 160, 160, '#FF8A3D'),
        T('Project roadmap', 140, 360, 1200, 140, { font: 'Poppins', bold: true, color: '#3A2412' }),
        T('From idea to launch in 6 months', 145, 540, 1000, 48, { color: '#7A5A3E' }),
      ]),
      slide('#FFFFFF', [
        T('Timeline', 140, 110, 1000, 84, { font: 'Poppins', bold: true, color: '#3A2412' }),
        S('rounded', 140, 520, 1640, 12, '#FFE2CC', { r: 50 }),
        ...[['January', 'Research'], ['March', 'Design'], ['May', 'Build'], ['June', 'Launch']].flatMap(([m, t2], k) => [
          S('circle', 160 + k * 520, 486, 80, 80, ['#FFC83D', '#FF8A3D', '#FF5A5F', '#6C4CF5'][k]),
          T(m, 100 + k * 520, 360, 200, 40, { bold: true, align: 'center', color: '#3A2412' }),
          T(t2, 100 + k * 520, 620, 200, 36, { align: 'center', color: '#7A5A3E' }),
        ]),
      ]),
      slide('#3A2412', [
        T('Next steps', 140, 140, 1000, 90, { font: 'Poppins', bold: true, color: '#FFFFFF' }),
        T('• Validate the budget<br>• Hire two developers<br>• Book the launch event', 145, 320, 1200, 52, { color: '#FFE2CC', lh: 1.7 }),
      ]),
    ],
  },
  {
    id: 'workshop', name: 'Workshop', tag: 'Education', build: () => [
      slide('linear-gradient(135deg,#E0C3FC,#8EC5FC)', [
        S('rounded', 140, 200, 1640, 680, '#FFFFFF', { r: 4, op: 0.85 }),
        T('WORKSHOP · 2 HOURS', 240, 330, 1000, 32, { color: '#6C4CF5', bold: true, sp: 40 }),
        T('Speak with confidence', 240, 390, 1440, 120, { font: 'Raleway', bold: true, color: '#1E1F2B' }),
        T('Practical tools to present without stress', 245, 560, 1200, 46, { color: '#5B5E73' }),
      ]),
      slide('#FFFFFF', [
        T('Today’s program', 140, 110, 1200, 84, { font: 'Raleway', bold: true }),
        ...[['10:00', 'Welcome and goals'], ['10:20', 'Breathing and voice'], ['11:00', 'Short practice in pairs'], ['11:40', 'Questions and feedback']].flatMap(([h, t2], k) => [
          S('rounded', 140, 280 + k * 160, 1640, 130, k % 2 ? '#F7F7FB' : '#EFEBFF', { r: 8 }),
          T(h, 190, 320 + k * 160, 200, 44, { bold: true, color: '#6C4CF5' }), T(t2, 420, 320 + k * 160, 1200, 44, { color: '#1E1F2B' }),
        ]),
      ]),
      slide('#6C4CF5', [
        T('Your turn!', 0, 380, 1920, 150, { font: 'Raleway', bold: true, color: '#FFFFFF', align: 'center' }),
        T('2 minutes to present an idea to your neighbour', 0, 580, 1920, 46, { color: '#E3DBFF', align: 'center' }),
      ]),
    ],
  },
  {
    id: 'event', name: 'Event Night', tag: 'Personal', build: () => [
      slide(photoBg('Night', 0, 'linear-gradient(160deg,#0B0B1A,#2A1B5C 60%,#6C4CF5)'), [
        S('rect', 0, 0, 1920, 1080, '#0B0B1A', { op: 0.55 }),
        T('YOU ARE INVITED', 0, 300, 1920, 34, { color: '#FFD166', align: 'center', bold: true, sp: 60 }),
        T('Summer Gala', 0, 360, 1920, 200, { font: 'DM Serif Display', color: '#FFFFFF', align: 'center' }),
        T('Saturday 14 June · 8 pm · Riverside Hall', 0, 620, 1920, 46, { color: '#FFFFFF', align: 'center', op: 0.9 }),
      ]),
      slide('#0B0B1A', [
        T('The evening', 140, 120, 1000, 90, { font: 'DM Serif Display', color: '#FFD166' }),
        ...[['wine', 'Welcome drinks'], ['utensils', 'Dinner'], ['music', 'Live music'], ['sparkles', 'Fireworks']].flatMap(([ic, t2], k) => [
          I(ic, 200 + k * 420, 400, 110, '#FFD166', 1.5), T(t2, 120 + k * 420, 560, 270, 42, { color: '#FFFFFF', align: 'center' }),
        ]),
      ]),
    ],
  },
  {
    id: 'menu', name: 'Restaurant Menu', tag: 'Marketing', build: () => [
      slide('#F5EBDD', [
        P('Food', 0, 0, 0, 860, 1080),
        T('La Table', 1000, 300, 800, 150, { font: 'Playfair Display', italic: true, color: '#3B2A1A' }),
        T('SEASONAL MENU', 1005, 490, 800, 32, { bold: true, sp: 50, color: '#B85A12' }),
        L('line', 1005, 560, 200, '#B85A12', 4),
        T('Fresh, local and homemade since 1998.', 1005, 620, 760, 40, { color: '#5A4632' }),
      ]),
      slide('#FFFDF8', [
        T('Our dishes', 140, 110, 1000, 90, { font: 'Playfair Display', italic: true, color: '#3B2A1A' }),
        ...[['Tomato & basil soup', '9'], ['Roast chicken, herbs', '18'], ['Wild mushroom risotto', '16'], ['Lemon tart', '7']].flatMap(([d2, p], k) => [
          T(d2, 140, 300 + k * 150, 1200, 50, { color: '#3B2A1A', font: 'Lora' }),
          T(p + ' €', 1500, 300 + k * 150, 280, 50, { color: '#B85A12', bold: true, align: 'right', font: 'Lora' }),
          L('dotLine', 140, 370 + k * 150, 1640, '#D9C7AE', 3),
        ]),
      ]),
    ],
  },
];

export function blankSlideLayouts() {
  return [
    { name: 'Blank', build: () => slide('#FFFFFF', []) },
    { name: 'Title', build: () => slide('#FFFFFF', [T('Add a title', 160, 400, 1600, 120, { font: 'Poppins', bold: true, align: 'center' }), T('Add a subtitle', 160, 580, 1600, 48, { align: 'center', color: '#5B5E73' })]) },
    { name: 'Title + text', build: () => slide('#FFFFFF', [T('Section title', 140, 140, 1600, 90, { font: 'Poppins', bold: true }), T('Write your points here.<br>Each line becomes a new idea.', 140, 320, 1300, 44, { lh: 1.6, color: '#2E3040' })]) },
    { name: 'Two columns', build: () => slide('#FFFFFF', [T('Compare', 140, 120, 1600, 90, { font: 'Poppins', bold: true }), S('rounded', 140, 300, 780, 620, '#F4F1FF', { r: 6 }), S('rounded', 1000, 300, 780, 620, '#FFF0F4', { r: 6 }), T('Option A', 200, 360, 660, 50, { bold: true }), T('Option B', 1060, 360, 660, 50, { bold: true })]) },
    { name: 'Image + text', build: () => slide('#FFFFFF', [P('Nature', 2, 0, 0, 900, 1080), T('Big idea', 1020, 380, 760, 100, { font: 'Poppins', bold: true }), T('Explain it in one or two short sentences.', 1020, 540, 740, 40, { color: '#5B5E73', lh: 1.5 })]) },
  ];
}
