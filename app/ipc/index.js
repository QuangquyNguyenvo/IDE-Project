/**
 * Sameko Dev C++ IDE - IPC Handler Registry
 * Central registration point for all IPC handlers
 * @module app/ipc
 */

'use strict';

const fileHandlers = require('./file-handlers');
const compilerHandlers = require('./compiler-handlers');
const dialogHandlers = require('./dialog-handlers');
const windowHandlers = require('./window-handlers');
const settingsHandlers = require('./settings-handlers');
const formatHandlers = require('./format-handlers');
const competitiveHandlers = require('./competitive-handlers');

// ============================================================================
// REGISTRATION
// ============================================================================

/**
 * Register all IPC handlers
 * @param {import('electron').BrowserWindow} mainWindow
 */
function registerAllHandlers(mainWindow) {
    // Set main window reference for handlers that need it
    fileHandlers.setMainWindow(mainWindow);
    compilerHandlers.setMainWindow(mainWindow);
    dialogHandlers.setMainWindow(mainWindow);
    competitiveHandlers.setMainWindow(mainWindow);

    // Register handlers
    fileHandlers.registerHandlers();
    compilerHandlers.registerHandlers();
    dialogHandlers.registerHandlers();
    windowHandlers.registerHandlers();
    settingsHandlers.registerHandlers();
    formatHandlers.registerHandlers();
    competitiveHandlers.registerHandlers();
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = registerAllHandlers;

// Also export individual handler modules for direct access
module.exports.fileHandlers = fileHandlers;
module.exports.compilerHandlers = compilerHandlers;
module.exports.dialogHandlers = dialogHandlers;
module.exports.windowHandlers = windowHandlers;
module.exports.settingsHandlers = settingsHandlers;
module.exports.formatHandlers = formatHandlers;
module.exports.competitiveHandlers = competitiveHandlers;
