'use strict';

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

let tsParser = null;

function initTreeSitter() {
    try {
        const Parser = require('tree-sitter');
        const Cpp = require('tree-sitter-cpp');
        tsParser = new Parser();
        tsParser.setLanguage(Cpp);
        return true;
    } catch (e) {
        return false;
    }
}

function getTreeSitterParser() {
    return tsParser;
}

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
        }
    }
}

async function initializeApp() {
    initTreeSitter();
    ensureDirectories();
}

function cleanupBeforeQuit() {
}

function setupAppEvents() {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        const { getMainWindow } = require('../windows/main-window');
        const mainWindow = getMainWindow();

        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.on('before-quit', () => {
        cleanupBeforeQuit();
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        const { BrowserWindow } = require('electron');
        if (BrowserWindow.getAllWindows().length === 0) {
            const { createMainWindow } = require('../windows/main-window');
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
