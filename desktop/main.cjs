// Deckly desktop app (Electron): opens the editor in its own window and handles updates.
const { app, BrowserWindow, protocol, net, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const APP_DIR = path.join(__dirname, '..', 'app');
protocol.registerSchemesAsPrivileged([
  { scheme: 'deckly', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();
let win;

// ---------- settings (update choice) ----------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function readSettings() { try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; } }
function writeSettings(s) { fs.mkdirSync(path.dirname(settingsFile()), { recursive: true }); fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 1)); }

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
  // links to web pages open in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('deckly://')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  protocol.handle('deckly', (req) => {
    const p = decodeURIComponent(new URL(req.url).pathname);
    const file = path.normalize(path.join(APP_DIR, p === '/' ? 'index.html' : p));
    if (!file.startsWith(APP_DIR)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  setupUpdates();
  // Self-test for developers: DECKLY_SMOKE=<file.png> saves a picture of the window, prints page errors and quits.
  if (process.env.DECKLY_SMOKE) {
    // DECKLY_SMOKE_SIZE=1600x900: a fixed window size, for screenshots
    const sz = /^(\d+)x(\d+)$/.exec(process.env.DECKLY_SMOKE_SIZE || '');
    if (sz) win.once('show', () => { win.unmaximize(); win.setContentSize(+sz[1], +sz[2]); win.center(); });
    // DECKLY_SMOKE_ZOOM=0.67: renders the page smaller, like on a big monitor
    if (process.env.DECKLY_SMOKE_ZOOM) win.webContents.on('did-finish-load', () => win.webContents.setZoomFactor(+process.env.DECKLY_SMOKE_ZOOM));
    win.webContents.on('console-message', (e) => { if (e.level === 'error') console.log('[page error]', e.message); });
    setTimeout(async () => {
      try {
        const info = await win.webContents.executeJavaScript('({title: document.title, home: !document.querySelector("#home").classList.contains("hidden"), photos: document.querySelectorAll(".tpl-card img, .tpl-card image").length, modal: !document.querySelector("#modal").classList.contains("hidden")})');
        console.log('page', JSON.stringify(info));
        // DECKLY_SMOKE_JS=<file.js>: runs that test script in the page and prints its result
        if (process.env.DECKLY_SMOKE_JS) console.log('test', JSON.stringify(await win.webContents.executeJavaScript(fs.readFileSync(process.env.DECKLY_SMOKE_JS, 'utf8'))));
        win.focus();
        fs.writeFileSync(process.env.DECKLY_SMOKE, (await win.webContents.capturePage()).toPNG());
        console.log('smoke ok');
      } catch (e) { console.log('smoke error', e.message); }
      app.quit();
    }, 8000);
  }
});
app.on('window-all-closed', () => app.quit());

// ---------- updates ----------
// The person chooses once: "auto" (download + install by themselves, recommended) or "manual" (we ask each time).
// A check runs at start-up, every time the computer comes back online, and every 4 hours.
let updater = null, state = { status: 'idle' }, lastCheck = 0;
const send = (s) => { state = { ...state, ...s }; win?.webContents.send('updates:event', state); };

function setupUpdates() {
  if (app.isPackaged) {
    try { updater = require('electron-updater').autoUpdater; } catch { updater = null; }
  }
  if (updater) {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = true;
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
  if (!readSettings().updateMode && !manual) return;               // no choice made yet
  if (!manual && Date.now() - lastCheck < 20 * 60 * 1000) return;  // not more than every 20 minutes
  if (['downloading', 'ready'].includes(state.status)) { send({}); return; }
  lastCheck = Date.now();
  try { await updater.checkForUpdates(); } catch (e) { send({ status: 'error', message: String(e?.message || e).split('\n')[0] }); }
}
function download() { if (updater && state.status === 'available') { send({ status: 'downloading', percent: 0 }); updater.downloadUpdate().catch((e) => send({ status: 'error', message: String(e?.message || e) })); } }

ipcMain.handle('updates:info', () => ({ mode: readSettings().updateMode || null, version: app.getVersion(), desktop: true, enabled: !!updater, state }));
ipcMain.handle('updates:setMode', (_e, mode) => {
  if (!['auto', 'manual'].includes(mode)) return false;
  writeSettings({ ...readSettings(), updateMode: mode });
  check(true);
  return true;
});
ipcMain.handle('updates:check', (_e, manual) => check(!!manual));
ipcMain.handle('updates:download', () => download());
ipcMain.handle('updates:install', () => { if (updater && state.status === 'ready') setImmediate(() => updater.quitAndInstall(false, true)); });
