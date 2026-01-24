'use strict';

const { BrowserWindow, Menu, app } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { WINDOW } = require('../shared/constants');

let mainWindow = null;
let devServer = null;
let devServerPort = null;

function startDevStaticServer(appRoot) {
    if (app.isPackaged) return null;
    if (devServer) return { port: devServerPort };

    const publicDir = path.join(appRoot, 'src');
    const mime = {
        '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
        '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon',
        '.woff2': 'font/woff2', '.ttf': 'font/ttf'
    };

    devServer = http.createServer((req, res) => {
        const urlPath = req.url.split('?')[0];
        const safePath = urlPath === '/' ? '/index.html' : urlPath;
        const filePath = path.join(publicDir, safePath);

        if (!filePath.startsWith(publicDir)) {
            res.writeHead(403); res.end('Forbidden'); return;
        }

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404); res.end('Not found'); return;
            }
            const ext = path.extname(filePath).toLowerCase();
            res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
            res.end(data);
        });
    });

    devServer.listen(0, '127.0.0.1', () => {
        devServerPort = devServer.address().port;
        console.log(`[DevServer] http://localhost:${devServerPort}/`);
    });

    devServer.on('error', (err) => {
        console.warn('[DevServer] Failed to start:', err.message);
    });

    return { port: devServerPort };
}

function getBasePath() {
    if (__dirname.includes('app.asar')) {
        return __dirname.replace('app.asar', 'app.asar.unpacked');
    }
    return path.join(__dirname, '..', '..');
}

function getAppRoot() {
    return path.join(__dirname, '..', '..');
}

function createMainWindow() {
    const appRoot = getAppRoot();

    mainWindow = new BrowserWindow({
        width: WINDOW.DEFAULT_WIDTH,
        height: WINDOW.DEFAULT_HEIGHT,
        frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(appRoot, 'preload.js')
        },
        icon: path.join(appRoot, 'src', 'assets', 'icon.ico'),
        backgroundColor: WINDOW.BACKGROUND_COLOR
    });

    const devServerInfo = startDevStaticServer(appRoot);
    if (devServerInfo?.port) {
        const devUrl = `http://localhost:${devServerInfo.port}/`;
        mainWindow.loadURL(devUrl);
        console.log(`[Window] DevTools URL: ${devUrl}`);
    } else {
        mainWindow.loadFile(path.join(appRoot, 'src', 'index.html'));
    }

    Menu.setApplicationMenu(null);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    console.log('[Window] Main window created');

    // Enable DevTools shortcut (Ctrl+Shift+I) - ONLY IN DEVELOPMENT
    if (!app.isPackaged) {
        mainWindow.webContents.on('before-input-event', (event, input) => {
            if (input.control && input.shift && input.key.toLowerCase() === 'i') {
                mainWindow.webContents.toggleDevTools();
                event.preventDefault();
            }
            // F12 support
            if (input.key === 'F12') {
                mainWindow.webContents.toggleDevTools();
                event.preventDefault();
            }
        });
    }

    return mainWindow;
}

function getMainWindow() {
    return mainWindow;
}

function minimizeWindow() {
    if (mainWindow) {
        mainWindow.minimize();
    }
}

function toggleMaximize() {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
}

function closeWindow() {
    if (mainWindow) {
        mainWindow.close();
    }
}

function isWindowAvailable() {
    return mainWindow !== null && !mainWindow.isDestroyed();
}

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
