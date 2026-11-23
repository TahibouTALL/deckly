// Deckly desktop app (Electron): opens the editor in its own window, handles updates, .dkly files and the Claude connector.
const { app, BrowserWindow, protocol, net, ipcMain, shell, dialog, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const APP_DIR = path.join(__dirname, '..', 'app');
protocol.registerSchemesAsPrivileged([
  { scheme: 'deckly', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) { app.quit(); } else main();
let win, flushed = false;

// ---------- settings (update choice) ----------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function readSettings() { try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; } }
function writeSettings(s) { fs.mkdirSync(path.dirname(settingsFile()), { recursive: true }); const tmp = settingsFile() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(s, null, 1)); fs.renameSync(tmp, settingsFile()); }

// ---------- window ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 640, show: false,
    title: 'Deckly', backgroundColor: '#F3F4F8', autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadURL('deckly://app/index.html');
  // links to web pages open in the normal browser (https only)
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('deckly://')) { e.preventDefault(); if (/^https:/.test(url)) shell.openExternal(url); } });
  // the page saves its work before the window closes
  win.on('close', (e) => {
    if (flushed || win.webContents.isDestroyed()) return;
    e.preventDefault(); flushed = true;
    const done = () => { try { win.destroy(); } catch { /* */ } };
    ipcMain.once('app:flushed', done); setTimeout(done, 2500);
    win.webContents.send('app:flush');
  });
  win.on('closed', () => { win = null; });
}
const safeSend = (ch, ...args) => { if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(ch, ...args); };

// ---------- .dkly files opened from Windows (double-click, "Open with") ----------
const fileArg = (argv) => argv.slice(1).find((a) => /\.(dkly|deckly)$/i.test(a) && fs.existsSync(a));
let pendingFile = fileArg(process.argv), pageReady = false;
function sendFile(p) {
  try { safeSend('file:open', fs.readFileSync(p)); } catch (e) { console.error('cannot read', p, e.message); }
}
ipcMain.on('file:ready', () => { pageReady = true; if (pendingFile) { sendFile(pendingFile); pendingFile = null; } });
ipcMain.handle('file:save', async (_e, name, bytes) => {
  const r = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), String(name).replace(/[\\/:*?"<>|]+/g, '')),
    filters: [{ name: 'Deckly', extensions: ['dkly'] }],
  });
  if (r.canceled || !r.filePath) return null;
  try { fs.writeFileSync(r.filePath, Buffer.from(bytes)); return r.filePath; }
  catch (e) { return { error: e.code === 'ENOENT' || e.code === 'EPERM' ? 'blocked' : e.message, path: r.filePath }; }
});

function main() {
  app.on('second-instance', (_e, argv) => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
    const p = fileArg(argv);
    if (p) { if (pageReady) sendFile(p); else pendingFile = p; }
  });
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'fullscreen' || permission === 'clipboard-read' || permission === 'clipboard-sanitized-write'));
    protocol.handle('deckly', (req) => {
      let p; try { p = decodeURIComponent(new URL(req.url).pathname); } catch { return new Response('Bad request', { status: 400 }); }
      const file = path.normalize(path.join(APP_DIR, p === '/' ? 'index.html' : p));
      const rel = path.relative(APP_DIR, file);
      if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(file).toString());
    });
    createWindow();
    setupUpdates();
    startConnector();
    // Self-test for developers (never in the installed app): DECKLY_SMOKE=<file.png> saves a picture of the window, prints page errors and quits.
    if (process.env.DECKLY_SMOKE && (!app.isPackaged || process.env.DECKLY_SMOKE_PACKAGED === '1')) {
      const sz = /^(\d+)x(\d+)$/.exec(process.env.DECKLY_SMOKE_SIZE || '');
      if (sz) win.once('show', () => { win.unmaximize(); win.setContentSize(+sz[1], +sz[2]); win.center(); });
      if (process.env.DECKLY_SMOKE_ZOOM) win.webContents.on('did-finish-load', () => win.webContents.setZoomFactor(+process.env.DECKLY_SMOKE_ZOOM));
      win.webContents.on('console-message', (e) => { if (e.level === 'error') console.log('[page error]', e.message); });
      setTimeout(async () => {
        try {
          const info = await win.webContents.executeJavaScript('({title: document.title, home: !document.querySelector("#home").classList.contains("hidden"), photos: document.querySelectorAll(".tpl-card img, .tpl-card image").length, modal: !document.querySelector("#modal").classList.contains("hidden")})');
          console.log('page', JSON.stringify(info));
          if (process.env.DECKLY_SMOKE_JS) console.log('test', JSON.stringify(await win.webContents.executeJavaScript(fs.readFileSync(process.env.DECKLY_SMOKE_JS, 'utf8'))));
          win.focus();
          fs.writeFileSync(process.env.DECKLY_SMOKE, (await win.webContents.capturePage()).toPNG());
          console.log('smoke ok');
        } catch (e) { console.log('smoke error', e.message); }
        flushed = true; app.quit();
      }, +process.env.DECKLY_SMOKE_WAIT || 8000);
    }
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { try { fs.unlinkSync(connFile()); } catch { /* */ } });
}

