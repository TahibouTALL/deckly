// Gives the page a small, safe bridge to the desktop features: updates, .dkly files and the Claude connector.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('decklyDesktop', {
  info: () => ipcRenderer.invoke('updates:info'),
  setMode: (mode) => ipcRenderer.invoke('updates:setMode', mode),
  check: (manual) => ipcRenderer.invoke('updates:check', manual),
  download: () => ipcRenderer.invoke('updates:download'),
  install: () => ipcRenderer.invoke('updates:install'),
  onEvent: (fn) => ipcRenderer.on('updates:event', (_e, s) => fn(s)),
  // .dkly files: a file opened from Windows arrives here; saving uses Windows' "Save as" window
  onOpenFile: (fn) => { ipcRenderer.on('file:open', (_e, bytes) => fn(bytes)); ipcRenderer.send('file:ready'); },
  saveFile: (name, bytes) => ipcRenderer.invoke('file:save', name, bytes),
  // the app is asked to save everything before closing
  onFlush: (fn) => ipcRenderer.on('app:flush', async () => { try { await fn(); } finally { ipcRenderer.send('app:flushed'); } }),
  // Claude connector: tool calls arrive from the MCP server through the main process
  connector: {
    info: () => ipcRenderer.invoke('connector:info'),
    install: (on) => ipcRenderer.invoke('connector:install', on),
    onCall: (fn) => ipcRenderer.on('mcp:call', (_e, call) => fn(call)),
    reply: (id, result) => ipcRenderer.send('mcp:result', id, result),
    writeFile: (where, base64, ext, title) => ipcRenderer.invoke('connector:writeFile', where, base64, ext, title),
  },
});
