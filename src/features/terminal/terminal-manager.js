/**
 * Sameko Dev C++ IDE - Terminal Manager
 * Xterm.js terminal integration
 * 
 * @module src/features/terminal/terminal-manager
 */

// ============================================================================
// TERMINAL STATE
// ============================================================================

let terminal = null;
let fitAddon = null;
let isProcessRunning = false;

// ============================================================================
// TERMINAL FUNCTIONS
// ============================================================================

/**
 * Initialize terminal
 * @param {HTMLElement|string} container
 */
function initTerminal(container) {
    const containerEl = typeof container === 'string'
        ? document.getElementById(container)
        : container;

    if (!containerEl || !window.Terminal) {
        console.warn('[Terminal] Xterm.js not available');
        return null;
    }

    terminal = new window.Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Consolas, monospace',
        theme: {
            background: '#1a1a2e',
            foreground: '#eee',
            cursor: '#fff'
        },
        scrollback: 5000,
        convertEol: true
    });

    // Fit addon for auto-resize
    if (window.FitAddon) {
        fitAddon = new window.FitAddon.FitAddon();
        terminal.loadAddon(fitAddon);
    }

    terminal.open(containerEl);
    fit();

    // Handle resize
    window.addEventListener('resize', debounce(fit, 100));

    console.log('[Terminal] Initialized');
    return terminal;
}

/**
 * Write to terminal
 * @param {string} data
 */
function write(data) {
    if (terminal) {
        terminal.write(data);
    }
}

/**
 * Write line to terminal
 * @param {string} line
 */
function writeLine(line) {
    if (terminal) {
        terminal.writeln(line);
    }
}

/**
 * Clear terminal
 */
function clear() {
    if (terminal) {
        terminal.clear();
    }
}

/**
 * Fit terminal to container
 */
function fit() {
    if (fitAddon) {
        try {
            fitAddon.fit();
        } catch (e) { }
    }
}

/**
 * Dispose terminal
 */
function dispose() {
    if (terminal) {
        terminal.dispose();
        terminal = null;
    }
}

/**
 * Set process running state
 * @param {boolean} running
 */
function setProcessRunning(running) {
    isProcessRunning = running;
}

/**
 * Check if process is running
 * @returns {boolean}
 */
function isRunning() {
    return isProcessRunning;
}

// ============================================================================
// HELPERS
// ============================================================================

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initTerminal, write, writeLine, clear, fit, dispose, setProcessRunning, isRunning };
}

if (typeof window !== 'undefined') {
    window.TerminalManager = { initTerminal, write, writeLine, clear, fit, dispose, setProcessRunning, isRunning };
}
