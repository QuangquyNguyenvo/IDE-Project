/**
 * Sameko Dev C++ IDE - Local History Manager
 * File version history and backup
 * 
 * @module src/features/local-history/history-manager
 */

// ============================================================================
// HISTORY FUNCTIONS
// ============================================================================

/**
 * Create history backup before saving
 * @param {string} filePath
 * @param {string} content
 */
async function createBackup(filePath, content) {
    try {
        await window.electronAPI?.createHistoryBackup?.({
            filePath,
            content,
            timestamp: Date.now()
        });
    } catch (e) {
        console.error('[History] Backup failed:', e);
    }
}

/**
 * Get file history
 * @param {string} filePath
 * @returns {Promise<Array>}
 */
async function getFileHistory(filePath) {
    try {
        return await window.electronAPI?.getFileHistory?.(filePath) || [];
    } catch (e) {
        console.error('[History] Get history failed:', e);
        return [];
    }
}

/**
 * Get content of a history backup
 * @param {string} backupPath
 * @returns {Promise<string>}
 */
async function getHistoryContent(backupPath) {
    try {
        return await window.electronAPI?.getHistoryContent?.(backupPath) || '';
    } catch (e) {
        console.error('[History] Get content failed:', e);
        return '';
    }
}

/**
 * Clear history for a file
 * @param {string} filePath
 */
async function clearHistory(filePath) {
    try {
        await window.electronAPI?.clearFileHistory?.(filePath);
    } catch (e) {
        console.error('[History] Clear failed:', e);
    }
}

/**
 * Restore from backup
 * @param {string} backupPath
 * @param {monaco.editor.IStandaloneCodeEditor} editor
 */
async function restoreBackup(backupPath, editor) {
    const content = await getHistoryContent(backupPath);
    if (content && editor) {
        editor.setValue(content);
    }
}

/**
 * Format timestamp for display
 * @param {number} timestamp
 * @returns {string}
 */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createBackup, getFileHistory, getHistoryContent, clearHistory, restoreBackup, formatTimestamp };
}

if (typeof window !== 'undefined') {
    window.HistoryManager = { createBackup, getFileHistory, getHistoryContent, clearHistory, restoreBackup, formatTimestamp };
}
