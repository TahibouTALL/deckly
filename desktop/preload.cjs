// Gives the page a small, safe bridge to the desktop features: updates and .dkly files.
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
});
