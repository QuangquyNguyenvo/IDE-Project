/**
 * Sameko Dev C++ IDE - History IPC Handlers
 * Handles local history/undo-redo operations for files
 * @module app/ipc/history-handlers
 */

'use strict';

const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { IPC } = require('../shared/constants');

let mainWindow = null;

const historyDir = path.join(app.getPath('userData'), 'local-history');

/**
 * Initialize history directory if it doesn't exist
 */
function initHistoryDir() {
    if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
    }
}

/**
 * Set main window reference for event communication
 * @param {BrowserWindow} window - Main application window
 */
function setMainWindow(window) {
    mainWindow = window;
}

/**
 * Get history directory path for a specific file
 * @param {string} filePath - Absolute file path
 * @returns {string} History directory for the file
 */
function getHistoryDirForFile(filePath) {
    const hash = require('crypto').createHash('sha256').update(filePath).digest('hex');
    return path.join(historyDir, hash);
}

/**
 * Save a history snapshot of file content
 * @param {string} filePath - Absolute file path
 * @param {string} content - File content to save
 * @param {string} timestamp - Timestamp of the change
 */
function saveHistorySnapshot(filePath, content, timestamp) {
    try {
        const fileHistoryDir = getHistoryDirForFile(filePath);
        
        if (!fs.existsSync(fileHistoryDir)) {
            fs.mkdirSync(fileHistoryDir, { recursive: true });
        }

        const snapshotFile = path.join(fileHistoryDir, `${timestamp}.snapshot`);
        fs.writeFileSync(snapshotFile, content, 'utf-8');
    } catch (error) {
        console.error(`[History] Failed to save snapshot:`, error.message);
    }
}

/**
 * Get all history snapshots for a file
 * @param {string} filePath - Absolute file path
 * @returns {Array} Array of history entries with timestamp and size
 */
function getFileHistory(filePath) {
    try {
        const fileHistoryDir = getHistoryDirForFile(filePath);
        
        if (!fs.existsSync(fileHistoryDir)) {
            return [];
        }

        const files = fs.readdirSync(fileHistoryDir);
        return files
            .filter(f => f.endsWith('.snapshot'))
            .map(f => ({
                timestamp: f.replace('.snapshot', ''),
                filename: f,
                path: path.join(fileHistoryDir, f),
                stats: fs.statSync(path.join(fileHistoryDir, f))
            }))
            .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
    } catch (error) {
        console.error(`[History] Failed to get history:`, error.message);
        return [];
    }
}

/**
 * Restore a file from a specific history snapshot
 * @param {string} filePath - Absolute file path
 * @param {string} timestamp - Timestamp of snapshot to restore
 * @returns {string|null} File content or null if failed
 */
function restoreSnapshot(filePath, timestamp) {
    try {
        const fileHistoryDir = getHistoryDirForFile(filePath);
        const snapshotFile = path.join(fileHistoryDir, `${timestamp}.snapshot`);
        
        if (!fs.existsSync(snapshotFile)) {
            return null;
        }

        return fs.readFileSync(snapshotFile, 'utf-8');
    } catch (error) {
        console.error(`[History] Failed to restore snapshot:`, error.message);
        return null;
    }
}

/**
 * Delete a specific history snapshot
 * @param {string} filePath - Absolute file path
 * @param {string} timestamp - Timestamp of snapshot to delete
 */
function deleteSnapshot(filePath, timestamp) {
    try {
        const fileHistoryDir = getHistoryDirForFile(filePath);
        const snapshotFile = path.join(fileHistoryDir, `${timestamp}.snapshot`);
        
        if (fs.existsSync(snapshotFile)) {
            fs.unlinkSync(snapshotFile);
        }
    } catch (error) {
        console.error(`[History] Failed to delete snapshot:`, error.message);
    }
}

/**
 * Clear all history for a specific file
 * @param {string} filePath - Absolute file path
 */
function clearFileHistory(filePath) {
    try {
        const fileHistoryDir = getHistoryDirForFile(filePath);
        
        if (fs.existsSync(fileHistoryDir)) {
            fs.rmSync(fileHistoryDir, { recursive: true, force: true });
        }
    } catch (error) {
        console.error(`[History] Failed to clear history:`, error.message);
    }
}

/**
 * Cleanup old history snapshots (keep only recent ones)
 * @param {string} filePath - Absolute file path
 * @param {number} maxSnapshots - Maximum number of snapshots to keep (default: 50)
 */
function cleanupOldSnapshots(filePath, maxSnapshots = 50) {
    try {
        const history = getFileHistory(filePath);
        
        if (history.length > maxSnapshots) {
            const toDelete = history.slice(maxSnapshots);
            toDelete.forEach(entry => {
                deleteSnapshot(filePath, entry.timestamp);
            });
        }
    } catch (error) {
        console.error(`[History] Failed to cleanup snapshots:`, error.message);
    }
}

