/**
 * Auto Update Service using electron-updater
 * Provides automatic updates with "Restart to Update" functionality like VS Code
 * @module app/services/auto-update-service
 */

'use strict';

const { autoUpdater } = require('electron-updater');
const { app, dialog, BrowserWindow } = require('electron');
const path = require('path');
const log = require('electron-log');

// Configure electron-log for autoUpdater
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// ============================================================================
// AUTO-UPDATER CONFIGURATION
// ============================================================================

class AutoUpdateService {
    constructor() {
        this.mainWindow = null;
        this.updateDownloaded = false;
        this.updateInfo = null;
        
        // Allow pre-release updates (beta versions)
        autoUpdater.allowPrerelease = true;
        
        // Don't auto-download updates, let user control it
        autoUpdater.autoDownload = false;
        
        // Configure update check
        autoUpdater.autoInstallOnAppQuit = true;
        
        this.setupEventHandlers();
    }

    /**
     * Initialize the update service with main window
     * @param {BrowserWindow} mainWindow - The main application window
     */
    initialize(mainWindow) {
        this.mainWindow = mainWindow;
        log.info('[AutoUpdate] Service initialized');
        
        // Check for updates on startup (after 5 seconds delay)
        setTimeout(() => {
            this.checkForUpdates(false); // silent check
        }, 5000);
    }

    /**
     * Setup event handlers for auto-updater
     */
    setupEventHandlers() {
        // Checking for updates
        autoUpdater.on('checking-for-update', () => {
            log.info('[AutoUpdate] Checking for updates...');
            this.sendStatusToRenderer('checking-for-update');
        });

        // Update available
        autoUpdater.on('update-available', (info) => {
            log.info('[AutoUpdate] Update available:', info.version);
            this.updateInfo = info;
            this.sendStatusToRenderer('update-available', {
                version: info.version,
                releaseNotes: info.releaseNotes,
                releaseDate: info.releaseDate,
                isPrerelease: info.version.includes('beta') || info.version.includes('alpha')
            });
        });

        // No update available
        autoUpdater.on('update-not-available', (info) => {
            log.info('[AutoUpdate] No updates available');
            this.sendStatusToRenderer('update-not-available', {
                version: info.version
            });
        });

        // Error occurred
        autoUpdater.on('error', (err) => {
            log.error('[AutoUpdate] Error:', err);
            this.sendStatusToRenderer('update-error', {
                message: err.message
            });
        });

        // Download progress
        autoUpdater.on('download-progress', (progressObj) => {
            const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
            log.info('[AutoUpdate]', logMessage);
            
            this.sendStatusToRenderer('download-progress', {
                percent: Math.round(progressObj.percent),
                transferred: progressObj.transferred,
                total: progressObj.total,
                bytesPerSecond: progressObj.bytesPerSecond
            });
        });

        // Update downloaded - ready to install
        autoUpdater.on('update-downloaded', (info) => {
            log.info('[AutoUpdate] Update downloaded:', info.version);
            this.updateDownloaded = true;
            this.updateInfo = info;
            
            this.sendStatusToRenderer('update-downloaded', {
                version: info.version,
                releaseNotes: info.releaseNotes,
                releaseDate: info.releaseDate
            });
        });
    }

    /**
     * Send update status to renderer process
     * @param {string} status - Update status
     * @param {object} data - Additional data
     */
    sendStatusToRenderer(status, data = {}) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('update-status', {
                status,
                data,
                currentVersion: app.getVersion()
            });
        }
    }

    /**
     * Check for updates manually or silently
     * @param {boolean} showNoUpdateDialog - Show dialog when no updates available
     */
    async checkForUpdates(showNoUpdateDialog = true) {
        try {
            log.info('[AutoUpdate] Checking for updates manually...');
            
            if (showNoUpdateDialog) {
                this.sendStatusToRenderer('checking-for-update');
            }
            
            const result = await autoUpdater.checkForUpdates();
            
            if (showNoUpdateDialog && !result.updateInfo) {
                this.sendStatusToRenderer('update-not-available', {
                    version: app.getVersion(),
                    showMessage: true
                });
            }
            
            return result;
        } catch (error) {
            log.error('[AutoUpdate] Check failed:', error);
            
            if (showNoUpdateDialog) {
                this.sendStatusToRenderer('update-error', {
                    message: error.message,
                    showMessage: true
                });
            }
            
            throw error;
        }
    }

    /**
     * Download the available update
     */
    async downloadUpdate() {
        try {
            log.info('[AutoUpdate] Starting update download...');
            this.sendStatusToRenderer('download-started');
            await autoUpdater.downloadUpdate();
        } catch (error) {
            log.error('[AutoUpdate] Download failed:', error);
            this.sendStatusToRenderer('update-error', {
                message: error.message
            });
            throw error;
        }
    }

    /**
     * Install the downloaded update and restart the app
     */
    quitAndInstall() {
        if (this.updateDownloaded) {
            log.info('[AutoUpdate] Quitting and installing update...');
            
            // setImmediate ensures the app quits after this function returns
            setImmediate(() => {
                // Disable all windows close event handlers
                app.removeAllListeners('window-all-closed');
                
                // Close all windows
                BrowserWindow.getAllWindows().forEach(window => {
                    window.removeAllListeners('close');
                    window.close();
                });
                
                // Quit and install
                autoUpdater.quitAndInstall(false, true);
            });
        } else {
            log.warn('[AutoUpdate] No update downloaded yet');
        }
    }

    /**
     * Get current update status
     * @returns {object} Current update status
     */
    getStatus() {
        return {
            updateDownloaded: this.updateDownloaded,
            updateInfo: this.updateInfo,
            currentVersion: app.getVersion()
        };
    }
}

// Singleton instance
const autoUpdateService = new AutoUpdateService();

module.exports = autoUpdateService;
