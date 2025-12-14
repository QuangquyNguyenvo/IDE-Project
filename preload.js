const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // File operations
    openFile: () => ipcRenderer.invoke('open-file-dialog'),
    saveFile: (data) => ipcRenderer.invoke('save-file', data),
    saveFileDialog: (content) => ipcRenderer.invoke('save-file-dialog', content),
    getCurrentFile: () => ipcRenderer.invoke('get-current-file'),

    // Build operations
    compile: (data) => ipcRenderer.invoke('compile', data),
    run: (exePath) => ipcRenderer.invoke('run', exePath),
    sendInput: (input) => ipcRenderer.invoke('send-input', input),
    stopProcess: () => ipcRenderer.invoke('stop-process'),

    // Window controls (for frameless window)
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),

    // Event listeners
    onFileOpened: (callback) => ipcRenderer.on('file-opened', (event, data) => callback(data)),
    onSaveFileAs: (callback) => ipcRenderer.on('save-file-as', (event, path) => callback(path)),
    onMenuNew: (callback) => ipcRenderer.on('menu-new', () => callback()),
    onMenuSave: (callback) => ipcRenderer.on('menu-save', () => callback()),
    onMenuCompile: (callback) => ipcRenderer.on('menu-compile', () => callback()),
    onMenuRun: (callback) => ipcRenderer.on('menu-run', () => callback()),
    onMenuCompileRun: (callback) => ipcRenderer.on('menu-compile-run', () => callback()),

    // Process events
    onProcessStarted: (callback) => ipcRenderer.on('process-started', () => callback()),
    onProcessOutput: (callback) => ipcRenderer.on('process-output', (event, data) => callback(data)),
    onProcessError: (callback) => ipcRenderer.on('process-error', (event, data) => callback(data)),
    onProcessExit: (callback) => ipcRenderer.on('process-exit', (event, code) => callback(code)),
    onProcessStopped: (callback) => ipcRenderer.on('process-stopped', () => callback())
});
