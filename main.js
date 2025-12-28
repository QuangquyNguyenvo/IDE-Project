/**
 * C++ IDE - Main Process
 * 
 * Electron main process handling:
 * - Window creation and management
 * - IPC communication with renderer
 * - File system operations
 * - Compiler detection and integration
 * - Build system (compile, run, stop)
 * - Precompiled header (PCH) management
 * 
 * @author Project IDE Team
 * @license MIT
 */

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
const { exec, spawn } = require('child_process');

let mainWindow;
let currentFile = null;
let runningProcess = null;
let runningMemoryPollInterval = null;  // Track memory polling interval for cleanup

// ============================================================================
// FILE WATCHER - Detect external file changes
// ============================================================================
const fileWatchers = new Map(); // path -> { watcher, mtime }

function watchFile(filePath) {
    if (!filePath || fileWatchers.has(filePath)) return;

    try {
        const stats = fs.statSync(filePath);
        const watcher = fs.watch(filePath, (eventType) => {
            if (eventType === 'change') {
                // Debounce to avoid multiple triggers
                const current = fileWatchers.get(filePath);
                if (!current) return;

                try {
                    const newStats = fs.statSync(filePath);
                    const newMtime = newStats.mtimeMs;

                    // Only notify if mtime actually changed
                    if (newMtime !== current.mtime) {
                        current.mtime = newMtime;
                        // Notify renderer
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('file-changed-external', { path: filePath });
                        }
                    }
                } catch (e) {
                    // File might be deleted
                }
            }
        });

        fileWatchers.set(filePath, { watcher, mtime: stats.mtimeMs });
        console.log(`[FileWatcher] Watching: ${filePath}`);
    } catch (e) {
        console.log(`[FileWatcher] Cannot watch: ${filePath}`, e.message);
    }
}

function unwatchFile(filePath) {
    const entry = fileWatchers.get(filePath);
    if (entry) {
        entry.watcher.close();
        fileWatchers.delete(filePath);
        console.log(`[FileWatcher] Stopped watching: ${filePath}`);
    }
}

function updateFileWatcherMtime(filePath) {
    // Call this after saving to update mtime and prevent false notifications
    const entry = fileWatchers.get(filePath);
    if (entry) {
        try {
            const stats = fs.statSync(filePath);
            entry.mtime = stats.mtimeMs;
        } catch (e) { }
    }
}

// IPC handlers for file watching
ipcMain.handle('watch-file', async (event, filePath) => {
    watchFile(filePath);
    return { success: true };
});

ipcMain.handle('unwatch-file', async (event, filePath) => {
    unwatchFile(filePath);
    return { success: true };
});

ipcMain.handle('reload-file', async (event, filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Update mtime after reload
        updateFileWatcherMtime(filePath);
        return { success: true, content };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// ============================================================================
// COMPILER DETECTION
// ============================================================================
// Get the correct base path (handles both dev and packaged app)
function getBasePath() {
    // When packaged, __dirname points to app.asar, but unpacked files are in app.asar.unpacked
    if (__dirname.includes('app.asar')) {
        return __dirname.replace('app.asar', 'app.asar.unpacked');
    }
    return __dirname;
}

// Get resources path for extraResources (packaged app)
function getResourcesPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath);
    }
    return __dirname;
}

const basePath = getBasePath();
const resourcesPath = getResourcesPath();

// Bundled MinGW path (inside app folder - HIGHEST PRIORITY)
const BUNDLED_MINGW_PATHS = [
    // Check extraResources location first (for packaged app)
    path.join(resourcesPath, 'TDM-GCC-64', 'bin', 'g++.exe'),
    // Then check app folder (for development)
    path.join(basePath, 'TDM-GCC-64', 'bin', 'g++.exe'),
    path.join(basePath, 'mingw64', 'bin', 'g++.exe'),
    path.join(basePath, 'mingw32', 'bin', 'g++.exe'),
    path.join(basePath, 'MinGW', 'bin', 'g++.exe'),
    path.join(basePath, 'compiler', 'bin', 'g++.exe'),
];

