/**
 * Sameko Dev C++ IDE - Window Manager
 * Handles window creation, state, and controls
 * @module app/core/window-manager
 */

'use strict';

const { BrowserWindow, Menu } = require('electron');
const path = require('path');
const { WINDOW } = require('../../shared/constants');

/** @type {BrowserWindow|null} */
let mainWindow = null;

/**
 * Get the correct base path (handles both dev and packaged app)
 * @returns {string}
 */
function getBasePath() {
    // When packaged, __dirname points to app.asar, but unpacked files are in app.asar.unpacked
    if (__dirname.includes('app.asar')) {
        return __dirname.replace('app.asar', 'app.asar.unpacked');
    }
    // In development, go up two levels from app/core to root
    return path.join(__dirname, '..', '..');
}

/**
 * Get the root directory of the app
 * @returns {string}
 */
function getAppRoot() {
    return path.join(__dirname, '..', '..');
}

/**
 * Create the main application window
 * @returns {BrowserWindow}
 */
function createMainWindow() {
    const appRoot = getAppRoot();

    mainWindow = new BrowserWindow({
        width: WINDOW.DEFAULT_WIDTH,
        height: WINDOW.DEFAULT_HEIGHT,
        frame: false, // Frameless for custom title bar
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(appRoot, 'preload.js')
        },
        icon: path.join(appRoot, 'src', 'assets', 'icon.ico'),
        backgroundColor: WINDOW.BACKGROUND_COLOR
    });

    mainWindow.loadFile(path.join(appRoot, 'src', 'index.html'));

    // Open DevTools in development (comment out for production)
    // mainWindow.webContents.openDevTools();

    // Remove native menu
    Menu.setApplicationMenu(null);

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    console.log('[Window] Main window created');
    return mainWindow;
}

/**
 * Get the main window instance
 * @returns {BrowserWindow|null}
 */
function getMainWindow() {
    return mainWindow;
}

/**
 * Minimize the main window
 */
function minimizeWindow() {
    if (mainWindow) {
        mainWindow.minimize();
    }
}

/**
 * Toggle maximize/restore the main window
 */
function toggleMaximize() {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
}

/**
 * Close the main window
 */
function closeWindow() {
    if (mainWindow) {
        mainWindow.close();
    }
}

/**
 * Check if main window is destroyed or null
 * @returns {boolean}
 */
function isWindowAvailable() {
    return mainWindow !== null && !mainWindow.isDestroyed();
}

/**
 * Send a message to the renderer process
 * @param {string} channel - IPC channel name
 * @param {*} data - Data to send
 */
function sendToRenderer(channel, data) {
    if (isWindowAvailable()) {
        mainWindow.webContents.send(channel, data);
    }
}

module.exports = {
    createMainWindow,
    getMainWindow,
    getBasePath,
    getAppRoot,
    minimizeWindow,
    toggleMaximize,
    closeWindow,
    isWindowAvailable,
    sendToRenderer,
};