// ---------- updates ----------
// The person chooses once: "auto" (download + install by themselves, recommended) or "manual" (we ask each time).
let updater = null, state = { status: 'idle' }, lastCheck = 0;
const send = (s) => { state = { ...state, ...s }; safeSend('updates:event', state); };
function setupUpdates() {
  if (app.isPackaged) {
    try { updater = require('electron-updater').autoUpdater; } catch { updater = null; }
  }
  if (updater) {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = readSettings().updateMode === 'auto';
    updater.on('checking-for-update', () => send({ status: 'checking' }));
    updater.on('update-not-available', () => send({ status: 'uptodate' }));
    updater.on('update-available', (i) => {
      send({ status: 'available', version: i.version, notes: typeof i.releaseNotes === 'string' ? i.releaseNotes.replace(/<[^>]+>/g, '').slice(0, 400) : '' });
      if (readSettings().updateMode === 'auto') download();
    });
    updater.on('download-progress', (p) => send({ status: 'downloading', percent: Math.round(p.percent) }));
    updater.on('update-downloaded', (i) => send({ status: 'ready', version: i.version }));
    updater.on('error', (e) => send({ status: 'error', message: String(e?.message || e).split('\n')[0] }));
  }
  setInterval(() => check(false), 4 * 3600 * 1000);
}
async function check(manual) {
  if (!updater) { if (manual) send({ status: 'unavailable' }); return; }
  if (!readSettings().updateMode && !manual) return;
  if (!manual && Date.now() - lastCheck < 20 * 60 * 1000) return;
  if (state.status === 'downloading' && Date.now() - (state.since || 0) > 30 * 60 * 1000) state = { status: 'available', version: state.version }; // a download that never ended
  if (['downloading', 'ready'].includes(state.status)) { send({}); return; }
  lastCheck = Date.now();
  try { await updater.checkForUpdates(); } catch (e) { send({ status: 'error', message: String(e?.message || e).split('\n')[0] }); }
}
function download() { if (updater && state.status === 'available') { send({ status: 'downloading', percent: 0, since: Date.now() }); updater.downloadUpdate().catch((e) => send({ status: 'error', message: String(e?.message || e) })); } }
ipcMain.handle('updates:info', () => ({ mode: readSettings().updateMode || null, version: app.getVersion(), desktop: true, enabled: !!updater, state }));
ipcMain.handle('updates:setMode', (_e, mode) => {
  if (!['auto', 'manual'].includes(mode)) return false;
  writeSettings({ ...readSettings(), updateMode: mode });
  if (updater) updater.autoInstallOnAppQuit = mode === 'auto';
  check(true);
  return true;
});
ipcMain.handle('updates:check', (_e, manual) => check(!!manual));
ipcMain.handle('updates:download', () => download());
ipcMain.handle('updates:install', () => { if (updater && state.status === 'ready') { flushed = true; setImmediate(() => updater.quitAndInstall(false, true)); } });