// System-installed compiler paths (fallback)
const SYSTEM_COMPILER_PATHS = [
    'C:\\TDM-GCC-64\\bin\\g++.exe',
    'C:\\TDM-GCC-32\\bin\\g++.exe',
    'C:\\MinGW\\bin\\g++.exe',
    'C:\\MinGW64\\bin\\g++.exe',
    'C:\\msys64\\mingw64\\bin\\g++.exe',
    'C:\\msys64\\mingw32\\bin\\g++.exe',
    'C:\\Program Files\\mingw-w64\\x86_64-8.1.0-posix-seh-rt_v6-rev0\\mingw64\\bin\\g++.exe',
    'C:\\Program Files (x86)\\Dev-Cpp\\MinGW64\\bin\\g++.exe',
];

let detectedCompiler = null;
let compilerInfo = { name: 'Unknown', version: '', path: '', bundled: false };

// Find the best available compiler
function detectCompiler() {
    // PRIORITY 1: Check bundled MinGW in app folder (no installation needed!)
    for (const compilerPath of BUNDLED_MINGW_PATHS) {
        if (fs.existsSync(compilerPath)) {
            detectedCompiler = compilerPath;
            compilerInfo.name = 'Bundled MinGW';
            compilerInfo.path = compilerPath;
            compilerInfo.bundled = true;
            console.log(`[Compiler] Found bundled MinGW: ${compilerPath}`);
            return compilerPath;
        }
    }

    // PRIORITY 2: Check system-installed compilers
    for (const compilerPath of SYSTEM_COMPILER_PATHS) {
        if (fs.existsSync(compilerPath)) {
            detectedCompiler = compilerPath;
            const dirName = path.dirname(path.dirname(compilerPath));
            if (dirName.includes('TDM-GCC')) {
                compilerInfo.name = 'TDM-GCC';
            } else if (dirName.includes('Dev-Cpp')) {
                compilerInfo.name = 'Dev-C++ MinGW';
            } else if (dirName.includes('msys64')) {
                compilerInfo.name = 'MSYS2 MinGW';
            } else {
                compilerInfo.name = 'MinGW';
            }
            compilerInfo.path = compilerPath;
            compilerInfo.bundled = false;
            console.log(`[Compiler] Found system compiler: ${compilerPath}`);
            return compilerPath;
        }
    }

    // PRIORITY 3: Fallback to PATH
    detectedCompiler = 'g++';
    compilerInfo.name = 'System GCC';
    compilerInfo.path = 'g++ (from PATH)';
    compilerInfo.bundled = false;
    console.log('[Compiler] Using g++ from PATH');
    return 'g++';
}

// Get compiler version
async function getCompilerVersion() {
    return new Promise((resolve) => {
        const compiler = detectedCompiler || 'g++';
        exec(`"${compiler}" --version`, (error, stdout) => {
            if (error) {
                resolve('Unknown');
                return;
            }
            const match = stdout.match(/g\+\+.*?(\d+\.\d+\.\d+)/);
            if (match) {
                compilerInfo.version = match[1];
                resolve(match[1]);
            } else {
                resolve('Unknown');
            }
        });
    });
}

// Initialize compiler on startup
detectCompiler();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        frame: false, // Frameless for custom title bar
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'src/assets/icon.ico'),
        backgroundColor: '#1e1e1e'
    });

    mainWindow.loadFile('src/index.html');

    // Remove native menu
    Menu.setApplicationMenu(null);
}

// Window control handlers
ipcMain.handle('window-minimize', () => {
    mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});

ipcMain.handle('window-close', () => {
    mainWindow?.close();
});

async function openFile() {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'C++ Files', extensions: ['cpp', 'c', 'h', 'hpp', 'cc', 'cxx'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        // Send each file to the renderer
        for (const filePath of result.filePaths) {
            const content = fs.readFileSync(filePath, 'utf-8');
            currentFile = filePath;
            mainWindow.webContents.send('file-opened', { path: filePath, content: content });
        }
    }
}

