/**
 * Sameko Dev C++ IDE - App Lifecycle Management
 * Handles application lifecycle events and initialization
 * @module app/core/app-lifecycle
 */

'use strict';

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Import services (these will be created in later phases)
// const { detectCompiler, performCompilerWarmup } = require('../services/compiler/detector');

// Tree-sitter for syntax checking
let tsParser = null;

/**
 * Initialize Tree-sitter parser for C++
 */
function initTreeSitter() {
    try {
        const Parser = require('tree-sitter');
        const Cpp = require('tree-sitter-cpp');
        tsParser = new Parser();
        tsParser.setLanguage(Cpp);
        console.log('[TreeSitter] Initialized successfully');
        return true;
    } catch (e) {
        console.log('[TreeSitter] Not available, falling back to g++ only:', e.message);
        return false;
    }
}

/**
 * Get Tree-sitter parser instance
 * @returns {Object|null}
 */
function getTreeSitterParser() {
    return tsParser;
}

/**
 * Ensure required directories exist
 */
function ensureDirectories() {
    const dirs = [
        path.join(app.getPath('userData'), 'local-history'),
        path.join(app.getPath('temp'), 'cpp-ide'),
        path.join(app.getPath('temp'), 'cpp-ide-pch'),
        path.join(app.getPath('temp'), 'cpp-ide-builds'),
    ];

    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`[Init] Created directory: ${dir}`);
        }
    }
}

/**
 * Initialize application on startup
 * Called after app.whenReady()
 */
async function initializeApp() {
    console.log('[App] Initializing Sameko Dev C++...');

    // 1. Initialize Tree-sitter
    initTreeSitter();

    // 2. Ensure directories exist
    ensureDirectories();

    // 3. Initialize compiler (will be done in Phase 4)
    // detectCompiler();
    // performCompilerWarmup();

    console.log('[App] Initialization complete');
}

/**
 * Cleanup before app quits
 */
function cleanupBeforeQuit() {
    console.log('[App] Cleaning up before quit...');

    // Close all file watchers
    // (will be implemented in Phase 4+)

    // Kill any running processes
    // (will be implemented in Phase 4+)
}

/**
 * Setup app event handlers
 */
function setupAppEvents() {
    // Handle second instance (single instance lock)
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Focus main window when trying to open another instance
        const { getMainWindow } = require('./window-manager');
        const mainWindow = getMainWindow();

        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    // Handle before-quit
    app.on('before-quit', () => {
        cleanupBeforeQuit();
    });

    // Handle window-all-closed
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    // Handle activate (macOS dock click)
    app.on('activate', () => {
        const { BrowserWindow } = require('electron');
        if (BrowserWindow.getAllWindows().length === 0) {
            const { createMainWindow } = require('./window-manager');
            createMainWindow();
        }
    });
}

module.exports = {
    initializeApp,
    cleanupBeforeQuit,
    setupAppEvents,
    getTreeSitterParser,
};
