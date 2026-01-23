'use strict';

require('v8-compile-cache');

const { app } = require('electron');
const { initializeApp, setupAppEvents } = require('./core/app-lifecycle');
const { createMainWindow } = require('./windows/main-window');
const autoUpdateService = require('./services/auto-update-service');
const registerLegacyHandlers = require('./ipc');

if (process.platform === 'win32') {
    app.setAppUserModelId('com.quangquy.cppide');
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log('[App] Another instance is already running. Quitting...');
    app.quit();
    process.exit(0);
}

setupAppEvents();

app.whenReady().then(async () => {
    console.log('[App] Electron ready');
    await initializeApp();
    const mainWindow = createMainWindow();
    registerLegacyHandlers(mainWindow);
    autoUpdateService.initialize(mainWindow);
    console.log('[App] Sameko Dev C++ is ready!');
});

process.on('uncaughtException', (error) => {
    console.error('[App] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[App] Unhandled Rejection at:', promise, 'reason:', reason);
});
