require('v8-compile-cache');
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
const { exec, spawn } = require('child_process');

// Tree-sitter for robust syntax checking
let tsParser = null;
try {
    const Parser = require('tree-sitter');
    const Cpp = require('tree-sitter-cpp');
    tsParser = new Parser();
    tsParser.setLanguage(Cpp);
    console.log('[TreeSitter] Initialized successfully');
} catch (e) {
    console.log('[TreeSitter] Not available, falling back to g++ only:', e.message);
}

let mainWindow;
let currentFile = null;
let runningProcess = null;
let lastRunningPID = null; // Backup PID in case runningProcess ref is lost
let runningExeName = null; // Store exe name for force kill
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
    path.join(resourcesPath, 'Sameko-GCC', 'bin', 'g++.exe'),
    // Then check app folder (for development)
    path.join(basePath, 'Sameko-GCC', 'bin', 'g++.exe'),
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
let compilerInfo = { name: 'Unknown', version: '', path: '', bundled: false, hasLLD: false };

// Find the best available compiler
function detectCompiler() {
    // PRIORITY 1: Check bundled MinGW in app folder (no installation needed!)
    for (const compilerPath of BUNDLED_MINGW_PATHS) {
        if (fs.existsSync(compilerPath)) {
            detectedCompiler = compilerPath;
            compilerInfo.name = 'Bundled MinGW';
            compilerInfo.path = compilerPath;
            compilerInfo.bundled = true;

            // Pre-detect LLD for faster builds
            const binDir = path.dirname(compilerPath);
            compilerInfo.hasLLD = fs.existsSync(path.join(binDir, 'ld.lld.exe'));

            console.log(`[Compiler] Found bundled MinGW: ${compilerPath} (LLD: ${compilerInfo.hasLLD})`);
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
// Initialize compiler on startup
detectCompiler();
performCompilerWarmup();

function performCompilerWarmup() {
    // Background Compilation to force Windows to cache g++.exe, cc1plus.exe, as.exe, ld.exe into RAM
    // This reduces "Cold Start" latency for the first user actual compilation
    setTimeout(() => {
        const compiler = detectedCompiler || 'g++';
        const binDir = path.isAbsolute(compiler) ? path.dirname(compiler) : '';
        const env = { ...process.env };
        if (binDir) env.PATH = `${binDir}${path.delimiter}${env.PATH}`;

        console.log('[System] Warming up compiler and linker binaries...');

        // Warm up Compiler
        const child = spawn(compiler, ['-x', 'c++', '-', '-o', 'NUL', '-pipe', '-s', '-O0'], {
            stdio: ['pipe', 'ignore', 'ignore'],
            windowsHide: true,
            env: env
        });
        child.on('error', () => { });
        if (child.stdin) {
            child.stdin.write('int main(){return 0;}');
            child.stdin.end();
        }

        // Warm up LLD Linker
        if (compilerInfo.hasLLD && binDir) {
            const lldPath = path.join(binDir, 'ld.lld.exe');
            const lldWarmup = spawn(lldPath, ['--version'], { windowsHide: true });
            lldWarmup.on('error', () => { });
        }
    }, 1000);
}

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

    // Open DevTools in development (comment out for production)
    // mainWindow.webContents.openDevTools();

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



    // KILL STRATEGY 1: Taskkill by PID (Windows)
    if (lastRunningPID && process.platform === 'win32') {
        exec(`taskkill /pid ${lastRunningPID} /f /t`, (error, stdout, stderr) => {
            // Silently fail if process already gone
        });
    }

    // KILL STRATEGY 2: Taskkill by Image Name (Windows)
    const targetExes = new Set();
    if (runningExeName) targetExes.add(runningExeName);
    targetExes.add('temp_code.exe'); // Always target the default temp executable

    if (process.platform === 'win32') {
        for (const exe of targetExes) {
            exec(`taskkill /im ${exe} /f`, (error, stdout, stderr) => {
                // Silently ignore
            });
        }
    }

    // KILL STRATEGY 3: Node Process Kill (PID)
    if (lastRunningPID) {
        try {
            process.kill(lastRunningPID, 'SIGKILL');
        } catch (e) {
            // console.log(`[Stop] Node Kill Error: ${e.message}`);
        }
    }

    // KILL STRATEGY 4: Object Kill & Pipe Destruction
    if (runningProcess) {
        if (runningProcess.stdin) runningProcess.stdin.destroy();
        if (runningProcess.stdout) runningProcess.stdout.destroy();
        if (runningProcess.stderr) runningProcess.stderr.destroy();
        runningProcess.kill();
        runningProcess = null; // Reset immediately to update UI state
    }

    // Always notify UI
    if (mainWindow) mainWindow.webContents.send('process-stopped');
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
// Global PCH cache path - Use Workspace directory for reliability
const pchDir = path.join(basePath, 'local_build_cache', 'pch');
let pchReady = false;

// Ensure PCH is created on startup (or rebuild if compiler changed)
const getPCHKey = (flags = '') => {
    const optMatch = flags.match(/-O[0-3|s|fast]/);
    const stdMatch = flags.match(/-std=[^ ]+/);
    const opt = optMatch ? optMatch[0] : '-O0';
    const std = stdMatch ? stdMatch[0] : '';
    return `${opt}_${std}`.replace(/[^a-zA-Z0-9_]/g, '');
};

async function ensurePCH(flags = '') {
    if (!fs.existsSync(pchDir)) {
        fs.mkdirSync(pchDir, { recursive: true });
    }

    const pchKey = getPCHKey(flags);
    const pchSubDir = path.join(pchDir, pchKey);
    if (!fs.existsSync(pchSubDir)) {
        fs.mkdirSync(pchSubDir, { recursive: true });
    }

    const pchHeader = path.join(pchSubDir, 'stdc++.h');
    const pchFile = path.join(pchSubDir, `stdc++.h.gch`);
    const pchInfoFile = path.join(pchSubDir, `pch-info.json`);

    const compilerExe = detectedCompiler || 'g++';

    if (fs.existsSync(pchFile) && fs.existsSync(pchInfoFile)) {
        try {
            const pchInfo = JSON.parse(fs.readFileSync(pchInfoFile, 'utf-8'));
            if (pchInfo.compiler === compilerExe && pchInfo.version === compilerInfo.version) {
                return { ready: true, pchSubDir, pchKey };
            }
        } catch (e) { }
    }

    const optMatch = flags.match(/-O[0-3|s|fast]/);
    const stdMatch = flags.match(/-std=[^ ]+/);
    const buildArgs = ['-x', 'c++-header', 'stdc++.h', '-o', 'stdc++.h.gch'];
    if (optMatch) buildArgs.push(optMatch[0]);
    if (stdMatch) buildArgs.push(stdMatch[0]);

    if (!fs.existsSync(pchHeader)) {
        fs.writeFileSync(pchHeader, '#include <bits/stdc++.h>\n', 'utf-8');
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('system-message', {
            type: 'info',
            message: `Đang tối ưu thư viện cho cấu hình ${optMatch ? optMatch[0] : '-O0'}${stdMatch ? ' ' + stdMatch[0] : ''}...`
        });
    }

    return new Promise((resolve) => {
        // Inject compiler path into environment to find DLLs
        const env = { ...process.env };
        if (compilerExe && path.isAbsolute(compilerExe)) {
            const binDir = path.dirname(compilerExe);
            env.PATH = `${binDir}${path.delimiter}${env.PATH}`;
        }

        const compiler = spawn(compilerExe, buildArgs, { cwd: pchSubDir, env: env });
        compiler.on('close', (code) => {
            if (code === 0) {
                fs.writeFileSync(pchInfoFile, JSON.stringify({
                    compiler: compilerExe,
                    version: compilerInfo.version,
                    flags: buildArgs.join(' ')
                }), 'utf-8');
                resolve({ ready: true, pchSubDir, pchKey });
            } else {
                resolve({ ready: false });
            }
        });
        compiler.on('error', () => resolve({ ready: false }));
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

        // OPTIMIZATION: Only write file if different (avoid redundant I/O and AV scans)
        let needsWrite = true;
        try {
            if (!usingTempFile && fs.existsSync(actualFilePath)) {
                const existingContent = fs.readFileSync(actualFilePath, 'utf-8');
                if (existingContent === content) {
                    needsWrite = false;
                }
            }
        } catch (e) { }

        if (needsWrite) {
            fs.writeFileSync(actualFilePath, content, 'utf-8');
            // Update file watcher mtime to prevent false "file changed" notifications
            updateFileWatcherMtime(actualFilePath);
        }

        const dir = path.dirname(actualFilePath);
        const baseName = path.basename(actualFilePath, path.extname(actualFilePath));

        // OPTIMIZATION: Use system temp directory for .exe output
        // This acts like a "RAM Disk" on modern OS which caches small temp files in RAM.
        // It also keeps the user's source directory clean.
        const buildsDir = path.join(app.getPath('temp'), 'cpp-ide-builds');
        if (!fs.existsSync(buildsDir)) {
            fs.mkdirSync(buildsDir, { recursive: true });
        }
        const outputPath = path.join(buildsDir, baseName + '.exe');

        // ===== MULTI-FILE PROJECT SUPPORT =====
        // Smart detection: only link .cpp files whose .h headers are #included
        let sourceFiles = [actualFilePath];
        let linkedFiles = [];

        if (!usingTempFile) {
            try {
                // Quick check if there are any local includes at all before scanning directory
                if (content.includes('#include "')) {
                    const includeRegex = /#include\s*"([^"]+)"/g;
                    let match;
                    const includedHeaders = new Set();
                    while ((match = includeRegex.exec(content)) !== null) {
                        const headerBase = path.basename(match[1], path.extname(match[1])).toLowerCase();
                        includedHeaders.add(headerBase);
                    }

                    if (includedHeaders.size > 0) {
                        const allFiles = fs.readdirSync(dir);
                        for (const file of allFiles) {
                            const ext = path.extname(file).toLowerCase();
                            if ((ext === '.cpp' || ext === '.c' || ext === '.cc' || ext === '.cxx') &&
                                file.toLowerCase() !== path.basename(actualFilePath).toLowerCase()) {
                                const cppBase = path.basename(file, ext).toLowerCase();
                                if (includedHeaders.has(cppBase)) {
                                    sourceFiles.push(path.join(dir, file));
                                    linkedFiles.push(file);
                                }
                            }
                        }
                    }
                }
            } catch (e) { }
        }

        // PCH optimization: ensure PCH matches current flags to avoid g++ ignoring it
        const pch = (content.includes('bits/stdc++.h')) ? await ensurePCH(flags) : { ready: false };

        // Build args - reverted to stable set
        const args = [
            ...sourceFiles,
            '-o', outputPath,
            '-I', dir,
            '-pipe',                 // Use pipes instead of temp files (faster I/O)
            '-s'                     // Strip symbols (smaller exe, faster linking)
        ];

        // Apply user settings flags
        if (flags) {
            const flagsArr = flags.split(' ').filter(f => f.trim());
            args.push(...flagsArr);
        } else {
            args.push('-O0', '-w');
        }

        // Use detected compiler (TDM-GCC, MinGW, or fallback)
        const compilerExe = detectedCompiler || 'g++';

        // LLD Linker support (Ultra fast linking)
        if (compilerInfo.hasLLD) {
            args.push('-fuse-ld=lld');
        }

        if (pch.ready) {
            // New robust approach: each config has its own subdir with stdc++.h and stdc++.h.gch
            args.push('-I', pch.pchSubDir);
            args.push('-include', 'stdc++.h');
            console.log(`[Compile] Using PCH from: ${pch.pchSubDir}`);
        }

        console.log(`[Compile] Command: ${compilerExe} ${args.join(' ')}`);
        // Inject compiler path into environment to find DLLs
        const env = { ...process.env };
        if (compilerExe && path.isAbsolute(compilerExe)) {
            const binDir = path.dirname(compilerExe);
            env.PATH = `${binDir}${path.delimiter}${env.PATH}`;
        }

        const compiler = spawn(compilerExe, args, { cwd: dir, env: env });

        let stderr = '';

        compiler.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        compiler.on('close', (code) => {
            const compileTime = Date.now() - startTime;
            console.log(`[Compile] Finished in ${compileTime}ms`);

            if (code !== 0) {
                // LOG ERROR FOR DEBUGGING
                try {
                    fs.writeFileSync(path.join(basePath, 'compile_error.log'), stderr);
                } catch (e) { }

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

ipcMain.handle('run', async (event, { exePath, cwd }) => {
    return new Promise((resolve) => {
        if (!exePath || !fs.existsSync(exePath)) {
            resolve({ success: false, error: 'Executable not found. Please compile first.' });
            return;
        }

        // Use provided CWD (usually source file dir) or fallback to exe dir
        const workingDir = cwd || path.dirname(exePath);
        const runStartTime = Date.now();
        let peakMemoryKB = 0;

        // Run the executable
        // Inject compiler path into environment so the running exe can find DLLs (like libstdc++-6.dll)
        const env = { ...process.env };
        // Use the detected compiler's bin directory if available
        if (detectedCompiler && path.isAbsolute(detectedCompiler)) {
            const binDir = path.dirname(detectedCompiler);
            env.PATH = `${binDir}${path.delimiter}${env.PATH}`;
        }

        runningProcess = spawn(exePath, [], {
            cwd: workingDir,
            env: env,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        runningExeName = path.basename(exePath); // Save for stopProcess
        lastRunningPID = runningProcess.pid;     // Save PID globally

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
            if (runningMemoryPollInterval) {
                clearInterval(runningMemoryPollInterval);
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

// ============================================================================
// CODE FORMATTING - AStyle Integration
// ============================================================================
// Detect AStyle executable (bundled with TDM-GCC or system-installed)
function detectAStyle() {
    const possiblePaths = [
        // Bundled with app (in Sameko-GCC)
        path.join(resourcesPath, 'Sameko-GCC', 'bin', 'astyle.exe'),
        path.join(basePath, 'Sameko-GCC', 'bin', 'astyle.exe'),
        // System paths
        'C:\\TDM-GCC-64\\bin\\astyle.exe',
        'C:\\Program Files\\AStyle\\bin\\astyle.exe',
        'C:\\Program Files (x86)\\AStyle\\bin\\astyle.exe',
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            console.log(`[AStyle] Found: ${p}`);
            return p;
        }
    }

    console.log('[AStyle] Not found - format feature will be disabled');
    return null;
}

let detectedAStyle = null;

// Format code using AStyle
ipcMain.handle('format-code', async (event, { code, style = 'google' }) => {
    // Lazy detection
    if (detectedAStyle === null) {
        detectedAStyle = detectAStyle() || false;
    }

    if (!detectedAStyle) {
        return {
            success: false,
            error: 'AStyle không được tìm thấy. Vui lòng tải astyle.exe và đặt vào thư mục Sameko-GCC\\bin\\'
        };
    }

    return new Promise((resolve) => {
        // AStyle arguments for different styles
        const styleArgs = {
            'google': ['--style=google', '--indent=spaces=4', '--attach-namespaces', '--attach-classes', '--attach-inlines', '--add-braces', '--align-pointer=type'],
            'allman': ['--style=allman', '--indent=spaces=4'],
            'java': ['--style=java', '--indent=spaces=4'],
            'kr': ['--style=kr', '--indent=spaces=4'],
            'stroustrup': ['--style=stroustrup', '--indent=spaces=4'],
            'whitesmith': ['--style=whitesmith', '--indent=spaces=4'],
            'vtk': ['--style=vtk', '--indent=spaces=4'],
            'ratliff': ['--style=ratliff', '--indent=spaces=4'],
            'gnu': ['--style=gnu', '--indent=spaces=4'],
            'linux': ['--style=linux', '--indent=spaces=4'],
            'horstmann': ['--style=horstmann', '--indent=spaces=4'],
            'lisp': ['--style=lisp', '--indent=spaces=4'],
            'pico': ['--style=pico', '--indent=spaces=4'],
        };

        const args = styleArgs[style] || styleArgs['google'];

        // Spawn astyle process
        const astyle = spawn(detectedAStyle, args, {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let formattedCode = '';
        let errorOutput = '';

        astyle.stdout.on('data', (data) => {
            formattedCode += data.toString();
        });

        astyle.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        astyle.on('close', (exitCode) => {
            if (exitCode === 0) {
                resolve({
                    success: true,
                    code: formattedCode
                });
            } else {
                resolve({
                    success: false,
                    error: errorOutput || `AStyle exited with code ${exitCode}`
                });
            }
        });

        astyle.on('error', (err) => {
            resolve({
                success: false,
                error: err.message
            });
        });

        // Send code to astyle via stdin
        astyle.stdin.write(code);
        astyle.stdin.end();
    });
});

// Check if AStyle is available
ipcMain.handle('check-astyle', async () => {
    if (detectedAStyle === null) {
        detectedAStyle = detectAStyle() || false;
    }
    return {
        available: !!detectedAStyle,
        path: detectedAStyle || null
    };
});

// ============================================================================
// REAL-TIME SYNTAX CHECKING
// ============================================================================
// Syntax check using g++ -fsyntax-only (fast, no output file)
// Syntax check using Tree-sitter (fast syntax) and g++ (semantic)
ipcMain.handle('syntax-check', async (event, { content, filePath }) => {
    let allDiagnostics = [];

    // 1. Check syntax with Tree-sitter (Fast & Robust for syntax)
    if (tsParser) {
        try {
            const tree = tsParser.parse(content);

            // Traverse to find errors
            const traverse = (node) => {
                // node.hasError is a property, not a function in native bindings
                if (node.hasError || node.type === 'ERROR') {
                    if (node.type === 'ERROR') {
                        // Check if it's just a wrapper ERROR node or a specific error token
                        // Sometimes ERROR nodes contain children that are valid or other errors
                        if (node.text.trim()) {
                            allDiagnostics.push({
                                line: node.startPosition.row + 1,
                                column: node.startPosition.column + 1,
                                severity: 'error',
                                message: `TS: Unexpected '${node.text}'`
                            });
                        }
                    } else if (node.isMissing) { // node.isMissing is also a property
                        allDiagnostics.push({
                            line: node.startPosition.row + 1,
                            column: node.startPosition.column + 1,
                            severity: 'error',
                            message: `TS: Missing ${node.type}`
                        });
                    }

                    for (let i = 0; i < node.childCount; i++) {
                        traverse(node.child(i));
                    }
                }
            };

            traverse(tree.rootNode);
        } catch (e) {
            console.log('[TreeSitter] Error:', e);
        }
    }

    // 2. Run G++ (Good for semantic & backup syntax)
    // We run this ALWAYS now to get maximum error coverage
    const gppResult = await new Promise((resolve) => {
        const compilerExe = detectedCompiler || 'g++';

        // Create temp file for checking
        const tempDir = path.join(app.getPath('temp'), 'cpp-ide-check');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFile = path.join(tempDir, 'check_temp.cpp');
        fs.writeFileSync(tempFile, content, 'utf-8');

        const args = [
            '-fsyntax-only',
            '-fmax-errors=50',
            '-Wall',
            '-Wextra',
            '-pipe',
            '-fno-exceptions',
            '-fno-rtti',
            tempFile
        ];

        if (filePath) {
            args.push('-I', path.dirname(filePath));
        }

        const checker = spawn(compilerExe, args, { cwd: tempDir });
        let stderr = '';

        checker.stderr.on('data', (data) => stderr += data.toString());

        checker.on('close', (code) => {
            const diags = [];
            const lines = stderr.split('\n');

            for (const line of lines) {
                const match = line.match(/^(?:[A-Za-z]:)?[^:]*:(\d+):(\d+):\s*(error|warning|note):\s*(.+)$/);
                if (match) {
                    diags.push({
                        line: parseInt(match[1], 10),
                        column: parseInt(match[2], 10),
                        severity: match[3],
                        message: match[4]
                    });
                }
            }
            resolve(diags);
        });

        checker.on('error', () => resolve([]));
    });

    // 3. Merge results (Deduplicate based on line number roughly)
    // We prioritize keeping all errors to show user everything
    gppResult.forEach(d => {
        // Only add if not exactly same line/col as existing TS error (to avoid double overlay)
        const exists = allDiagnostics.some(ts => ts.line === d.line && Math.abs(ts.column - d.column) < 5);
        if (!exists) {
            allDiagnostics.push(d);
        }
    });

    return {
        success: allDiagnostics.length === 0,
        diagnostics: allDiagnostics
    };
});

app.whenReady().then(async () => {
    createWindow();

    // Get compiler version
    await getCompilerVersion();
    console.log(`[System] Compiler: ${compilerInfo.name} ${compilerInfo.version}`);

    // Pre-build common PCH (-O0) so first build remains fast
    const pch = await ensurePCH('-O0');
    console.log(`[System] PCH (-O0) ready: ${pch.ready}`);
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
                            // Windows needs special handling to bring window to front
                            if (mainWindow.isMinimized()) {
                                mainWindow.restore();
                            }

                            // Trick to force window to front on Windows:
                            // Temporarily set alwaysOnTop, then remove it
                            mainWindow.setAlwaysOnTop(true);
                            mainWindow.show();
                            mainWindow.focus();
                            mainWindow.setAlwaysOnTop(false);

                            // Flash taskbar if window is not focused (visual notification)
                            if (!mainWindow.isFocused()) {
                                mainWindow.flashFrame(true);
                            }
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
ipcMain.handle('run-test', async (event, { exePath, input, expectedOutput, timeLimit, cwd }) => {
    return new Promise((resolve) => {
        if (!exePath || !fs.existsSync(exePath)) {
            resolve({ status: 'CE', error: 'Executable not found' });
            return;
        }

        const workingDir = cwd || path.dirname(exePath);
        let output = '';
        let errorOutput = '';
        let killed = false;
        let peakMemoryKB = 0;
        let memoryPollInterval = null;

        // Create test process
        const testProcess = spawn(exePath, [], {
            cwd: workingDir,
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
            path: `/repos/${GITHUB_REPO}/releases?per_page=1`,
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
                        const releases = JSON.parse(data);
                        if (Array.isArray(releases) && releases.length > 0) {
                            resolve(releases[0]);
                        } else {
                            resolve(null);
                        }
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
    // Skip update check in Dev
    if (!app.isPackaged) {
        return { hasUpdate: false, currentVersion };
    }

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


