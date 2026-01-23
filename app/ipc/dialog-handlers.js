/**
 * Sameko Dev C++ IDE - Dialog IPC Handlers
 * Handles file/folder dialog operations
 * @module app/ipc/dialog-handlers
 */

'use strict';

const { ipcMain, dialog } = require('electron');
const { IPC } = require('../shared/constants');

let mainWindow = null;

function setMainWindow(window) {
    mainWindow = window;
}

/**
 * Register all dialog-related IPC handlers
 */
function registerHandlers() {
    // Show open dialog (folder picker, file picker with options)
    ipcMain.handle(IPC.DIALOG.SHOW_OPEN, async (event, options) => {
        try {
            const result = await dialog.showOpenDialog(mainWindow, options || {
                properties: ['openDirectory']
            });
            return result;
        } catch (error) {
            return { canceled: true, error: error.message };
        }
    });


}

module.exports = {
    registerHandlers,
    setMainWindow,
};
