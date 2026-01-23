'use strict';

const { ipcMain } = require('electron');
const autoUpdateService = require('../services/auto-update-service');

function registerUpdateHandlers() {
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

    ipcMain.handle('quit-and-install', (event) => {
        autoUpdateService.quitAndInstall();
        return { success: true };
    });

    ipcMain.handle('get-update-status', (event) => {
        return autoUpdateService.getStatus();
    });

    console.log('[IPC] Update handlers registered');
}

module.exports = registerUpdateHandlers;
