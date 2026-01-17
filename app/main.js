/**
 * Sameko Dev C++ IDE - Main Entry Point
 * Minimal entry point that orchestrates app initialization
 * @module app/main
 */

'use strict';

// Performance optimization: V8 compile cache
require('v8-compile-cache');

const { app } = require('electron');
const { initializeApp, setupAppEvents } = require('./core/app-lifecycle');
const { createMainWindow } = require('./core/window-manager');

// Register all IPC handlers (will be expanded in Phase 7)
// For now, we'll import from the legacy main.js to maintain compatibility
const registerLegacyHandlers = require('./ipc');

// ============================================================================
// SINGLE INSTANCE LOCK
// ============================================================================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log('[App] Another instance is already running. Quitting...');
    app.quit();
    process.exit(0);
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

// Setup app event handlers
setupAppEvents();

// When Electron is ready
app.whenReady().then(async () => {
    console.log('[App] Electron ready');

    // Initialize app (directories, parsers, etc.)
    await initializeApp();

    // Create the main window
    const mainWindow = createMainWindow();

    // Register IPC handlers (pass mainWindow for process output callbacks)
    registerLegacyHandlers(mainWindow);

    console.log('[App] Sameko Dev C++ is ready!');
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('[App] Uncaught Exception:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('[App] Unhandled Rejection at:', promise, 'reason:', reason);
});
