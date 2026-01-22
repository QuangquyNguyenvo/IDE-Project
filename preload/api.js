/**
 * Sameko Dev C++ IDE - Preload API Definitions
 * 
 * Defines all APIs exposed to the renderer process.
 * Organized by feature category for maintainability.
 * 
 * @module preload/api
 */

const { ipcRenderer } = require('electron');

// ============================================================================
// FILE OPERATIONS
// ============================================================================
const file = {
    openFile: () => ipcRenderer.invoke('open-file-dialog'),
    saveFile: (data) => ipcRenderer.invoke('save-file', data),
    saveFileDialog: (content) => ipcRenderer.invoke('save-file-dialog', content),
    getCurrentFile: () => ipcRenderer.invoke('get-current-file'),

    // File Explorer
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    renameFile: (oldPath, newPath) => ipcRenderer.invoke('rename-file', { oldPath, newPath }),
    deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
    showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),

    // File watching
    watchFile: (filePath) => ipcRenderer.invoke('watch-file', filePath),
    unwatchFile: (filePath) => ipcRenderer.invoke('unwatch-file', filePath),
    reloadFile: (filePath) => ipcRenderer.invoke('reload-file', filePath),
    onFileChangedExternal: (callback) => ipcRenderer.on('file-changed-external', (event, data) => callback(data)),
};

// ============================================================================
// SETTINGS
// ============================================================================
const settings = {
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    loadSettings: () => ipcRenderer.sendSync('load-settings'),
};

// ============================================================================
// BUILD OPERATIONS
// ============================================================================
const build = {
    compile: (data) => ipcRenderer.invoke('compile', data),
    run: (data) => ipcRenderer.invoke('run', data),
    sendInput: (input) => ipcRenderer.invoke('send-input', input),
    stopProcess: () => ipcRenderer.invoke('stop-process'),
    getCompilerInfo: () => ipcRenderer.invoke('get-compiler-info'),

    // Process events
    onProcessStarted: (callback) => ipcRenderer.on('process-started', () => callback()),
    onProcessOutput: (callback) => ipcRenderer.on('process-output', (event, data) => callback(data)),
    onProcessError: (callback) => ipcRenderer.on('process-error', (event, data) => callback(data)),
    onProcessExit: (callback) => ipcRenderer.on('process-exit', (event, data) => callback(data)),
    onProcessStopped: (callback) => ipcRenderer.on('process-stopped', () => callback()),
};

// ============================================================================
// WINDOW CONTROLS
// ============================================================================
const window = {
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),
};

// ============================================================================
// CODE FORMATTING & SYNTAX
// ============================================================================
const format = {
    formatCode: (code, style) => ipcRenderer.invoke('format-code', { code, style }),
    checkAStyle: () => ipcRenderer.invoke('check-astyle'),
    syntaxCheck: (content, filePath) => ipcRenderer.invoke('syntax-check', { content, filePath }),
};

// ============================================================================
// COMPETITIVE PROGRAMMING
// ============================================================================
const competitive = {
    ccStartServer: () => ipcRenderer.invoke('cc-start-server'),
    ccStopServer: () => ipcRenderer.invoke('cc-stop-server'),
    ccGetStatus: () => ipcRenderer.invoke('cc-get-status'),
    ccOpenExtensionPage: () => ipcRenderer.invoke('cc-open-extension-page'),
    onProblemReceived: (callback) => ipcRenderer.on('problem-received', (event, data) => callback(data)),
    runTest: (data) => ipcRenderer.invoke('run-test', data),
};

// ============================================================================
// LOCAL HISTORY
// ============================================================================
const history = {
    createHistoryBackup: (data) => ipcRenderer.invoke('create-history-backup', data),
    getFileHistory: (filePath) => ipcRenderer.invoke('get-file-history', filePath),
    getHistoryContent: (backupPath) => ipcRenderer.invoke('get-history-content', backupPath),
    clearFileHistory: (filePath) => ipcRenderer.invoke('clear-file-history', filePath),
};

// ============================================================================
// AUTO-UPDATE
// ============================================================================
const update = {
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, data) => callback(data)),
    getCurrentVersion: () => ipcRenderer.invoke('get-current-version'),
    openReleasePage: (url) => ipcRenderer.invoke('open-release-page', url),
};

// ============================================================================
// MENU EVENTS
// ============================================================================
const menu = {
    onFileOpened: (callback) => ipcRenderer.on('file-opened', (event, data) => callback(data)),
    onSaveFileAs: (callback) => ipcRenderer.on('save-file-as', (event, path) => callback(path)),
    onMenuNew: (callback) => ipcRenderer.on('menu-new', () => callback()),
    onMenuSave: (callback) => ipcRenderer.on('menu-save', () => callback()),
    onMenuCompile: (callback) => ipcRenderer.on('menu-compile', () => callback()),
    onMenuRun: (callback) => ipcRenderer.on('menu-run', () => callback()),
    onMenuCompileRun: (callback) => ipcRenderer.on('menu-compile-run', () => callback()),
};

// ============================================================================
// SYSTEM
// ============================================================================
const system = {
    onSystemMessage: (callback) => ipcRenderer.on('system-message', (event, data) => callback(data)),
    getSystemVersions: () => process.versions,
};

// ============================================================================
// FLAT API (for backward compatibility)
// ============================================================================
module.exports = {
    // File
    ...file,

    // Settings
    ...settings,

    // Build
    ...build,

    // Window
    ...window,

    // Format
    ...format,

    // Competitive
    ...competitive,

    // History
    ...history,

    // Update
    ...update,

    // Menu events
    ...menu,

    // System
    ...system,
};
