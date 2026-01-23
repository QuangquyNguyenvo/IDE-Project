/**
 * Sameko Dev C++ IDE - Settings IPC Handlers
 * Handles settings persistence
 * @module app/ipc/settings-handlers
 */

'use strict';

const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { IPC } = require('../shared/constants');

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function registerHandlers() {
    ipcMain.handle(IPC.SETTINGS.SAVE, async (event, settings) => {
        try {
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
            return { success: true };
        } catch (error) {
            console.error('Failed to save settings:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.on(IPC.SETTINGS.LOAD, (event) => {
        try {
            if (fs.existsSync(settingsPath)) {
                const data = fs.readFileSync(settingsPath, 'utf-8');
                event.returnValue = JSON.parse(data);
            } else {
                event.returnValue = null;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            event.returnValue = null;
        }
    });

    ipcMain.handle('get-current-version', async () => {
        return app.getVersion();
    });

}

module.exports = {
    registerHandlers,
};
