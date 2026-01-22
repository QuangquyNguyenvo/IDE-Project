/**
 * IPC Handlers for Auto Updates
 * Handles update checking, downloading, and installing
 * @module app/ipc/update-handlers
 */

'use strict';

const { ipcMain } = require('electron');
const autoUpdateService = require('../services/auto-update-service');

/**
 * Register all update-related IPC handlers
 */
function registerUpdateHandlers() {
    // Check for updates
    ipcMain.handle('check-for-updates', async (event) => {
        try {
            await autoUpdateService.checkForUpdates(true);
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error.message 
            };
        }
    });

    // Download update
    ipcMain.handle('download-update', async (event) => {
        try {
            await autoUpdateService.downloadUpdate();
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error.message 
            };
        }
    });

    // Quit and install update
    ipcMain.handle('quit-and-install', (event) => {
        autoUpdateService.quitAndInstall();
        return { success: true };
    });

    // Get update status
    ipcMain.handle('get-update-status', (event) => {
        return autoUpdateService.getStatus();
    });

    console.log('[IPC] Update handlers registered');
}

module.exports = registerUpdateHandlers;
