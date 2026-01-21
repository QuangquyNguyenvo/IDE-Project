/**
 * Sameko Dev C++ IDE - File IPC Handlers
 * Handles file operations: open, save, read, delete, etc.
 * @module app/ipc/file-handlers
 */

'use strict';

const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { IPC } = require('../../shared/constants');

/** @type {import('electron').BrowserWindow|null} */
let mainWindow = null;

/** @type {string|null} */
let currentFile = null;

/** @type {Map<string, {watcher: fs.FSWatcher, mtime: number}>} */
const fileWatchers = new Map();

// ============================================================================
// SETUP
// ============================================================================

/**
 * Set main window reference
 * @param {import('electron').BrowserWindow} window
 */
function setMainWindow(window) {
    mainWindow = window;
}

/**
 * Get current file path
 * @returns {string|null}
 */
function getCurrentFile() {
    return currentFile;
}

// ============================================================================
// FILE WATCHING
// ============================================================================

/**
 * Watch a file for external changes
 * @param {string} filePath
 */
function watchFile(filePath) {
    if (!filePath || fileWatchers.has(filePath)) return;

    try {
        const stats = fs.statSync(filePath);
        const watcher = fs.watch(filePath, (eventType) => {
            if (eventType === 'change') {
                const current = fileWatchers.get(filePath);
                if (!current) return;

                try {
                    const newStats = fs.statSync(filePath);
                    const newMtime = newStats.mtimeMs;

                    if (newMtime !== current.mtime) {
                        current.mtime = newMtime;
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send(IPC.EVENTS.FILE_CHANGED_EXTERNAL, { path: filePath });
                        }
                    }
                } catch (e) {
                    // File might be deleted
                }
            }
        });

        fileWatchers.set(filePath, { watcher, mtime: stats.mtimeMs });
    } catch (e) {
        console.error(`[FileWatcher] Cannot watch: ${filePath}`, e.message);
    }
}

/**
 * Stop watching a file
 * @param {string} filePath
 */
function unwatchFile(filePath) {
    const entry = fileWatchers.get(filePath);
    if (entry) {
        entry.watcher.close();
        fileWatchers.delete(filePath);
    }
}

/**
 * Update file watcher mtime (call after saving)
 * @param {string} filePath
 */
function updateFileWatcherMtime(filePath) {
    const entry = fileWatchers.get(filePath);
    if (entry) {
        try {
            const stats = fs.statSync(filePath);
            entry.mtime = stats.mtimeMs;
        } catch (e) { }
    }
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

/**
 * Register all file-related IPC handlers
 */
function registerHandlers() {
    // Open file dialog
    ipcMain.handle(IPC.FILE.OPEN_DIALOG, async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile', 'multiSelections'],
            filters: [
                { name: 'C++ Files', extensions: ['cpp', 'c', 'h', 'hpp', 'cc', 'cxx'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
            for (const filePath of result.filePaths) {
                const content = fs.readFileSync(filePath, 'utf-8');
                currentFile = filePath;
                mainWindow.webContents.send(IPC.EVENTS.FILE_OPENED, { path: filePath, content });
            }
        }
    });

    // Save file
    ipcMain.handle(IPC.FILE.SAVE, async (event, { path: filePath, content }) => {
        try {
            fs.writeFileSync(filePath, content, 'utf-8');
            currentFile = filePath;
            updateFileWatcherMtime(filePath);
            return { success: true, path: filePath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Save file dialog
    ipcMain.handle(IPC.FILE.SAVE_DIALOG, async (event, content) => {
        const result = await dialog.showSaveDialog(mainWindow, {
            filters: [
                { name: 'C++ Files', extensions: ['cpp'] },
                { name: 'C Files', extensions: ['c'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (!result.canceled) {
            try {
                fs.writeFileSync(result.filePath, content, 'utf-8');
                currentFile = result.filePath;
                return { success: true, path: result.filePath };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }
        return { success: false, canceled: true };
    });

    // Read file
    ipcMain.handle(IPC.FILE.READ, async (event, filePath) => {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return content;
        } catch (error) {
            throw new Error(`Cannot read file: ${error.message}`);
        }
    });

    // Read directory
    ipcMain.handle(IPC.FILE.READ_DIR, async (event, dirPath) => {
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            return entries.map(entry => ({
                name: entry.name,
                isDirectory: entry.isDirectory(),
                isFile: entry.isFile()
            }));
        } catch (error) {
            console.error('[FileExplorer] read-directory error:', error);
            return [];
        }
    });

    // Delete file
    ipcMain.handle(IPC.FILE.DELETE, async (event, filePath) => {
        try {
            fs.unlinkSync(filePath);
            return { success: true };
        } catch (error) {
            throw new Error(`Cannot delete file: ${error.message}`);
        }
    });

    // Rename file
    ipcMain.handle(IPC.FILE.RENAME, async (event, { oldPath, newPath }) => {
        try {
            fs.renameSync(oldPath, newPath);
            return { success: true };
        } catch (error) {
            throw new Error(`Cannot rename file: ${error.message}`);
        }
    });

    // Watch/Unwatch file
    ipcMain.handle(IPC.FILE.WATCH, async (event, filePath) => {
        watchFile(filePath);
        return { success: true };
    });

    ipcMain.handle(IPC.FILE.UNWATCH, async (event, filePath) => {
        unwatchFile(filePath);
        return { success: true };
    });

    // Reload file
    ipcMain.handle(IPC.FILE.RELOAD, async (event, filePath) => {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            updateFileWatcherMtime(filePath);
            return { success: true, content };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // Show in folder
    ipcMain.handle(IPC.FILE.SHOW_IN_FOLDER, async (event, filePath) => {
        try {
            shell.showItemInFolder(filePath);
            return { success: true };
        } catch (error) {
            throw new Error(`Cannot show item in folder: ${error.message}`);
        }
    });


}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    registerHandlers,
    setMainWindow,
    getCurrentFile,
    watchFile,
    unwatchFile,
    updateFileWatcherMtime,
};
