const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');

let mainWindow;
let currentFile = null;
let runningProcess = null;

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
        icon: path.join(__dirname, 'icon.png'),
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
        properties: ['openFile'],
        filters: [
            { name: 'C++ Files', extensions: ['cpp', 'c', 'h', 'hpp', 'cc', 'cxx'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const content = fs.readFileSync(filePath, 'utf-8');
        currentFile = filePath;
        mainWindow.webContents.send('file-opened', { path: filePath, content: content });
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

// Global PCH cache path
const pchDir = path.join(app.getPath('userData'), 'pch');
let pchReady = false;

// Ensure PCH is created on startup
async function ensurePCH() {
    if (!fs.existsSync(pchDir)) {
        fs.mkdirSync(pchDir, { recursive: true });
    }

    const pchHeader = path.join(pchDir, 'stdc++.h');
    const pchFile = path.join(pchDir, 'stdc++.h.gch');

    // Check if PCH already exists
    if (fs.existsSync(pchFile)) {
        pchReady = true;
        return true;
    }

    // Create the header file
    fs.writeFileSync(pchHeader, '#include <bits/stdc++.h>\n', 'utf-8');

    // Compile PCH
    return new Promise((resolve) => {
        const compiler = spawn('g++', ['-x', 'c++-header', pchHeader, '-o', pchFile, '-O0'], { cwd: pchDir });

        compiler.on('close', (code) => {
            pchReady = (code === 0);
            resolve(pchReady);
        });

        compiler.on('error', () => {
            pchReady = false;
            resolve(false);
        });
    });
}

ipcMain.handle('compile', async (event, { filePath, content }) => {
    return new Promise(async (resolve) => {
        // Kill any running process first (to release .exe lock)
        if (runningProcess) {
            runningProcess.kill();
            runningProcess = null;
            // Small delay to ensure file is released
            await new Promise(r => setTimeout(r, 100));
        }

        // Save file first if needed
        if (!filePath) {
            resolve({ success: false, error: 'Please save the file first' });
            return;
        }

        // Save current content
        fs.writeFileSync(filePath, content, 'utf-8');

        const dir = path.dirname(filePath);
        const baseName = path.basename(filePath, path.extname(filePath));
        const outputPath = path.join(dir, baseName + '.exe');

        // Check if file uses bits/stdc++.h and PCH is ready
        const usesPCH = content.includes('bits/stdc++.h') && pchReady;

        // Build args - optimized for fastest compilation
        // -O0: no optimization (fastest compile)
        // -pipe: use pipes instead of temp files (faster I/O)
        // -fno-exceptions: disable exceptions if not used (optional)
        const args = [filePath, '-o', outputPath, '-O0', '-pipe'];
        if (usesPCH) {
            args.push('-I', pchDir);
            args.push('-include', 'stdc++.h');
        }

        const compiler = spawn('g++', args, { cwd: dir });

        let stderr = '';

        compiler.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        compiler.on('close', (code) => {
            if (code !== 0) {
                resolve({
                    success: false,
                    error: stderr || `Compilation failed with code ${code}`,
                    outputPath: null
                });
            } else {
                resolve({
                    success: true,
                    message: 'Compilation successful!' + (usesPCH ? ' (PCH)' : ''),
                    outputPath: outputPath,
                    warnings: stderr || ''
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

        // Run the executable
        runningProcess = spawn(exePath, [], {
            cwd: dir,
            stdio: ['pipe', 'pipe', 'pipe']
        });

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
            runningProcess = null;
            mainWindow.webContents.send('process-exit', code);
            resolve({
                success: true,
                output: output,
                error: errorOutput,
                exitCode: code
            });
        });

        runningProcess.on('error', (err) => {
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

app.whenReady().then(async () => {
    createWindow();
    // Prepare PCH in background (takes a few seconds first time)
    const pchResult = await ensurePCH();
    if (pchResult) {
        mainWindow.webContents.send('process-output', '[System] Precompiled header ready - faster compilation enabled!\n');
    }
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
