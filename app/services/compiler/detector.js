/**
 * Sameko Dev C++ IDE - Compiler Detector
 * Detects and manages C++ compiler (g++) installations
 * @module app/services/compiler/detector
 */

'use strict';

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// ============================================================================
// STATE
// ============================================================================

/** @type {string|null} */
let detectedCompiler = null;

/** @type {import('../../../shared/types').CompilerInfo} */
let compilerInfo = {
    name: 'Unknown',
    version: '',
    path: '',
    bundled: false,
    hasLLD: false
};

// ============================================================================
// PATH UTILITIES
// ============================================================================

/**
 * Get the correct base path (handles both dev and packaged app)
 * @returns {string}
 */
function getBasePath() {
    // When packaged, __dirname points to app.asar, but unpacked files are in app.asar.unpacked
    if (__dirname.includes('app.asar')) {
        return __dirname.replace('app.asar', 'app.asar.unpacked');
    }
    // In development, go up to root from app/services/compiler
    return path.join(__dirname, '..', '..', '..');
}

/**
 * Get resources path for extraResources (packaged app)
 * @returns {string}
 */
function getResourcesPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath);
    }
    return getBasePath();
}

const basePath = getBasePath();
const resourcesPath = getResourcesPath();

// ============================================================================
// COMPILER PATHS
// ============================================================================

/**
 * Bundled MinGW paths (inside app folder - HIGHEST PRIORITY)
 */
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

/**
 * System-installed compiler paths (fallback)
 */
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

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

/**
 * Find the best available compiler
 * @returns {string} Path to g++ or 'g++' for PATH fallback
 */
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

            // Pre-detect LLD for faster builds
            const binDir = path.dirname(compilerPath);
            compilerInfo.hasLLD = fs.existsSync(path.join(binDir, 'ld.lld.exe'));

            console.log(`[Compiler] Found system compiler: ${compilerPath} (LLD: ${compilerInfo.hasLLD})`);
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

/**
 * Get compiler version
 * @returns {Promise<string>}
 */
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

/**
 * Get detected compiler path
 * @returns {string|null}
 */
function getDetectedCompiler() {
    return detectedCompiler;
}

/**
 * Get compiler info object
 * @returns {import('../../../shared/types').CompilerInfo}
 */
function getCompilerInfo() {
    return { ...compilerInfo };
}

/**
 * Get compiler binary directory
 * @returns {string}
 */
function getCompilerBinDir() {
    if (detectedCompiler && path.isAbsolute(detectedCompiler)) {
        return path.dirname(detectedCompiler);
    }
    return '';
}

/**
 * Create environment with compiler path
 * @returns {Object}
 */
function getCompilerEnv() {
    const env = { ...process.env };
    const binDir = getCompilerBinDir();
    if (binDir) {
        env.PATH = `${binDir}${path.delimiter}${env.PATH}`;
    }
    return env;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    detectCompiler,
    getCompilerVersion,
    getDetectedCompiler,
    getCompilerInfo,
    getCompilerBinDir,
    getCompilerEnv,
    getBasePath,
    getResourcesPath,
};
