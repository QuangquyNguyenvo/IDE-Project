/**
 * Sameko Dev C++ IDE - Competitive Companion Server
 * HTTP server to receive problems from Competitive Companion browser extension
 * @module app/services/competitive/companion-server
 */

'use strict';

const http = require('http');
const { shell } = require('electron');

// ============================================================================
// STATE
// ============================================================================

/** @type {import('http').Server|null} */
let ccServer = null;

/** @type {'stopped'|'starting'|'running'|'error'} */
let ccServerStatus = 'stopped';

/** @type {Function|null} - Callback to send received problems to renderer */
let onProblemReceived = null;

/** @type {Function|null} - Callback to focus main window */
let onFocusWindow = null;

/** @type {number} */
const CC_PORT = 27121;

// ============================================================================
// SERVER MANAGEMENT
// ============================================================================

/**
 * Set callback for when a problem is received
 * @param {Function} callback - (problem: Object) => void
 */
function setOnProblemReceived(callback) {
    onProblemReceived = callback;
}

/**
 * Set callback for focusing window
 * @param {Function} callback - () => void
 */
function setOnFocusWindow(callback) {
    onFocusWindow = callback;
}

/**
 * Start Competitive Companion HTTP server
 * @returns {Promise<{success: boolean, status?: string, error?: string}>}
 */
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

/**
 * Stop Competitive Companion server
 * @returns {{success: boolean, status: string}}
 */
function stopServer() {
    if (ccServer) {
        ccServer.close();
        ccServer = null;
        ccServerStatus = 'stopped';
        console.log('[CC] Server stopped');
    }
    return { success: true, status: 'stopped' };
}

/**
 * Get server status
 * @returns {{status: string, running: boolean, port: number}}
 */
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

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    startServer,
    stopServer,
    getStatus,
    openExtensionPage,
    setOnProblemReceived,
    setOnFocusWindow,
    CC_PORT,
};
