// Deckly for Claude — an MCP server over stdio (JSON-RPC 2.0, one message per line), run by the Deckly
// executable in Node mode: `ELECTRON_RUN_AS_NODE=1 Deckly.exe <this file>`. It talks to the running Deckly
// app on this computer (a local port + token in the app's data folder), and starts Deckly when it is closed.
// Plain Node, no dependency: the file is kept outside the app archive so Node can run it.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { spawn } = require('node:child_process');

const VERSION = (() => { try { return require(path.join(__dirname, '..', 'package.json')).version; } catch { return '0.0.0'; } })();
const dataDir = process.env.DECKLY_DATA_DIR || path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Deckly');
const connFile = path.join(dataDir, 'connector.json');

// ---------- reaching the app ----------
function readConn() { try { return JSON.parse(fs.readFileSync(connFile, 'utf8')); } catch { return null; } }
function post(conn, body, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port: conn.port, path: '/call', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), 'x-deckly-token': conn.token }, timeout }, (res) => {
      let s = ''; res.setEncoding('utf8'); res.on('data', (c) => (s += c)); res.on('end', () => { try { resolve(JSON.parse(s)); } catch { reject(new Error('bad answer from Deckly')); } });
    });
    req.on('error', reject); req.on('timeout', () => { req.destroy(new Error('Deckly did not answer in time')); });
    req.end(data);
  });
}
async function alive(conn) { if (!conn) return false; try { const r = await post(conn, { tool: 'ping' }, 3000); return !!r?.pong; } catch { return false; } }
function exePath() {
  // in Node mode process.execPath is Deckly.exe itself; in development it is node
  if (/deckly/i.test(path.basename(process.execPath))) return process.execPath;
  const c = readConn(); return c?.exe || null;
}
async function ensureApp() {
  let conn = readConn();
  if (await alive(conn)) return conn;
  const exe = exePath();
  if (!exe || !fs.existsSync(exe)) throw new Error('Deckly is not running and its program could not be found. Open Deckly once, then try again.');
  const before = conn?.started || 0;
  const child = spawn(exe, ['--from-claude'], { detached: true, stdio: 'ignore', env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } });
  child.unref();
  for (let i = 0; i < 90; i++) { // up to ~45 s (first start can be slow)
    await new Promise((r) => setTimeout(r, 500));
    conn = readConn();
    if (conn && conn.started !== before && (await alive(conn))) return conn;
  }
  throw new Error('Deckly started but did not answer. Check that the Deckly window opened, then try again.');
}

