/**
 * Sameko Dev C++ IDE - Competitive Companion Server
 * HTTP server to receive problems from Competitive Companion browser extension
 * @module app/services/competitive/companion-server
 */

'use strict';

const http = require('http');
const { shell } = require('electron');

let ccServer = null;

let ccServerStatus = 'stopped';

/** @type {Function|null} - Callback to send received problems to renderer */
let onProblemReceived = null;

/** @type {Function|null} - Callback to focus main window */
let onFocusWindow = null;

const CC_PORT = 27121;

function setOnProblemReceived(callback) {
    onProblemReceived = callback;
}

function setOnFocusWindow(callback) {
    onFocusWindow = callback;
}

function startServer() {
    if (ccServer) {
        console.log('[CC] Server already running');
        return Promise.resolve({ success: true, status: 'already_running' });
    }

    return new Promise((resolve) => {
        ccServerStatus = 'starting';

        ccServer = http.createServer((req, res) => {
            if (req.method === 'POST') {
                let body = '';

                req.on('data', chunk => {
                    body += chunk.toString();
                });

                req.on('end', () => {
                    try {
                        const problem = JSON.parse(body);
                        console.log(`[CC] Received problem: ${problem.name}`);

                        // Notify renderer
                        if (onProblemReceived) {
                            onProblemReceived({
                                name: problem.name,
                                group: problem.group,
                                url: problem.url,
                                timeLimit: problem.timeLimit,
                                memoryLimit: problem.memoryLimit,
                                tests: problem.tests || []
                            });
                        }

                        // Focus window
                        if (onFocusWindow) {
                            onFocusWindow();
                        }

                        res.writeHead(200);
                        res.end('OK');
                    } catch (e) {
                        console.error('[CC] Parse error:', e.message);
                        res.writeHead(400);
                        res.end('Parse Error');
                    }
                });
            } else {
                res.writeHead(405);
                res.end('Method Not Allowed');
            }
        });

        ccServer.on('error', (err) => {
            console.error('[CC] Server error:', err.message);
            ccServerStatus = 'error';
            ccServer = null;
            resolve({ success: false, error: err.message });
        });

        ccServer.listen(CC_PORT, '127.0.0.1', () => {
            console.log(`[CC] Competitive Companion server listening on port ${CC_PORT}`);
            ccServerStatus = 'running';
            resolve({ success: true, status: 'running' });
        });
    });
}

function stopServer() {
    if (ccServer) {
        ccServer.close();
        ccServer = null;
        ccServerStatus = 'stopped';
        console.log('[CC] Server stopped');
    }
    return { success: true, status: 'stopped' };
}

function getStatus() {
    return {
        status: ccServerStatus,
        running: ccServer !== null,
        port: CC_PORT
    };
}

/**
 * Open Competitive Companion extension page in browser
 */
function openExtensionPage() {
    shell.openExternal('https://chromewebstore.google.com/detail/competitive-companion/cjnmckjndlpiamhfimnnjmnckgghkjbl');
    return { success: true };
}

module.exports = {
    startServer,
    stopServer,
    getStatus,
    openExtensionPage,
    setOnProblemReceived,
    setOnFocusWindow,
    CC_PORT,
};
