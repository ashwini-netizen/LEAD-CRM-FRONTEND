// Electron Preload Script
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  savePDF: (filename, base64Data) => ipcRenderer.invoke('save-pdf', { filename, base64Data }),
  isElectron: true,
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Electron preload script loaded successfully.');
});
