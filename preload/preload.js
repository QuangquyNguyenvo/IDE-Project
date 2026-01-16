/**
 * Sameko Dev C++ IDE - Preload Script
 * 
 * Exposes a secure API to the renderer process via contextBridge.
 * All IPC communication between main and renderer is handled here.
 * 
 * @module preload
 */

const { contextBridge, ipcRenderer } = require('electron');
const api = require('./api');

// Expose API to renderer
contextBridge.exposeInMainWorld('electronAPI', api);

console.log('[Preload] API exposed to renderer');
