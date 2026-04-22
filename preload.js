const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cursorcats', {
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  readTextFile: (relPath) => ipcRenderer.invoke('read-text-file', relPath),
  getAssetFileUrl: (relPath) => ipcRenderer.invoke('get-asset-file-url', relPath),
});