// ---------- tools ----------
const S = (props, required = []) => ({ type: 'object', properties: props, required });
const ID = { type: 'string', description: 'Presentation id (from deckly_list_presentations). Leave out for the presentation currently open in Deckly.' };
const SLIDE = { type: ['integer', 'string'], description: 'Slide index (0-based) or slide id' };
const slideSpec = {
  type: 'object',
  description: 'One slide. Give a layout and its content, or let Deckly pick the layout from the fields you fill. Texts are plain text (use \\n for new lines).',
  properties: {
    layout: { type: 'string', enum: ['title', 'section', 'title-bullets', 'text', 'two-column', 'image-text', 'image-full', 'quote', 'stats', 'table', 'chart', 'blank'] },
    title: { type: 'string' }, subtitle: { type: 'string' }, text: { type: 'string' },
    bullets: { type: 'array', items: { type: 'string' }, description: '3-6 short bullet points' },
    left: { type: 'object', properties: { title: { type: 'string' }, bullets: { type: 'array', items: { type: 'string' } }, text: { type: 'string' } } },
    right: { type: 'object', properties: { title: { type: 'string' }, bullets: { type: 'array', items: { type: 'string' } }, text: { type: 'string' } } },
    image: { type: ['string', 'object'], description: 'A picture: search words for the built-in photo library (e.g. "mountain", "office", "food"), {"query": "..."}, {"sticker": "rocket"} for a 3D sticker, or an https:/data: image URL' },
    quote: { type: 'string' }, author: { type: 'string' },
    stats: { type: 'array', items: { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' } } }, description: '2-4 big numbers with a label' },
    rows: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'Table rows; the first row is the header' },
    chart: { type: 'object', properties: { kind: { type: 'string', enum: ['column', 'bar', 'line', 'area', 'pie', 'donut'] }, labels: { type: 'array', items: { type: 'string' } }, series: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, values: { type: 'array', items: { type: 'number' } } } } } } },
    notes: { type: 'string', description: 'Speaker notes' },
    background: { type: 'string', description: 'Optional background colour #RRGGBB' },
  },
};
const TOOLS = [
  { name: 'deckly_list_presentations', description: 'List the presentations saved in Deckly on this computer (id, title, size, number of slides) and which one is open.', inputSchema: S({}) },
  { name: 'deckly_get_presentation', description: 'Read a presentation: its slides with every element (texts, tables, charts…) and their ids, to edit them precisely.', inputSchema: S({ id: ID }) },
  { name: 'deckly_list_templates', description: 'The ready-made templates, the colour themes (deckly, night, minimal, warm, forest, ocean) and the slide layouts Deckly knows.', inputSchema: S({}) },
  { name: 'deckly_create_presentation', description: 'Create a new presentation in Deckly, optionally with its slides right away, and open it in the Deckly window. Returns its id. Prefer 5-12 slides with short texts; mix layouts (title, title-bullets, two-column, image-text, stats, chart, table, quote, section).', inputSchema: S({ title: { type: 'string' }, theme: { type: 'string', description: 'deckly | night | minimal | warm | forest | ocean' }, template: { type: 'string', description: 'A template id from deckly_list_templates (its slides come first)' }, slides: { type: 'array', items: slideSpec }, width: { type: 'integer', description: 'default 1920' }, height: { type: 'integer', description: 'default 1080' }, open: { type: 'boolean', description: 'Open it in Deckly (default true)' } }, ['title']) },
  { name: 'deckly_add_slide', description: 'Add one or several slides to a presentation (at the end, or at a position).', inputSchema: S({ id: ID, slides: { type: 'array', items: slideSpec }, slide: slideSpec, at: { type: 'integer', description: 'Insert position (0-based); default: at the end' } }) },
  { name: 'deckly_replace_slide', description: 'Rebuild one slide from a new content (keeps its notes unless new ones are given).', inputSchema: S({ id: ID, slide: SLIDE, content: slideSpec }, ['slide', 'content']) },
  { name: 'deckly_update_text', description: 'Change the text of one element (a text box, a shape label) or the rows of a table, by element id (see deckly_get_presentation).', inputSchema: S({ id: ID, slide: SLIDE, element: { type: 'string' }, text: { type: 'string' }, rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } }, size: { type: 'number' }, color: { type: 'string' } }, ['slide', 'element']) },
  { name: 'deckly_add_element', description: 'Add one element to a slide: text, shape (with optional text), image (built-in photo by search words, 3D sticker by name, or URL), icon (by name), table, chart, qr, line. Coordinates are in slide pixels (1920 x 1080 by default).', inputSchema: S({ id: ID, slide: SLIDE, element: { type: 'object', properties: { type: { type: 'string', enum: ['text', 'shape', 'image', 'icon', 'table', 'chart', 'qr', 'line'] }, text: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' }, size: { type: 'number' }, color: { type: 'string' }, bold: { type: 'boolean' }, align: { type: 'string' }, shape: { type: 'string', description: 'rect, rounded, circle, pill, triangle, star5, heart, arrowR, bubble, hexagon…' }, image: { type: ['string', 'object'] }, name: { type: 'string', description: 'icon name (lucide), e.g. rocket, check, lightbulb' }, rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } }, kind: { type: 'string' }, labels: { type: 'array', items: { type: 'string' } }, series: { type: 'array' }, url: { type: 'string' }, frame: { type: 'string', description: 'photo frame: circle, rounded, heart, device:phone, device:laptop…' } }, required: ['type'] } }, ['slide', 'element']) },
  { name: 'deckly_delete_element', description: 'Remove one element from a slide.', inputSchema: S({ id: ID, slide: SLIDE, element: { type: 'string' } }, ['slide', 'element']) },
  { name: 'deckly_delete_slide', description: 'Delete a slide.', inputSchema: S({ id: ID, slide: SLIDE }, ['slide']) },
  { name: 'deckly_move_slide', description: 'Move a slide to another position.', inputSchema: S({ id: ID, slide: SLIDE, to: { type: 'integer' } }, ['slide', 'to']) },
  { name: 'deckly_set_notes', description: 'Set the speaker notes of a slide.', inputSchema: S({ id: ID, slide: SLIDE, notes: { type: 'string' } }, ['slide', 'notes']) },
  { name: 'deckly_set_background', description: 'Set the background of one slide (or all slides): a colour (#RRGGBB, or dark / accent / soft from the theme), a CSS gradient, or a picture.', inputSchema: S({ id: ID, slide: SLIDE, color: { type: 'string' }, gradient: { type: 'string' }, image: { type: ['string', 'object'] } }) },
  { name: 'deckly_set_theme', description: 'Change the colour theme and fonts of a presentation and re-colour its slides.', inputSchema: S({ id: ID, theme: { type: 'string' }, colors: { type: 'object', description: '{bg, text, muted, accent, accent2, soft, dark} as #RRGGBB' }, fonts: { type: 'object', description: '{heading, body} font names available in Deckly' }, apply: { type: 'boolean' } }) },
  { name: 'deckly_search_library', description: 'Find built-in pictures to use in slides: photos (by words or category), 3D stickers, icons, colourful graphics. Returns the exact names / search words to pass as "image", "sticker" or "name".', inputSchema: S({ query: { type: 'string' }, kind: { type: 'string', enum: ['all', 'photos', 'stickers', 'icons', 'graphics'] }, limit: { type: 'integer' } }, ['query']) },
  { name: 'deckly_screenshot_slide', description: 'See a slide as a picture, to check the result (returns a PNG image).', inputSchema: S({ id: ID, slide: SLIDE, scale: { type: 'number', description: '0.25-1, default 0.5' } }, ['slide']) },
  { name: 'deckly_open_presentation', description: 'Show a presentation (and optionally a slide) in the Deckly window.', inputSchema: S({ id: ID, slide: { type: 'integer' } }) },
  { name: 'deckly_export', description: 'Export a presentation to a file: PowerPoint (pptx), PDF, PNG of one slide, or the Deckly .dkly file. Returns the file path (in the user\'s Documents folder unless a path is given).', inputSchema: S({ id: ID, format: { type: 'string', enum: ['pptx', 'pdf', 'png', 'dkly'] }, path: { type: 'string', description: 'Destination file path (optional)' }, slide: SLIDE, presentOnOpen: { type: 'boolean' } }, ['format']) },
  { name: 'deckly_delete_presentation', description: 'Delete a presentation from Deckly (cannot be undone). Ask the user before calling this.', inputSchema: S({ id: { type: 'string' } }, ['id']) },
];

async function callTool(name, args) {
  const conn = await ensureApp();
  const r = await post(conn, { tool: name, args: args || {} });
  if (!r || r.ok === false) throw new Error(r?.error || 'Deckly refused the call');
  const v = r.value;
  if (v && v.image && v.mimeType) return { content: [{ type: 'image', data: v.image, mimeType: v.mimeType }, { type: 'text', text: `Slide ${v.slide}` }] };
  return { content: [{ type: 'text', text: JSON.stringify(v, null, 1) }] };
}

// ---------- JSON-RPC over stdio ----------
const out = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (line) handle(line);
  }
});
process.stdin.on('end', () => process.exit(0));
async function handle(line) {
  let msg; try { msg = JSON.parse(line); } catch { return out({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  const { id, method, params } = msg;
  const reply = (result) => { if (id !== undefined) out({ jsonrpc: '2.0', id, result }); };
  const fail = (code, message) => { if (id !== undefined) out({ jsonrpc: '2.0', id, error: { code, message } }); };
  try {
    switch (method) {
      case 'initialize': return reply({ protocolVersion: params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'deckly', version: VERSION } });
      case 'notifications/initialized': case 'notifications/cancelled': return;
      case 'ping': return reply({});
      case 'tools/list': return reply({ tools: TOOLS });
      case 'resources/list': return reply({ resources: [] });
      case 'prompts/list': return reply({ prompts: [] });
      case 'tools/call': {
        const name = params?.name;
        if (!TOOLS.some((t) => t.name === name)) return fail(-32602, `Unknown tool ${name}`);
        try { return reply(await callTool(name, params?.arguments)); }
        catch (e) { return reply({ content: [{ type: 'text', text: `Deckly error: ${e.message}` }], isError: true }); }
      }
      default: return fail(-32601, `Method not found: ${method}`);
    }
  } catch (e) { fail(-32603, String(e?.message || e)); }
}