// ---------- Claude connector ----------
// A local server (127.0.0.1, random port, secret token) that desktop/mcp.cjs — the MCP server Claude runs —
// calls; every call is answered by the page. The port and token live in the app's data folder.
const connFile = () => path.join(app.getPath('userData'), 'connector.json');
const mcpScript = () => (app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked', 'desktop', 'mcp.cjs') : path.join(__dirname, 'mcp.cjs'));
const pending = new Map();
function startConnector() {
  const token = crypto.randomBytes(24).toString('hex');
  const server = http.createServer((req, res) => {
    const reply = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.method !== 'POST' || req.url !== '/call' || req.headers['x-deckly-token'] !== token) return reply(403, { ok: false, error: 'forbidden' });
    let body = ''; req.on('data', (c) => { body += c; if (body.length > 50e6) req.destroy(); });
    req.on('end', async () => {
      let call; try { call = JSON.parse(body); } catch { return reply(400, { ok: false, error: 'bad json' }); }
      if (call.tool === 'ping') return reply(200, { pong: true, version: app.getVersion() });
      if (!win || win.webContents.isDestroyed()) return reply(503, { ok: false, error: 'Deckly window is closed' });
      if (win.isMinimized()) win.restore();
      const id = crypto.randomUUID();
      const timer = setTimeout(() => { pending.delete(id); reply(504, { ok: false, error: 'Deckly did not answer' }); }, 120000);
      pending.set(id, (result) => { clearTimeout(timer); reply(200, result); });
      safeSend('mcp:call', { id, tool: call.tool, args: call.args || {} });
    });
  });
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(connFile(), JSON.stringify({ port, token, pid: process.pid, started: Date.now(), exe: process.execPath, script: mcpScript(), version: app.getVersion() }, null, 1));
  });
}
ipcMain.on('mcp:result', (_e, id, result) => { const cb = pending.get(id); if (cb) { pending.delete(id); cb(result); } });
// Claude Desktop reads its connectors from this file
const claudeConfig = () => path.join(app.getPath('appData'), 'Claude', 'claude_desktop_config.json');
const serverEntry = () => ({ command: process.execPath, args: [mcpScript()], env: { ELECTRON_RUN_AS_NODE: '1' } });
const codeCommand = () => `claude mcp add deckly -e ELECTRON_RUN_AS_NODE=1 -- "${process.execPath}" "${mcpScript()}"`;
ipcMain.handle('connector:info', () => {
  let cfg = null; try { cfg = JSON.parse(fs.readFileSync(claudeConfig(), 'utf8')); } catch { /* */ }
  const claudeDesktop = fs.existsSync(path.dirname(claudeConfig()));
  return { claudeDesktop, installed: !!cfg?.mcpServers?.deckly, codeCommand: codeCommand(), script: mcpScript(), exe: process.execPath };
});
ipcMain.handle('connector:install', (_e, on) => {
  try {
    let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(claudeConfig(), 'utf8')); } catch { /* new file */ }
    cfg.mcpServers = cfg.mcpServers || {};
    if (on) cfg.mcpServers.deckly = serverEntry(); else delete cfg.mcpServers.deckly;
    fs.mkdirSync(path.dirname(claudeConfig()), { recursive: true });
    fs.writeFileSync(claudeConfig(), JSON.stringify(cfg, null, 2));
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});
// files Claude asks for go to Documents (or the path it gives, inside the user's own folders)
ipcMain.handle('connector:writeFile', (_e, where, base64, ext, title) => {
  const home = app.getPath('home');
  let file = where ? path.resolve(String(where)) : path.join(app.getPath('documents'), `${String(title || 'presentation').replace(/[\\/:*?"<>|]+/g, '').trim() || 'presentation'}.${ext}`);
  if (!file.toLowerCase().endsWith('.' + ext)) file += '.' + ext;
  if (!file.startsWith(home) && !file.startsWith(app.getPath('temp'))) throw new Error('Deckly only writes inside your own folders');
  const data = Buffer.from(String(base64), 'base64');
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); return file; }
  catch (e) {
    // Windows "Controlled folder access" can refuse Documents to a new program: the file goes to Deckly's own folder instead
    const alt = path.join(app.getPath('userData'), 'Exports', path.basename(file));
    fs.mkdirSync(path.dirname(alt), { recursive: true }); fs.writeFileSync(alt, data);
    return alt;
  }
});
