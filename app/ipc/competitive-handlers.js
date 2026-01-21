/**
 * Sameko Dev C++ IDE - Competitive Programming IPC Handlers
 * Handles CP Companion and batch testing
 * @module app/ipc/competitive-handlers
 */

'use strict';

const { ipcMain } = require('electron');
const competitive = require('../services/competitive');

/** @type {import('electron').BrowserWindow|null} */
let mainWindow = null;

// ============================================================================
// SETUP
// ============================================================================

/**
 * Set main window reference
 * @param {import('electron').BrowserWindow} window
 */
function setMainWindow(window) {
    mainWindow = window;

    // Setup callbacks
    competitive.setOnProblemReceived((problem) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('problem-received', problem);
        }
    });

    competitive.setOnFocusWindow(() => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.setAlwaysOnTop(true);
            mainWindow.show();
            mainWindow.focus();
            mainWindow.setAlwaysOnTop(false);
            if (!mainWindow.isFocused()) mainWindow.flashFrame(true);
        }
    });
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

/**
 * Register all competitive programming IPC handlers
 */
function registerHandlers() {
    // CP Companion server control
    ipcMain.handle('cc-start-server', async () => {
        return await competitive.startServer();
    });

    ipcMain.handle('cc-stop-server', async () => {
        return competitive.stopServer();
    });

    ipcMain.handle('cc-get-status', async () => {
        return competitive.getServerStatus();
    });

    ipcMain.handle('cc-open-extension-page', async () => {
        return competitive.openExtensionPage();
    });

    // Batch testing
    ipcMain.handle('run-test', async (event, { exePath, input, expectedOutput, timeLimit, cwd }) => {
        return await competitive.runTest({ exePath, input, expectedOutput, timeLimit, cwd });
    });


}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    registerHandlers,
    setMainWindow,
};