async function saveFileAs() {
    const result = await dialog.showSaveDialog(mainWindow, {
        filters: [
            { name: 'C++ Files', extensions: ['cpp'] },
            { name: 'C Files', extensions: ['c'] },
            { name: 'Header Files', extensions: ['h', 'hpp'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (!result.canceled) {
        mainWindow.webContents.send('save-file-as', result.filePath);
    }
}

function stopProcess() {
    // Clear memory polling interval first
    if (runningMemoryPollInterval) {
        clearInterval(runningMemoryPollInterval);
        runningMemoryPollInterval = null;
    }

    if (runningProcess) {
        runningProcess.kill();
        runningProcess = null;
        mainWindow.webContents.send('process-stopped');
    }
}

// IPC Handlers
ipcMain.handle('open-file-dialog', async () => {
    await openFile();
});

ipcMain.handle('save-file', async (event, { path: filePath, content }) => {
    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        currentFile = filePath;
        // Update watcher mtime to prevent false notifications
        updateFileWatcherMtime(filePath);
        return { success: true, path: filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-file-dialog', async (event, content) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        filters: [
            { name: 'C++ Files', extensions: ['cpp'] },
            { name: 'C Files', extensions: ['c'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (!result.canceled) {
        try {
            fs.writeFileSync(result.filePath, content, 'utf-8');
            currentFile = result.filePath;
            return { success: true, path: result.filePath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    return { success: false, canceled: true };
});

// Settings persistence
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

ipcMain.handle('save-settings', async (event, settings) => {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('Failed to save settings:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.on('load-settings', (event) => {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf-8');
            event.returnValue = JSON.parse(data);
        } else {
            event.returnValue = null;
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
        event.returnValue = null;
    }
});

// Global PCH cache path
const pchDir = path.join(app.getPath('userData'), 'pch');
let pchReady = false;

// Ensure PCH is created on startup (or rebuild if compiler changed)
async function ensurePCH() {
    if (!fs.existsSync(pchDir)) {
        fs.mkdirSync(pchDir, { recursive: true });
    }

    const pchHeader = path.join(pchDir, 'stdc++.h');
    const pchFile = path.join(pchDir, 'stdc++.h.gch');
    const pchInfoFile = path.join(pchDir, 'pch-info.json');

    const compilerExe = detectedCompiler || 'g++';

    if (fs.existsSync(pchFile) && fs.existsSync(pchInfoFile)) {
        try {
            const pchInfo = JSON.parse(fs.readFileSync(pchInfoFile, 'utf-8'));
            if (pchInfo.compiler === compilerExe && pchInfo.version === compilerInfo.version) {
                console.log('[PCH] Using cached PCH');
                pchReady = true;
                return true;
            } else {
                console.log(`[PCH] Compiler changed: ${pchInfo.compiler} → ${compilerExe}`);
            }
        } catch (e) {
            console.log('[PCH] Invalid pch-info.json, rebuilding');
        }
    }

    console.log('[PCH] Building precompiled header...');

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('system-message', {
            type: 'info',
            message: 'Đang tạo Precompiled Header (lần đầu, ~10s)...'
        });
    }

    fs.writeFileSync(pchHeader, '#include <bits/stdc++.h>\n', 'utf-8');

    return new Promise((resolve) => {
        const startTime = Date.now();
        const compiler = spawn(compilerExe, [
            '-x', 'c++-header',
            pchHeader,
            '-o', pchFile,
            '-O0'
        ], { cwd: pchDir });

        compiler.on('close', (code) => {
            const elapsed = Date.now() - startTime;
            if (code === 0) {
                fs.writeFileSync(pchInfoFile, JSON.stringify({
                    compiler: compilerExe,
                    version: compilerInfo.version,
                    created: new Date().toISOString()
                }), 'utf-8');
                console.log(`[PCH] Built successfully in ${elapsed}ms`);
                pchReady = true;

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('system-message', {
                        type: 'success',
                        message: `PCH sẵn sàng (${(elapsed / 1000).toFixed(1)}s). Các lần build sau sẽ nhanh hơn!`
                    });
                }
                resolve(true);
            } else {
                console.log('[PCH] Build failed');
                pchReady = false;
                resolve(false);
            }
        });

        compiler.on('error', (err) => {
            console.log('[PCH] Error:', err.message);
            pchReady = false;
            resolve(false);
        });
    });
}

ipcMain.handle('compile', async (event, { filePath, content, flags }) => {
    const startTime = Date.now();

    return new Promise(async (resolve) => {
        // Kill any running process first (to release .exe lock)
        if (runningProcess) {
            runningProcess.kill();
            runningProcess = null;
            // Minimal delay - just enough to release file lock
            await new Promise(r => setTimeout(r, 50));
        }

        // Use temp file if no filePath provided (unsaved file)
        let actualFilePath = filePath;
        let usingTempFile = false;

        if (!filePath) {
            // Create temp directory if not exists
            const tempDir = path.join(app.getPath('temp'), 'cpp-ide');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            actualFilePath = path.join(tempDir, 'temp_code.cpp');
            usingTempFile = true;
        }

        // Save current content
        fs.writeFileSync(actualFilePath, content, 'utf-8');
        // Update file watcher mtime to prevent false "file changed" notifications
        updateFileWatcherMtime(actualFilePath);

        const dir = path.dirname(actualFilePath);
        const baseName = path.basename(actualFilePath, path.extname(actualFilePath));
        const outputPath = path.join(dir, baseName + '.exe');

        // ===== MULTI-FILE PROJECT SUPPORT =====
        // Smart detection: only link .cpp files whose .h headers are #included
        let sourceFiles = [actualFilePath];
        let linkedFiles = [];

        if (!usingTempFile) {
            try {
                // Extract all #include "..." from the main file
                const includeRegex = /#include\s*"([^"]+)"/g;
                let match;
                const includedHeaders = new Set();

                while ((match = includeRegex.exec(content)) !== null) {
                    // Get the base name without extension
                    const headerFile = match[1];
                    const headerBase = path.basename(headerFile, path.extname(headerFile));
                    includedHeaders.add(headerBase.toLowerCase());
                }

                if (includedHeaders.size > 0) {
                    // Find all .cpp files in the same directory
                    const allFiles = fs.readdirSync(dir);

                    for (const file of allFiles) {
                        const ext = path.extname(file).toLowerCase();
                        if ((ext === '.cpp' || ext === '.c' || ext === '.cc' || ext === '.cxx') && file !== path.basename(actualFilePath)) {
                            // Check if this .cpp has a matching header that was included
                            const cppBase = path.basename(file, ext).toLowerCase();
                            if (includedHeaders.has(cppBase)) {
                                const fullPath = path.join(dir, file);
                                sourceFiles.push(fullPath);
                                linkedFiles.push(file);
                            }
                        }
                    }

                    if (linkedFiles.length > 0) {
                        console.log(`[Compile] Multi-file project detected. Linking: ${linkedFiles.join(', ')}`);
                    }
                }
            } catch (e) {
                console.log('[Compile] Could not scan directory:', e.message);
            }
        }

        // PCH only incompatible with different C++ standard (-std=)
        // Optimization (-O2,-O3) and warnings (-Wall) are fine with PCH
        const hasStdFlag = flags && /-std=/.test(flags);
        const usesPCH = content.includes('bits/stdc++.h') && pchReady && !hasStdFlag;

        // Build args - start with source files and output
        const args = [
            ...sourceFiles,  // All source files
            '-o', outputPath,
            '-I', dir,  // Include current directory for local headers
        ];

        // Apply user settings flags (C++ standard, optimization, warnings)
        if (flags) {
            const flagsArr = flags.split(' ').filter(f => f.trim());
            args.push(...flagsArr);
            if (hasStdFlag) {
                console.log(`[Compile] User flags: ${flagsArr.join(' ')} (PCH disabled due to -std=)`);
            } else {
                console.log(`[Compile] User flags: ${flagsArr.join(' ')}`);
            }
        } else {
            args.push('-O0', '-w');
        }

        if (usesPCH) {
            args.push('-I', pchDir);
            args.push('-include', 'stdc++.h');
            console.log('[Compile] Using PCH');
        }

        // Use detected compiler (TDM-GCC, MinGW, or fallback)
        const compilerExe = detectedCompiler || 'g++';
        console.log(`[Compile] Command: ${compilerExe} ${args.join(' ')}`);
        const compiler = spawn(compilerExe, args, { cwd: dir });

        let stderr = '';

        compiler.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        compiler.on('close', (code) => {
            const compileTime = Date.now() - startTime;
            console.log(`[Compile] Finished in ${compileTime}ms`);

            if (code !== 0) {
                resolve({
                    success: false,
                    error: stderr || `Compilation failed with code ${code}`,
                    outputPath: null,
                    time: compileTime,
                    linkedFiles: linkedFiles
                });
            } else {
                resolve({
                    success: true,
                    message: 'Compilation successful!',
                    outputPath: outputPath,
                    warnings: stderr || '',
                    compiler: compilerInfo.name,
                    time: compileTime,
                    linkedFiles: linkedFiles
                });
            }
        });

        compiler.on('error', (err) => {
            resolve({
                success: false,
                error: err.message,
                outputPath: null
            });
        });
    });
});

ipcMain.handle('run', async (event, exePath) => {
    return new Promise((resolve) => {
        if (!exePath || !fs.existsSync(exePath)) {
            resolve({ success: false, error: 'Executable not found. Please compile first.' });
            return;
        }

        const dir = path.dirname(exePath);
        const runStartTime = Date.now();
        let peakMemoryKB = 0;

        // Run the executable
        runningProcess = spawn(exePath, [], {
            cwd: dir,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        const pid = runningProcess.pid;

        // Function to poll memory
        const pollMemory = () => {
            if (!runningProcess || !pid) return;
            // Use tasklist to get memory (Working Set)
            exec(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, (err, stdout) => {
                if (!err && stdout) {
                    // Parse CSV - handle different locales (comma/dot/space as separators)
                    // Format: "process.exe","1234","Console","1","12,345 K" or "12.345 K" or "12 345 K"
                    const match = stdout.match(/"([0-9][0-9.,\s]*)\s*K"/i);
                    if (match) {
                        const memKB = parseInt(match[1].replace(/[,.\s]/g, ''), 10);
                        if (memKB > peakMemoryKB) {
                            peakMemoryKB = memKB;
                        }
                    }
                }
            });
        };

        // Poll memory usage (Windows only) - poll every 500ms to avoid spawning too many processes
        if (pid && process.platform === 'win32') {
            pollMemory(); // Immediate first poll
            runningMemoryPollInterval = setInterval(pollMemory, 500);  // Use global for cleanup
        }

        let output = '';
        let errorOutput = '';

        runningProcess.stdout.on('data', (data) => {
            output += data.toString();
            mainWindow.webContents.send('process-output', data.toString());
        });

        runningProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            mainWindow.webContents.send('process-error', data.toString());
        });

        runningProcess.on('close', (code) => {
            if (runningMemoryPollInterval) {
                clearInterval(runningMemoryPollInterval);
                runningMemoryPollInterval = null;
            }
            const executionTime = Date.now() - runStartTime;
            runningProcess = null;
            mainWindow.webContents.send('process-exit', {
                code,
                executionTime,
                peakMemoryKB
            });
            resolve({
                success: true,
                output: output,
                error: errorOutput,
                exitCode: code,
                executionTime: executionTime,
                peakMemoryKB: peakMemoryKB
            });
        });

        runningProcess.on('error', (err) => {
            if (memoryPollInterval) {
                clearInterval(memoryPollInterval);
            }
            runningProcess = null;
            resolve({ success: false, error: err.message });
        });

        // Send initial signal that process started
        mainWindow.webContents.send('process-started');
        resolve({ success: true, started: true });
    });
});

ipcMain.handle('send-input', async (event, input) => {
    if (runningProcess && runningProcess.stdin) {
        runningProcess.stdin.write(input + '\n');
        return { success: true };
    }
    return { success: false, error: 'No running process' };
});

ipcMain.handle('stop-process', async () => {
    stopProcess();
    return { success: true };
});

ipcMain.handle('get-current-file', () => {
    return currentFile;
});

// Get compiler information
ipcMain.handle('get-compiler-info', async () => {
    await getCompilerVersion();
    return compilerInfo;
});

app.whenReady().then(async () => {
    createWindow();

    // Get compiler version (silent - no terminal output)
    await getCompilerVersion();
    console.log(`[System] Compiler: ${compilerInfo.name} ${compilerInfo.version}`);

    // Prepare PCH in background (silent - no terminal output)
    const pchResult = await ensurePCH();
    console.log(`[System] PCH ready: ${pchResult}`);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// ============================================================================
// COMPETITIVE COMPANION SERVER
// ============================================================================
let ccServer = null;
let ccServerStatus = 'stopped'; // 'stopped', 'starting', 'running', 'error'

function startCompetitiveCompanionServer() {
    if (ccServer) {
        console.log('[CC] Server already running');
        return Promise.resolve({ success: true, status: 'already_running' });
    }

    return new Promise((resolve) => {
        ccServerStatus = 'starting';

        // Use HTTP server (Competitive Companion sends HTTP POST)
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

                        // Send to renderer
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('problem-received', {
                                name: problem.name,
                                group: problem.group,
                                url: problem.url,
                                timeLimit: problem.timeLimit,
                                memoryLimit: problem.memoryLimit,
                                tests: problem.tests || []
                            });

                            // Focus window when receiving problem
                            if (mainWindow.isMinimized()) {
                                mainWindow.restore();
                            }
                            mainWindow.focus();
                            mainWindow.show();
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

        ccServer.listen(27121, '127.0.0.1', () => {
            console.log('[CC] Competitive Companion server listening on port 27121');
            ccServerStatus = 'running';
            resolve({ success: true, status: 'running' });
        });
    });
}

function stopCompetitiveCompanionServer() {
    if (ccServer) {
        ccServer.close();
        ccServer = null;
        ccServerStatus = 'stopped';
        console.log('[CC] Server stopped');
    }
    return { success: true, status: 'stopped' };
}

// IPC Handlers for Competitive Companion
ipcMain.handle('cc-start-server', async () => {
    return await startCompetitiveCompanionServer();
});

ipcMain.handle('cc-stop-server', async () => {
    return stopCompetitiveCompanionServer();
});

ipcMain.handle('cc-get-status', async () => {
    return { status: ccServerStatus, running: ccServer !== null };
});

ipcMain.handle('cc-open-extension-page', async () => {
    // Open Chrome Web Store page for Competitive Companion
    shell.openExternal('https://chromewebstore.google.com/detail/competitive-companion/cjnmckjndlpiamhfimnnjmnckgghkjbl');
    return { success: true };
});

// ============================================================================
// BATCH TESTING - Run single test case with timeout
// ============================================================================
ipcMain.handle('run-test', async (event, { exePath, input, expectedOutput, timeLimit }) => {
    return new Promise((resolve) => {
        if (!exePath || !fs.existsSync(exePath)) {
            resolve({ status: 'CE', error: 'Executable not found' });
            return;
        }

        const dir = path.dirname(exePath);
        let output = '';
        let errorOutput = '';
        let killed = false;
        let peakMemoryKB = 0;
        let memoryPollInterval = null;

        // Create test process
        const testProcess = spawn(exePath, [], {
            cwd: dir,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        const pid = testProcess.pid;

        // Poll memory (Windows)
        const pollMemory = () => {
            if (!testProcess || !pid) return;
            exec(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, (err, stdout) => {
                if (!err && stdout) {
                    const match = stdout.match(/"([0-9][0-9.,\s]*)\s*K"/i);
                    if (match) {
                        const memKB = parseInt(match[1].replace(/[,.\s]/g, ''), 10);
                        if (memKB > peakMemoryKB) peakMemoryKB = memKB;
                    }
                }
            });
        };

        // Poll memory (Windows) - poll every 500ms to avoid process spam
        if (pid && process.platform === 'win32') {
            pollMemory();
            memoryPollInterval = setInterval(pollMemory, 500);  // Reduced from 50ms
        }

        // Set timeout
        const timeout = setTimeout(() => {
            killed = true;
            testProcess.kill();
        }, timeLimit || 3000);

        // Send input and start timing AFTER input is sent
        let startTime;
        if (input) {
            testProcess.stdin.write(input);
        }
        testProcess.stdin.end();
        startTime = Date.now(); // Start timing after input is fully sent

        testProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        testProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        testProcess.on('close', (code) => {
            clearTimeout(timeout);
            if (memoryPollInterval) clearInterval(memoryPollInterval);

            const executionTime = Date.now() - startTime;

            // Determine status
            let status = 'AC';
            let details = '';

            if (killed) {
                status = 'TLE';
                details = 'Time limit exceeded';
            } else if (code !== 0) {
                status = 'RE';
                details = `Runtime error (exit code: ${code})`;
            } else if (expectedOutput) {
                // Compare output (flexible: ignore trailing whitespace)
                const normalize = (s) => s.split('\n').map(l => l.trimEnd()).join('\n').trim();
                const actualNorm = normalize(output);
                const expectedNorm = normalize(expectedOutput);

                if (actualNorm !== expectedNorm) {
                    status = 'WA';
                    details = `Expected: ${expectedNorm.substring(0, 100)}${expectedNorm.length > 100 ? '...' : ''}\nGot: ${actualNorm.substring(0, 100)}${actualNorm.length > 100 ? '...' : ''}`;
                }
            }

            resolve({
                status,
                output: output,
                error: errorOutput,
                executionTime,
                peakMemoryKB,
                details
            });
        });

        testProcess.on('error', (err) => {
            clearTimeout(timeout);
            if (memoryPollInterval) clearInterval(memoryPollInterval);
            resolve({ status: 'RE', error: err.message, executionTime: 0 });
        });
    });
});

// ============================================================================
// AUTO UPDATE - Check for new versions on GitHub
// ============================================================================
const https = require('https');
const currentVersion = require('./package.json').version;
const GITHUB_REPO = 'QuangquyNguyenvo/IDE-Project';

function fetchLatestRelease() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_REPO}/releases/latest`,
            method: 'GET',
            headers: {
                'User-Agent': 'SamekoIDE-UpdateChecker',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode === 200) {
                        resolve(JSON.parse(data));
                    } else if (res.statusCode === 404) {
                        resolve(null); // No releases yet
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        req.end();
    });
}

function compareVersions(v1, v2) {
    // Compare semver versions: returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
    const parse = (v) => {
        const match = v.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
        if (!match) return [0, 0, 0, ''];
        return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), match[4] || ''];
    };

    const [major1, minor1, patch1, pre1] = parse(v1);
    const [major2, minor2, patch2, pre2] = parse(v2);

    if (major1 !== major2) return major1 > major2 ? 1 : -1;
    if (minor1 !== minor2) return minor1 > minor2 ? 1 : -1;
    if (patch1 !== patch2) return patch1 > patch2 ? 1 : -1;

    // Pre-release comparison (beta.5 vs beta.6)
    if (pre1 && pre2) {
        const num1 = parseInt(pre1.replace(/\D/g, '')) || 0;
        const num2 = parseInt(pre2.replace(/\D/g, '')) || 0;
        if (num1 !== num2) return num1 > num2 ? 1 : -1;
    } else if (pre1 && !pre2) {
        return -1; // Pre-release is older than release
    } else if (!pre1 && pre2) {
        return 1;
    }

    return 0;
}

ipcMain.handle('check-for-updates', async () => {
    try {
        const release = await fetchLatestRelease();

        if (!release) {
            return { hasUpdate: false, currentVersion };
        }

        const latestVersion = release.tag_name.replace(/^v/, '');
        const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

        // Find download URL (prefer .exe or .rar for Windows)
        let downloadUrl = release.html_url;
        if (release.assets && release.assets.length > 0) {
            const winAsset = release.assets.find(a =>
                a.name.endsWith('.exe') || a.name.endsWith('.rar') || a.name.endsWith('.zip')
            );
            if (winAsset) {
                downloadUrl = winAsset.browser_download_url;
            }
        }

        return {
            hasUpdate,
            currentVersion,
            latestVersion,
            releaseNotes: release.body || '',
            releaseName: release.name || `v${latestVersion}`,
            downloadUrl,
            releaseUrl: release.html_url,
            publishedAt: release.published_at
        };
    } catch (error) {
        console.error('[Update] Check failed:', error.message);
        return { hasUpdate: false, currentVersion, error: error.message };
    }
});

ipcMain.handle('get-current-version', () => {
    return currentVersion;
});

ipcMain.handle('open-release-page', async (event, url) => {
    shell.openExternal(url || `https://github.com/${GITHUB_REPO}/releases/latest`);
    return { success: true };
});
