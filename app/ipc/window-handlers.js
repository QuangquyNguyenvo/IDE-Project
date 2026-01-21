/**
 * Sameko Dev C++ IDE - Window IPC Handlers
 * Handles window controls: minimize, maximize, close
 * @module app/ipc/window-handlers
 */

'use strict';

const { ipcMain } = require('electron');
const { IPC } = require('../../shared/constants');
const { minimizeWindow, toggleMaximize, closeWindow } = require('../core/window-manager');

// ============================================================================
// IPC HANDLERS
// ============================================================================

/**
 * Register all window-related IPC handlers
 */
function registerHandlers() {
    ipcMain.handle(IPC.WINDOW.MINIMIZE, () => {
        minimizeWindow();
    });

    ipcMain.handle(IPC.WINDOW.MAXIMIZE, () => {
        toggleMaximize();
    });

    ipcMain.handle(IPC.WINDOW.CLOSE, () => {
        closeWindow();
    });


}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    registerHandlers,
};