/**
 * Register all history-related IPC handlers
 */
function registerHistoryHandlers() {
    initHistoryDir();

    /**
     * Create history backup before saving (matches preload.js)
     * Request: { filePath, content, maxVersions?, maxAgeDays? }
     * Response: { success: boolean, backupPath?: string, error?: string }
     */
    ipcMain.handle('create-history-backup', async (event, { filePath, content, maxVersions, maxAgeDays }) => {
        try {
            const ts = Date.now().toString();
            saveHistorySnapshot(filePath, content, ts);
            cleanupOldSnapshots(filePath, maxVersions || 20);
            
            const fileHistoryDir = getHistoryDirForFile(filePath);
            const backupPath = path.join(fileHistoryDir, `${ts}.snapshot`);
            
            return { success: true, timestamp: ts, backupPath };
        } catch (error) {
            console.error('[History] Backup failed:', error.message);
            return { success: false, error: error.message };
        }
    });

    /**
     * Save a history snapshot (legacy)
     * Request: { filePath, content, timestamp? }
     * Response: { success: boolean, error?: string }
     */
    ipcMain.handle(IPC.HISTORY?.SAVE || 'history-save', async (event, { filePath, content, timestamp }) => {
        try {
            const ts = timestamp || Date.now().toString();
            saveHistorySnapshot(filePath, content, ts);
            cleanupOldSnapshots(filePath);
            return { success: true, timestamp: ts };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    /**
     * Get all history snapshots for a file (matches preload.js)
     * Request: filePath (string)
     * Response: { success: boolean, entries: Array }
     */
    ipcMain.handle('get-file-history', async (event, filePath) => {
        try {
            const history = getFileHistory(filePath);
            return {
                success: true,
                entries: history.map(h => ({
                    timestamp: h.timestamp,
                    filename: h.filename,
                    path: h.path,
                    size: `${Math.round(h.stats.size / 1024)} KB`,
                    formattedTime: new Date(parseInt(h.timestamp)).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    })
                }))
            };
        } catch (error) {
            console.error('[History] Get history failed:', error.message);
            return { success: false, error: error.message, entries: [] };
        }
    });

    /**
     * Get all history snapshots for a file (legacy)
     * Request: { filePath }
     * Response: Array of { timestamp, filename, size }
     */
    ipcMain.handle(IPC.HISTORY?.GET_HISTORY || 'history-get', async (event, { filePath }) => {
        try {
            const history = getFileHistory(filePath);
            return {
                success: true,
                history: history.map(h => ({
                    timestamp: h.timestamp,
                    filename: h.filename,
                    size: h.stats.size,
                    mtime: h.stats.mtime
                }))
            };
        } catch (error) {
            return { success: false, error: error.message, history: [] };
        }
    });

    /**
     * Get history content (matches preload.js)
     * Request: backupPath (string)
     * Response: { success: boolean, content?: string }
     */
    ipcMain.handle('get-history-content', async (event, backupPath) => {
        try {
            if (!fs.existsSync(backupPath)) {
                return { success: false, error: 'Backup file not found' };
            }
            const content = fs.readFileSync(backupPath, 'utf-8');
            return { success: true, content };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    /**
     * Clear file history (matches preload.js)
     * Request: filePath (string)
     * Response: { success: boolean }
     */
    ipcMain.handle('clear-file-history', async (event, filePath) => {
        try {
            clearFileHistory(filePath);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    /**
     * Restore a file from a history snapshot
     * Request: { filePath, timestamp }
     * Response: { success: boolean, content?: string, error?: string }
     */
    ipcMain.handle(IPC.HISTORY?.RESTORE || 'history-restore', async (event, { filePath, timestamp }) => {
        try {
            const content = restoreSnapshot(filePath, timestamp);
            if (content === null) {
                return { success: false, error: 'Snapshot not found' };
            }
            return { success: true, content };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    /**
     * Delete a specific history snapshot
     * Request: { filePath, timestamp }
     * Response: { success: boolean, error?: string }
     */
    ipcMain.handle(IPC.HISTORY?.DELETE || 'history-delete', async (event, { filePath, timestamp }) => {
        try {
            deleteSnapshot(filePath, timestamp);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    /**
     * Clear all history for a file (legacy)
     * Request: { filePath }
     * Response: { success: boolean, error?: string }
     */
    ipcMain.handle(IPC.HISTORY?.CLEAR || 'history-clear', async (event, { filePath }) => {
        try {
            clearFileHistory(filePath);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    console.log('[IPC] History handlers registered');
}

module.exports = {
    setMainWindow,
    registerHistoryHandlers,
    saveHistorySnapshot,
    getFileHistory,
    restoreSnapshot,
    deleteSnapshot,
    clearFileHistory,
    cleanupOldSnapshots,
    getHistoryDirForFile,
};
