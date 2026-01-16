/**
 * Sameko Dev C++ IDE - Format IPC Handlers
 * Handles code formatting and syntax checking
 * @module app/ipc/format-handlers
 */

'use strict';

const { ipcMain } = require('electron');
const { IPC } = require('../../shared/constants');
const formatter = require('../services/formatter');
const syntax = require('../services/syntax');

// ============================================================================
// IPC HANDLERS
// ============================================================================

/**
 * Register all format-related IPC handlers
 */
function registerHandlers() {
    // Format code
    ipcMain.handle(IPC.FORMAT.CODE, async (event, { code, style = 'google' }) => {
        return await formatter.formatCode(code, style);
    });

    // Check AStyle availability
    ipcMain.handle('check-astyle', async () => {
        return formatter.checkAStyle();
    });

    // Syntax check
    ipcMain.handle(IPC.FORMAT.SYNTAX_CHECK, async (event, { content, filePath }) => {
        return await syntax.checkSyntax(content, filePath);
    });

    console.log('[IPC] Format handlers registered');
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    registerHandlers,
};
