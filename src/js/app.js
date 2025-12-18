/**
 * C++ IDE - Renderer Process
 * 
 * Main application logic for the C++ IDE including:
 * - Monaco Editor integration with syntax highlighting
 * - Tab management and split editor support
 * - Build system integration (compile, run, stop)
 * - Settings management and theme system
 * - Terminal and I/O panel handling
 * 
 * @author Project IDE Team
 * @license MIT
 */

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================
const DEFAULT_SETTINGS = {
    editor: {
        fontSize: 14,
        fontFamily: "'JetBrains Mono', monospace",
        tabSize: 4,
        minimap: true,
        wordWrap: false
    },
    compiler: {
        cppStandard: 'c++17',
        optimization: '-O2',
        warnings: true
    },
    execution: {
        timeLimitEnabled: false,
        timeLimitSeconds: 3,
        clearTerminal: true,
        autoSendInput: true
    },
    appearance: {
        theme: 'kawaii-light',
        bgOpacity: 50,
        bgUrl: 'assets/background.jpg',
        performanceMode: false
    },
    terminal: {
        colorScheme: 'ansi-16'
    },
    panels: {
        showIO: false,
        showTerm: true,
        showProblems: false
    }
};

// ============================================================================
// APPLICATION STATE
// ============================================================================
const App = {
    editor: null,
    editor2: null,
    activeEditor: 1,
    isSplit: false,
    tabs: [],
    activeTabId: null,
    splitTabId: null,
    exePath: null,
    isRunning: false,
    ready: false,
    showIO: false,
    showTerm: true,
    showProblems: false,
    problems: [],
    inputLines: [],
    inputIndex: 0,
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    errorDecorations: [],
    runTimeout: null
};

const DEFAULT_CODE = `#include <iostream>
using namespace std;

int main() {
    cout << "Toi yeu gai alimi";
    return 0;
}
`;

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    applySettings(); // Apply saved settings on load
    initMonaco();
    initHeader();
    initMenus();
    initPanels();
    initResizers();
    initShortcuts();
    initTabsScroll();
    initSettings();
    initTabDrag();
    updateUI();
});

function initMonaco() {
    require(['vs/editor/editor.main'], function () {
        // Define all Monaco themes
        defineMonacoThemes();

        App.editor = createEditor('editor-container');
        App.ready = true;

        // Apply initial theme
        applyTheme(App.settings.appearance.theme);

        // Track active editor on focus
        document.getElementById('editor-container').addEventListener('mousedown', () => {
            App.activeEditor = 1;
        });

        // Ctrl + Wheel zoom in/out
        initCtrlWheelZoom();
    });
}

// Ctrl + Wheel to zoom in/out editor font
function initCtrlWheelZoom() {
    // Use capture phase to intercept before Monaco handles it
    window.addEventListener('wheel', e => {
        if (!e.ctrlKey) return;

        // Check if wheel is over an editor container
        const editorContainer = e.target.closest('#editor-container, #editor-container-2');
        if (!editorContainer) return;

        e.preventDefault();
        e.stopPropagation();

        const delta = e.deltaY > 0 ? -1 : 1;
        const currentSize = App.settings.editor.fontSize;
        const newSize = Math.min(40, Math.max(8, currentSize + delta));

        if (newSize !== currentSize) {
            App.settings.editor.fontSize = newSize;

            // Update all editors
            if (App.editor) App.editor.updateOptions({ fontSize: newSize });
            if (App.editor2) App.editor2.updateOptions({ fontSize: newSize });

            // Save settings
            saveSettings();
        }
    }, { passive: false, capture: true });
}

// ============================================================================
// MONACO EDITOR THEMES
// ============================================================================
function defineMonacoThemes() {
    // Kawaii Dark Theme
    monaco.editor.defineTheme('kawaii-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6a8a9a', fontStyle: 'italic' },
            { token: 'keyword', foreground: '88c9ea' },
            { token: 'string', foreground: 'a3d9a5' },
            { token: 'number', foreground: 'ebcb8b' },
            { token: 'type', foreground: 'e8a8b8' },
            { token: 'function', foreground: '7ec8e3' },
        ],
        colors: {
            'editor.background': '#1a2530',
            'editor.foreground': '#e0f0ff',
            'editor.lineHighlightBackground': '#243040',
            'editor.selectionBackground': '#88c9ea40',
            'editorCursor.foreground': '#88c9ea',
            'editorLineNumber.foreground': '#4a6a7a',
            'editorLineNumber.activeForeground': '#88c9ea',
            'scrollbarSlider.background': '#4a6a7a50',
            'scrollbarSlider.hoverBackground': '#6a8a9a70',
            'scrollbarSlider.activeBackground': '#88c9ea80',
        }
    });

    // Kawaii Light Theme - Uses same dark editor as kawaii-dark for consistency
    monaco.editor.defineTheme('kawaii-light', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6a8a9a', fontStyle: 'italic' },
            { token: 'keyword', foreground: '88c9ea' },
            { token: 'string', foreground: 'a3d9a5' },
            { token: 'number', foreground: 'ebcb8b' },
            { token: 'type', foreground: 'e8a8b8' },
            { token: 'function', foreground: '7ec8e3' },
        ],
        colors: {
            'editor.background': '#1a2530',
            'editor.foreground': '#e0f0ff',
            'editor.lineHighlightBackground': '#243040',
            'editor.selectionBackground': '#88c9ea40',
            'editorCursor.foreground': '#88c9ea',
            'editorLineNumber.foreground': '#4a6a7a',
            'editorLineNumber.activeForeground': '#88c9ea',
            'scrollbarSlider.background': '#4a6a7a50',
            'scrollbarSlider.hoverBackground': '#6a8a9a70',
            'scrollbarSlider.activeBackground': '#88c9ea80',
        }
    });

    // Dracula Theme
    monaco.editor.defineTheme('dracula', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'ff79c6' },
            { token: 'string', foreground: 'f1fa8c' },
            { token: 'number', foreground: 'bd93f9' },
            { token: 'type', foreground: '8be9fd', fontStyle: 'italic' },
            { token: 'function', foreground: '50fa7b' },
            { token: 'variable', foreground: 'f8f8f2' },
            { token: 'operator', foreground: 'ff79c6' },
        ],
        colors: {
            'editor.background': '#282a36',
            'editor.foreground': '#f8f8f2',
            'editor.lineHighlightBackground': '#44475a',
            'editor.selectionBackground': '#44475a',
            'editorCursor.foreground': '#f8f8f2',
            'editorLineNumber.foreground': '#6272a4',
            'editorLineNumber.activeForeground': '#f8f8f2',
            'scrollbarSlider.background': '#6272a450',
            'scrollbarSlider.hoverBackground': '#6272a470',
            'scrollbarSlider.activeBackground': '#bd93f980',
        }
    });

    // Monokai Theme
    monaco.editor.defineTheme('monokai', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '75715e', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'f92672' },
            { token: 'string', foreground: 'e6db74' },
            { token: 'number', foreground: 'ae81ff' },
            { token: 'type', foreground: '66d9ef', fontStyle: 'italic' },
            { token: 'function', foreground: 'a6e22e' },
            { token: 'variable', foreground: 'f8f8f2' },
            { token: 'operator', foreground: 'f92672' },
        ],
        colors: {
            'editor.background': '#272822',
            'editor.foreground': '#f8f8f2',
            'editor.lineHighlightBackground': '#3e3d32',
            'editor.selectionBackground': '#49483e',
            'editorCursor.foreground': '#f8f8f0',
            'editorLineNumber.foreground': '#75715e',
            'editorLineNumber.activeForeground': '#f8f8f2',
            'scrollbarSlider.background': '#75715e50',
            'scrollbarSlider.hoverBackground': '#75715e70',
            'scrollbarSlider.activeBackground': '#a6e22e80',
        }
    });

    // Nord Theme
    monaco.editor.defineTheme('nord', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '616e88', fontStyle: 'italic' },
            { token: 'keyword', foreground: '81a1c1' },
            { token: 'string', foreground: 'a3be8c' },
            { token: 'number', foreground: 'b48ead' },
            { token: 'type', foreground: '8fbcbb' },
            { token: 'function', foreground: '88c0d0' },
            { token: 'variable', foreground: 'eceff4' },
            { token: 'operator', foreground: '81a1c1' },
        ],
        colors: {
            'editor.background': '#2e3440',
            'editor.foreground': '#eceff4',
            'editor.lineHighlightBackground': '#3b4252',
            'editor.selectionBackground': '#434c5e',
            'editorCursor.foreground': '#d8dee9',
            'editorLineNumber.foreground': '#4c566a',
            'editorLineNumber.activeForeground': '#d8dee9',
            'scrollbarSlider.background': '#4c566a50',
            'scrollbarSlider.hoverBackground': '#4c566a70',
            'scrollbarSlider.activeBackground': '#88c0d080',
        }
    });

    // One Dark Pro Theme
    monaco.editor.defineTheme('one-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'c678dd' },
            { token: 'string', foreground: '98c379' },
            { token: 'number', foreground: 'd19a66' },
            { token: 'type', foreground: 'e5c07b' },
            { token: 'function', foreground: '61afef' },
            { token: 'variable', foreground: 'e06c75' },
            { token: 'operator', foreground: '56b6c2' },
        ],
        colors: {
            'editor.background': '#282c34',
            'editor.foreground': '#abb2bf',
            'editor.lineHighlightBackground': '#2c313c',
            'editor.selectionBackground': '#3e4451',
            'editorCursor.foreground': '#528bff',
            'editorLineNumber.foreground': '#495162',
            'editorLineNumber.activeForeground': '#abb2bf',
            'scrollbarSlider.background': '#4b516050',
            'scrollbarSlider.hoverBackground': '#5c637070',
            'scrollbarSlider.activeBackground': '#61afef80',
        }
    });
}


function createEditor(containerId) {
    const editor = monaco.editor.create(document.getElementById(containerId), {
        value: '',
        language: 'cpp',
        theme: App.settings.appearance.theme || 'kawaii-dark',
        fontSize: App.settings.editor.fontSize,
        fontFamily: App.settings.editor.fontFamily,
        fontLigatures: true,
        minimap: { enabled: App.settings.editor.minimap },
        wordWrap: App.settings.editor.wordWrap ? 'on' : 'off',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: App.settings.editor.tabSize,
        cursorBlinking: 'smooth',
        smoothScrolling: false,
        bracketPairColorization: { enabled: true },
        padding: { top: 12 },
        // Hide the white circle on scrollbar (overview ruler decorations)
        overviewRulerBorder: false,
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: {
            // VSCode-like scrollbar - simple rectangle, no decorations
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 14,
            horizontalScrollbarSize: 14,
            arrowSize: 0,
            useShadows: false,
            // Make slider visible but subtle
            verticalSliderSize: 14,
            horizontalSliderSize: 14
        },
        // Minimap with normal slider
        minimap: {
            enabled: App.settings.editor.minimap,
            showSlider: 'always',  // Show slider normally
            renderCharacters: true,
            scale: 1
        },
        // Disable code suggestions/autocomplete
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        acceptSuggestionOnEnter: 'off',
        tabCompletion: 'off',
        wordBasedSuggestions: 'off',
        parameterHints: { enabled: false },
        suggest: { enabled: false }
    });

    editor.onDidChangeCursorPosition(e => {
        document.getElementById('cursor-pos').textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
    });

    editor.onDidChangeModelContent(() => {
        const tabId = containerId === 'editor-container' ? App.activeTabId : App.splitTabId;
        if (tabId) {
            const tab = App.tabs.find(t => t.id === tabId);
            if (tab) {
                const modified = editor.getValue() !== tab.original;
                if (tab.modified !== modified) {
                    tab.modified = modified;
                    renderTabs();
                }
            }
        }
        clearErrorDecorations();
    });

    // Shortcuts
    editor.addCommand(monaco.KeyCode.F11, buildRun);
    editor.addCommand(monaco.KeyCode.F10, run);
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F5, stop);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, save);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, newFile);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO, openFile);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, toggleProblems);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Comma, openSettings);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backslash, toggleSplit);

    return editor;
}

// ============================================================================
// SPLIT EDITOR
// ============================================================================
function toggleSplit() {
    if (App.isSplit) {
        closeSplit();
    } else {
        openSplit();
    }
}

function openSplit() {
    if (App.isSplit || App.tabs.length < 1) return;

    App.isSplit = true;

    // Show split pane
    document.getElementById('editor-pane-2').style.display = 'flex';
    document.getElementById('resizer-split').style.display = 'block';

    // Create second editor if not exists
    if (!App.editor2) {
        App.editor2 = createEditor('editor-container-2');
        document.getElementById('editor-container-2').addEventListener('mousedown', () => {
            App.activeEditor = 2;
        });
    }

    // Set same content or pick another tab
    if (App.tabs.length > 1) {
        // Find another tab
        const otherTab = App.tabs.find(t => t.id !== App.activeTabId);
        if (otherTab) {
            App.splitTabId = otherTab.id;
            App.editor2.setValue(otherTab.content);
        }
    } else {
        // Same file in split
        App.splitTabId = App.activeTabId;
        const tab = App.tabs.find(t => t.id === App.activeTabId);
        if (tab) App.editor2.setValue(tab.content);
    }

    log('Split editor opened', 'info');
}

function closeSplit() {
    if (!App.isSplit) return;

    // Save split editor content
    if (App.splitTabId && App.editor2) {
        const tab = App.tabs.find(t => t.id === App.splitTabId);
        if (tab) tab.content = App.editor2.getValue();
    }

    App.isSplit = false;
    App.splitTabId = null;
    App.activeEditor = 1;

    document.getElementById('editor-pane-2').style.display = 'none';
    document.getElementById('resizer-split').style.display = 'none';

    log('Split editor closed', 'info');
}

function initTabDrag() {
    // Make tabs draggable to split
    const container = document.getElementById('tabs-container');
    const editorPane1 = document.getElementById('editor-pane-1');
    const editorPane2 = document.getElementById('editor-pane-2');

    let draggedTabId = null;

    container.addEventListener('dragstart', e => {
        const tab = e.target.closest('.tab');
        if (tab) {
            draggedTabId = tab.dataset.id;
            e.dataTransfer.effectAllowed = 'move';
            tab.classList.add('dragging');
        }
    });

    container.addEventListener('dragend', e => {
        const tab = e.target.closest('.tab');
        if (tab) tab.classList.remove('dragging');
        draggedTabId = null;
    });

    // Drop zones on editor panes
    [editorPane1, editorPane2].forEach((pane, idx) => {
        pane.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            pane.classList.add('drop-target');
        });

        pane.addEventListener('dragleave', () => {
            pane.classList.remove('drop-target');
        });

        pane.addEventListener('drop', e => {
            e.preventDefault();
            pane.classList.remove('drop-target');

            if (!draggedTabId) return;

            const tab = App.tabs.find(t => t.id === draggedTabId);
            if (!tab) return;

            if (idx === 0) {
                // Dropped on primary editor
                setActive(draggedTabId);
            } else {
                // Dropped on secondary editor - open split if needed
                if (!App.isSplit) openSplit();
                App.splitTabId = draggedTabId;
                if (App.editor2) App.editor2.setValue(tab.content);
            }
        });
    });
}

// Setup split resizer
function setupSplitResizer() {
    const resizer = document.getElementById('resizer-split');
    const pane1 = document.getElementById('editor-pane-1');
    const pane2 = document.getElementById('editor-pane-2');
    let dragging = false;
    let startX, startW1, startW2;

    resizer.onmousedown = e => {
        dragging = true;
        startX = e.clientX;
        startW1 = pane1.offsetWidth;
        startW2 = pane2.offsetWidth;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    };

    document.addEventListener('mousemove', e => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const newW1 = Math.max(200, startW1 + dx);
        const newW2 = Math.max(200, startW2 - dx);
        pane1.style.flex = 'none';
        pane2.style.flex = 'none';
        pane1.style.width = newW1 + 'px';
        pane2.style.width = newW2 + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor = '';
        }
    });
}

// ============================================================================
// SETTINGS
// ============================================================================
function loadSettings() {
    try {
        let saved = null;
        if (window.electronAPI?.loadSettings) {
            saved = window.electronAPI.loadSettings();
        } else {
            const storedStr = localStorage.getItem('ide-settings');
            if (storedStr) saved = JSON.parse(storedStr);
        }

        if (saved) {
            // Deep merge each section to preserve new defaults
            App.settings = {
                editor: { ...DEFAULT_SETTINGS.editor, ...saved.editor },
                compiler: { ...DEFAULT_SETTINGS.compiler, ...saved.compiler },
                execution: { ...DEFAULT_SETTINGS.execution, ...saved.execution },
                appearance: { ...DEFAULT_SETTINGS.appearance, ...saved.appearance },
                terminal: { ...DEFAULT_SETTINGS.terminal, ...saved.terminal },
                panels: { ...DEFAULT_SETTINGS.panels, ...saved.panels }
            };
        }

        // Load panels state from settings
        if (App.settings.panels) {
            App.showIO = App.settings.panels.showIO ?? false;
            App.showTerm = App.settings.panels.showTerm ?? true;
            App.showProblems = App.settings.panels.showProblems ?? false;
        }
    } catch (e) {
        console.log('Using default settings', e);
    }
}

function saveSettings() {
    try {
        console.log('[Settings] Saving:', JSON.stringify(App.settings.appearance));
        if (window.electronAPI?.saveSettings) {
            window.electronAPI.saveSettings(App.settings);
        } else {
            localStorage.setItem('ide-settings', JSON.stringify(App.settings));
        }
    } catch (e) {
        console.error('Failed to save settings', e);
    }
}

function initSettings() {
    document.getElementById('btn-settings').onclick = openSettings;
    document.getElementById('settings-close').onclick = closeSettings;
    document.getElementById('settings-overlay').onclick = e => {
        if (e.target.id === 'settings-overlay') closeSettings();
    };

    // Tab switching
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.onclick = () => {
            // Remove active from all tabs
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));

            // Add active to clicked tab
            tab.classList.add('active');
            const panelId = 'panel-' + tab.dataset.tab;
            document.getElementById(panelId)?.classList.add('active');

            // Re-apply theme colors to fix inline styles
            updateThemePreview();
        };
    });

    const fontSizeSlider = document.getElementById('set-fontSize');
    fontSizeSlider.oninput = () => {
        document.getElementById('val-fontSize').textContent = fontSizeSlider.value + 'px';
    };

    // Background opacity slider
    const bgOpacitySlider = document.getElementById('set-bgOpacity');
    bgOpacitySlider.oninput = () => {
        document.getElementById('val-bgOpacity').textContent = bgOpacitySlider.value + '%';
    };

    // Theme preview - update when theme changes
    document.getElementById('set-theme').onchange = updateThemePreview;

    // Background file upload
    document.getElementById('set-bgFile').onchange = e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = ev => {
                document.getElementById('set-bgUrl').value = ev.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    // Reset background button
    document.getElementById('btn-reset-bg').onclick = () => {
        document.getElementById('set-bgUrl').value = 'assets/background.jpg';
    };

    document.getElementById('btn-save-settings').onclick = saveSettingsAndClose;
    document.getElementById('btn-reset-settings').onclick = resetSettings;
}

// Theme color palettes for preview and settings
const THEME_COLORS = {
    'kawaii-dark': {
        headerBg: '#2d3748', editorBg: '#1a202c', terminalBg: '#171923', statusBg: '#2d3748', ioBg: '#1e2530',
        text: '#e2e8f0', textMuted: '#a0aec0', lineNum: '#4a5568',
        keyword: '#88c9ea', string: '#a3d9a5', type: '#ebcb8b', func: '#88c9ea',
        accent: '#88c9ea', success: '#68d391', info: '#63b3ed',
        // Settings popup colors
        popupBg: '#2d3748', sidebarBg: '#1e2530', contentBg: '#1a202c',
        border: '#4a5568', borderLight: '#3d4a5c', accentColor: '#88c9ea'
    },
    'kawaii-light': {
        headerBg: '#88c9ea', editorBg: '#f8fafc', terminalBg: '#1e2530', statusBg: '#88c9ea', ioBg: '#ffffff',
        text: '#2d3748', textMuted: '#64748b', lineNum: '#a0aec0',
        keyword: '#3182ce', string: '#38a169', type: '#d69e2e', func: '#9f7aea',
        accent: '#88c9ea', success: '#38a169', info: '#3182ce',
        // Settings popup colors
        popupBg: '#e8f4fc', sidebarBg: '#ffffff', contentBg: '#ffffff',
        border: '#b8e2f5', borderLight: '#d4eef8', accentColor: '#7fc4e8',
        headerFooterBg: '#c8e7f5'
    },
    'dracula': {
        headerBg: '#282a36', editorBg: '#282a36', terminalBg: '#1e1f29', statusBg: '#282a36', ioBg: '#21222c',
        text: '#f8f8f2', textMuted: '#6272a4', lineNum: '#6272a4',
        keyword: '#ff79c6', string: '#50fa7b', type: '#8be9fd', func: '#ffb86c',
        accent: '#bd93f9', success: '#50fa7b', info: '#8be9fd',
        // Settings popup colors
        popupBg: '#282a36', sidebarBg: '#21222c', contentBg: '#282a36',
        border: '#6272a4', borderLight: '#44475a', accentColor: '#bd93f9'
    },
    'monokai': {
        headerBg: '#272822', editorBg: '#272822', terminalBg: '#1e1f1c', statusBg: '#272822', ioBg: '#1e1f1c',
        text: '#f8f8f2', textMuted: '#75715e', lineNum: '#75715e',
        keyword: '#f92672', string: '#a6e22e', type: '#66d9ef', func: '#e6db74',
        accent: '#a6e22e', success: '#a6e22e', info: '#66d9ef',
        // Settings popup colors
        popupBg: '#272822', sidebarBg: '#1e1f1c', contentBg: '#272822',
        border: '#75715e', borderLight: '#49483e', accentColor: '#a6e22e'
    },
    'nord': {
        headerBg: '#3b4252', editorBg: '#2e3440', terminalBg: '#242933', statusBg: '#3b4252', ioBg: '#2e3440',
        text: '#eceff4', textMuted: '#4c566a', lineNum: '#4c566a',
        keyword: '#b48ead', string: '#a3be8c', type: '#88c0d0', func: '#ebcb8b',
        accent: '#88c0d0', success: '#a3be8c', info: '#88c0d0',
        // Settings popup colors
        popupBg: '#2e3440', sidebarBg: '#3b4252', contentBg: '#2e3440',
        border: '#4c566a', borderLight: '#434c5e', accentColor: '#88c0d0'
    },
    'one-dark': {
        headerBg: '#282c34', editorBg: '#282c34', terminalBg: '#21252b', statusBg: '#282c34', ioBg: '#21252b',
        text: '#abb2bf', textMuted: '#5c6370', lineNum: '#4b5263',
        keyword: '#c678dd', string: '#98c379', type: '#61afef', func: '#e5c07b',
        accent: '#61afef', success: '#98c379', info: '#61afef',
        // Settings popup colors
        popupBg: '#282c34', sidebarBg: '#21252b', contentBg: '#282c34',
        border: '#5c6370', borderLight: '#3e4452', accentColor: '#61afef'
    }
};

function updateThemePreview() {
    const theme = document.getElementById('set-theme').value;
    const colors = THEME_COLORS[theme] || THEME_COLORS['kawaii-dark'];
    const preview = document.getElementById('theme-preview');
    if (!preview) return;

    const isLight = theme === 'kawaii-light';

    // Preview window background
    preview.style.background = colors.editorBg;
    preview.style.borderColor = colors.headerBg;

    // Header
    const header = preview.querySelector('.preview-header');
    if (header) {
        header.style.background = colors.headerBg;
    }

    // Tab in header
    const tab = preview.querySelector('.preview-tab');
    if (tab) {
        tab.style.background = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.1)';
        tab.style.color = isLight ? colors.text : colors.textMuted;
    }

    // Body background
    const body = preview.querySelector('.preview-body');
    if (body) {
        body.style.background = isLight ? 'rgba(136,201,234,0.15)' : 'rgba(0,0,0,0.2)';
    }

    // Editor
    const editor = preview.querySelector('.preview-editor');
    if (editor) {
        editor.style.background = colors.editorBg;
        editor.style.color = colors.text;
        editor.style.borderColor = isLight ? 'rgba(136,201,234,0.4)' : 'rgba(255,255,255,0.1)';
    }

    // IO panels
    preview.querySelectorAll('.preview-io-panel').forEach(panel => {
        panel.style.background = colors.ioBg;
        panel.style.borderColor = isLight ? 'rgba(136,201,234,0.4)' : 'rgba(255,255,255,0.1)';
    });
    preview.querySelectorAll('.preview-io-header').forEach(h => {
        h.style.color = colors.accent;
        h.style.background = isLight ? 'rgba(136,201,234,0.2)' : 'rgba(136,201,234,0.1)';
    });
    preview.querySelectorAll('.preview-io-body').forEach(b => {
        b.style.color = colors.textMuted;
    });

    // Terminal
    const terminal = preview.querySelector('.preview-terminal');
    if (terminal) {
        terminal.style.background = colors.terminalBg;
        terminal.style.borderColor = isLight ? 'rgba(136,201,234,0.4)' : 'rgba(255,255,255,0.1)';
    }
    const termHeader = preview.querySelector('.preview-term-header');
    if (termHeader) {
        termHeader.style.color = colors.accent;
    }
    const termContent = preview.querySelector('.preview-term-content');
    if (termContent) {
        termContent.style.color = colors.text;
    }

    // Syntax highlighting
    preview.querySelectorAll('.ln').forEach(el => el.style.color = colors.lineNum);
    preview.querySelectorAll('.kw').forEach(el => el.style.color = colors.keyword);
    preview.querySelectorAll('.str').forEach(el => el.style.color = colors.string);
    preview.querySelectorAll('.type').forEach(el => el.style.color = colors.type);
    preview.querySelectorAll('.fn').forEach(el => el.style.color = colors.func);

    // Terminal output colors
    preview.querySelectorAll('.term-success').forEach(el => el.style.color = colors.success);
    preview.querySelectorAll('.term-output').forEach(el => el.style.color = colors.text);
    preview.querySelectorAll('.term-info').forEach(el => el.style.color = colors.info);

    // Status bar
    const statusbar = preview.querySelector('.preview-statusbar');
    if (statusbar) {
        statusbar.style.background = colors.statusBg;
        statusbar.style.color = isLight ? colors.text : colors.textMuted;
    }

    // Status dot
    const statusDot = preview.querySelector('.status-dot');
    if (statusDot) {
        statusDot.style.background = colors.success;
    }

    // Sync settings popup colors with theme
    const popup = document.querySelector('.settings-popup');
    const sidebar = document.querySelector('.settings-sidebar');
    const content = document.querySelector('.settings-content');
    const settingsHeader = document.querySelector('.settings-header');
    const footer = document.querySelector('.settings-footer');
    const container = document.querySelector('.settings-container');

    if (popup) {
        popup.style.background = colors.popupBg;
        popup.style.borderColor = colors.border;
    }
    if (sidebar) {
        sidebar.style.background = colors.sidebarBg;
        sidebar.style.borderColor = colors.border;
    }
    if (content) {
        content.style.background = colors.contentBg;
        content.style.borderColor = colors.border;
    }

    // Use headerFooterBg if available (for kawaii-light), else popupBg
    const hfBg = colors.headerFooterBg || colors.popupBg;

    if (settingsHeader) {
        settingsHeader.style.background = hfBg;
        settingsHeader.style.borderColor = colors.borderLight;
        const h2 = settingsHeader.querySelector('h2');
        if (h2) h2.style.color = colors.accentColor;
    }
    if (footer) {
        footer.style.background = hfBg;
        footer.style.borderColor = colors.borderLight;
    }
    if (container) {
        container.style.background = colors.popupBg;
    }

    // Update tabs - reset all first, then style active
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.style.background = 'transparent';
        tab.style.color = colors.textMuted;
    });
    document.querySelectorAll('.settings-tab.active').forEach(tab => {
        tab.style.background = colors.accentColor;
        tab.style.color = '#ffffff';
    });

    // Update panel headers
    document.querySelectorAll('.settings-panel h3').forEach(h3 => {
        h3.style.color = colors.accentColor;
        h3.style.borderColor = colors.borderLight;
    });

    // Update setting rows
    document.querySelectorAll('.setting-row').forEach(row => {
        row.style.background = isLight ? '#f5fafd' : colors.sidebarBg;
        row.style.borderColor = colors.borderLight;
        const label = row.querySelector('label');
        if (label) label.style.color = colors.textMuted;
    });

    // Update buttons
    const btnSave = document.querySelector('.btn-save');
    if (btnSave) {
        btnSave.style.background = colors.accentColor;
        btnSave.style.borderColor = colors.accent;
    }
    const btnReset = document.querySelector('.btn-reset');
    if (btnReset) {
        btnReset.style.background = colors.contentBg;
        btnReset.style.color = colors.accentColor;
        btnReset.style.borderColor = colors.border;
    }
}

function openSettings() {
    document.getElementById('set-fontSize').value = App.settings.editor.fontSize;
    document.getElementById('val-fontSize').textContent = App.settings.editor.fontSize + 'px';
    document.getElementById('set-fontFamily').value = App.settings.editor.fontFamily;
    document.getElementById('set-tabSize').value = App.settings.editor.tabSize;
    document.getElementById('set-minimap').checked = App.settings.editor.minimap;
    document.getElementById('set-wordWrap').checked = App.settings.editor.wordWrap;

    document.getElementById('set-cppStandard').value = App.settings.compiler.cppStandard;
    document.getElementById('set-optimization').value = App.settings.compiler.optimization;
    document.getElementById('set-warnings').checked = App.settings.compiler.warnings;

    document.getElementById('set-timeLimitEnabled').checked = App.settings.execution.timeLimitEnabled;
    document.getElementById('set-timeLimitSeconds').value = App.settings.execution.timeLimitSeconds;
    document.getElementById('set-clearTerminal').checked = App.settings.execution.clearTerminal;
    document.getElementById('set-autoSendInput').checked = App.settings.execution.autoSendInput;

    document.getElementById('set-terminalColorScheme').value = App.settings.terminal?.colorScheme || 'ansi-16';

    document.getElementById('set-theme').value = App.settings.appearance.theme;
    document.getElementById('set-performanceMode').checked = App.settings.appearance.performanceMode || false;
    document.getElementById('set-bgOpacity').value = App.settings.appearance.bgOpacity || 50;
    document.getElementById('val-bgOpacity').textContent = (App.settings.appearance.bgOpacity || 50) + '%';
    document.getElementById('set-bgUrl').value = App.settings.appearance.bgUrl || '';

    // Update theme preview to match current theme
    updateThemePreview();

    document.getElementById('settings-overlay').classList.add('show');
}

function closeSettings() {
    document.getElementById('settings-overlay').classList.remove('show');
}

function saveSettingsAndClose() {
    App.settings.editor.fontSize = parseInt(document.getElementById('set-fontSize').value);
    App.settings.editor.fontFamily = document.getElementById('set-fontFamily').value;
    App.settings.editor.tabSize = parseInt(document.getElementById('set-tabSize').value);
    App.settings.editor.minimap = document.getElementById('set-minimap').checked;
    App.settings.editor.wordWrap = document.getElementById('set-wordWrap').checked;

    App.settings.compiler.cppStandard = document.getElementById('set-cppStandard').value;
    App.settings.compiler.optimization = document.getElementById('set-optimization').value;
    App.settings.compiler.warnings = document.getElementById('set-warnings').checked;

    App.settings.execution.timeLimitEnabled = document.getElementById('set-timeLimitEnabled').checked;
    App.settings.execution.timeLimitSeconds = parseInt(document.getElementById('set-timeLimitSeconds').value);
    App.settings.execution.clearTerminal = document.getElementById('set-clearTerminal').checked;
    App.settings.execution.autoSendInput = document.getElementById('set-autoSendInput').checked;

    if (!App.settings.terminal) App.settings.terminal = {};
    App.settings.terminal.colorScheme = document.getElementById('set-terminalColorScheme').value;

    App.settings.appearance.theme = document.getElementById('set-theme').value;
    App.settings.appearance.performanceMode = document.getElementById('set-performanceMode').checked;
    App.settings.appearance.bgOpacity = parseInt(document.getElementById('set-bgOpacity').value);
    App.settings.appearance.bgUrl = document.getElementById('set-bgUrl').value;

    applySettings();
    saveSettings();
    closeSettings();
    log('Settings saved', 'success');
}

function resetSettings() {
    if (confirm('Reset all settings to defaults?')) {
        App.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        applySettings();
        saveSettings();
        openSettings();
        log('Settings reset to defaults', 'info');
    }
}

function applySettings() {
    const opts = {
        fontSize: App.settings.editor.fontSize,
        fontFamily: App.settings.editor.fontFamily,
        tabSize: App.settings.editor.tabSize,
        minimap: { enabled: App.settings.editor.minimap },
        wordWrap: App.settings.editor.wordWrap ? 'on' : 'off'
    };
    if (App.editor) App.editor.updateOptions(opts);
    if (App.editor2) App.editor2.updateOptions(opts);

    // Apply Performance Mode
    if (App.settings.appearance.performanceMode) {
        document.body.classList.add('performance-mode');
    } else {
        document.body.classList.remove('performance-mode');
    }

    // Apply Theme
    applyTheme(App.settings.appearance.theme);

    // Apply background opacity overlay
    applyBackgroundSettings();
}

// ============================================================================
// THEME APPLICATION
// ============================================================================
function applyTheme(themeName) {
    const theme = themeName || 'kawaii-dark';

    // Set data-theme attribute on html element for CSS
    document.documentElement.setAttribute('data-theme', theme);

    // Update Monaco editor theme if editors exist
    if (typeof monaco !== 'undefined') {
        monaco.editor.setTheme(theme);
    }

    // Apply theme-specific background 
    applyBackgroundSettings();
}

function applyBackgroundSettings() {
    const theme = App.settings.appearance.theme || 'kawaii-dark';
    const bgUrl = App.settings.appearance.bgUrl;
    const opacity = (App.settings.appearance.bgOpacity || 50) / 100;

    // Define theme-specific backgrounds
    const themeBackgrounds = {
        'kawaii-dark': {
            default: 'linear-gradient(135deg, #1a2530 0%, #152535 100%)',
            overlay: `rgba(26, 37, 48, ${0.3 + opacity * 0.5})`
        },
        'kawaii-light': {
            default: 'linear-gradient(135deg, #e8f4fc 0%, #d4eaf7 50%, #c5e3f6 100%)',
            overlay: `rgba(255, 255, 255, ${opacity * 0.3})`
        },
        'dracula': {
            default: 'linear-gradient(135deg, #282a36 0%, #21222c 100%)',
            overlay: `rgba(40, 42, 54, ${0.3 + opacity * 0.5})`
        },
        'monokai': {
            default: 'linear-gradient(135deg, #272822 0%, #1e1f1c 100%)',
            overlay: `rgba(39, 40, 34, ${0.3 + opacity * 0.5})`
        },
        'nord': {
            default: 'linear-gradient(135deg, #2e3440 0%, #242931 100%)',
            overlay: `rgba(46, 52, 64, ${0.3 + opacity * 0.5})`
        },
        'one-dark': {
            default: 'linear-gradient(135deg, #282c34 0%, #21252b 100%)',
            overlay: `rgba(40, 44, 52, ${0.3 + opacity * 0.5})`
        }
    };

    const themeConfig = themeBackgrounds[theme] || themeBackgrounds['kawaii-dark'];

    // Apply custom background or theme default
    if (bgUrl) {
        document.body.style.background = `url('${bgUrl}') no-repeat center center fixed`;
        document.body.style.backgroundSize = 'cover';
    } else {
        document.body.style.background = themeConfig.default;
    }

    // Apply overlay
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
        if (bgUrl) {
            appContainer.style.background = themeConfig.overlay;
        } else {
            appContainer.style.background = 'transparent';
        }
    }
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================
function initShortcuts() {
    document.addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 's') { e.preventDefault(); save(); }
        if (e.ctrlKey && e.key === 'o') { e.preventDefault(); openFile(); }
        if (e.ctrlKey && e.key === 'n') { e.preventDefault(); newFile(); }
        if (e.ctrlKey && e.key === 'w') { e.preventDefault(); if (App.activeTabId) closeTab(App.activeTabId); }
        if (e.ctrlKey && e.key === 'j') { e.preventDefault(); toggleProblems(); }
        if (e.ctrlKey && e.key === ',') { e.preventDefault(); openSettings(); }
        if (e.ctrlKey && e.key === '\\') { e.preventDefault(); toggleSplit(); }
        if (e.key === 'F11') { e.preventDefault(); buildRun(); }
        if (e.key === 'F10') { e.preventDefault(); run(); }
        if (e.key === 'F5' && e.shiftKey) { e.preventDefault(); stop(); }
        if (e.key === 'Escape') closeSettings();
    });
}

function initTabsScroll() {
    const container = document.getElementById('tabs-container');
    container.addEventListener('wheel', e => {
        if (e.deltaY !== 0) {
            e.preventDefault();
            container.scrollLeft += e.deltaY;
        }
    });
}

// ============================================================================
// UI UPDATE
// ============================================================================
function updateUI() {
    const hasTabs = App.tabs.length > 0;
    document.getElementById('welcome').style.display = hasTabs ? 'none' : 'flex';
    document.getElementById('editor-section').style.display = hasTabs ? 'flex' : 'none';

    // Use class toggle instead of display style to preserve CSS properties
    document.getElementById('io-section').classList.toggle('panel-hidden', !App.showIO);
    document.getElementById('resizer-io').classList.toggle('panel-hidden', !App.showIO);
    document.getElementById('btn-toggle-io').classList.toggle('active', App.showIO);

    document.getElementById('terminal-section').classList.toggle('panel-hidden', !App.showTerm);
    document.getElementById('resizer-term').classList.toggle('panel-hidden', !App.showTerm);
    document.getElementById('btn-toggle-term').classList.toggle('active', App.showTerm);

    document.getElementById('problems-panel').classList.toggle('hidden', !App.showProblems);
    document.getElementById('resizer-problems').classList.toggle('panel-hidden', !App.showProblems);
    document.getElementById('btn-toggle-problems').classList.toggle('active', App.showProblems);
}

// ============================================================================
// HEADER
// ============================================================================
function initHeader() {
    document.getElementById('btn-new-tab').onclick = newFile;
    document.getElementById('btn-buildrun').onclick = buildRun;
    document.getElementById('btn-run-only').onclick = run;
    document.getElementById('btn-stop').onclick = stop;
    document.getElementById('btn-toggle-io').onclick = toggleIO;
    document.getElementById('btn-toggle-term').onclick = toggleTerm;
    document.getElementById('btn-toggle-problems').onclick = toggleProblems;

    document.getElementById('welcome-new').onclick = newFile;
    document.getElementById('welcome-open').onclick = openFile;

    document.getElementById('btn-close').onclick = () => window.electronAPI?.closeWindow?.();
    document.getElementById('btn-min').onclick = () => window.electronAPI?.minimizeWindow?.();
    document.getElementById('btn-max').onclick = () => window.electronAPI?.maximizeWindow?.();

    document.getElementById('tabs-container').onmousedown = e => {
        if (e.button === 1) {
            const tab = e.target.closest('.tab');
            if (tab) closeTab(tab.dataset.id);
        }
    };

    setupSplitResizer();
}

function toggleIO() {
    App.showIO = !App.showIO;
    if (!App.settings.panels) App.settings.panels = {};
    App.settings.panels.showIO = App.showIO;
    saveSettings();
    updateUI();
}
function toggleTerm() {
    App.showTerm = !App.showTerm;
    if (!App.settings.panels) App.settings.panels = {};
    App.settings.panels.showTerm = App.showTerm;
    saveSettings();
    updateUI();
}
function toggleProblems() {
    App.showProblems = !App.showProblems;
    if (!App.settings.panels) App.settings.panels = {};
    App.settings.panels.showProblems = App.showProblems;
    saveSettings();
    updateUI();
}

// ============================================================================
// PANELS
// ============================================================================
function initPanels() {
    document.getElementById('clear-input').onclick = () => { document.getElementById('input-area').value = ''; };
    document.getElementById('clear-output').onclick = () => {
        document.getElementById('expected-area').value = '';
        document.getElementById('expected-area').style.display = 'block';
        document.getElementById('expected-diff').style.display = 'none';
        document.getElementById('expected-diff').innerHTML = '';
    };
    document.getElementById('clear-term').onclick = clearTerm;
    document.getElementById('close-problems').onclick = () => { App.showProblems = false; updateUI(); };

    document.getElementById('btn-send').onclick = sendInput;
    document.getElementById('terminal-in').onkeypress = e => { if (e.key === 'Enter') sendInput(); };

    // Click on diff display to go back to edit mode
    document.getElementById('expected-diff').onclick = switchToExpectedEdit;
}

// ============================================================================
// RESIZERS
// ============================================================================
function initResizers() {
    setupResizer('resizer-io', 'io-section', 180, 500);
    setupResizer('resizer-term', 'terminal-section', 200, 600);
    setupResizerH('resizer-problems', 'problems-panel', 80, 400);
}

function setupResizer(resizerId, targetId, min, max) {
    const resizer = document.getElementById(resizerId);
    const target = document.getElementById(targetId);
    let dragging = false;
    let startX, startW;

    resizer.onmousedown = e => {
        dragging = true;
        startX = e.clientX;
        startW = target.offsetWidth;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    };

    document.addEventListener('mousemove', e => {
        if (!dragging) return;
        const dx = startX - e.clientX;
        const newW = Math.min(max, Math.max(min, startW + dx));
        target.style.width = newW + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor = '';
        }
    });
}

function setupResizerH(resizerId, targetId, min, max) {
    const resizer = document.getElementById(resizerId);
    const target = document.getElementById(targetId);
    let dragging = false;
    let startY, startH;

    resizer.onmousedown = e => {
        dragging = true;
        startY = e.clientY;
        startH = target.offsetHeight;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'row-resize';
        e.preventDefault();
    };

    document.addEventListener('mousemove', e => {
        if (!dragging) return;
        const dy = startY - e.clientY;
        const newH = Math.min(max, Math.max(min, startH + dy));
        target.style.height = newH + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor = '';
        }
    });
}

// ============================================================================
// TABS
// ============================================================================
function newFile() {
    const id = 'tab_' + Date.now();
    const tab = { id, name: 'untitled.cpp', path: null, content: DEFAULT_CODE, original: DEFAULT_CODE, modified: false };
    App.tabs.push(tab);
    setActive(id);
    updateUI();
}

function setActive(id) {
    const tab = App.tabs.find(t => t.id === id);
    if (!tab) return;

    // Save current editor content
    if (App.activeTabId && App.editor && App.ready) {
        const cur = App.tabs.find(t => t.id === App.activeTabId);
        if (cur) cur.content = App.editor.getValue();
    }

    App.activeTabId = id;
    if (App.editor && App.ready) {
        App.editor.setValue(tab.content);
        // Sync original to prevent false modified state
        tab.original = App.editor.getValue();
        tab.modified = false;
    }
    clearErrorDecorations();
    renderTabs();
}

function closeTab(id) {
    const idx = App.tabs.findIndex(t => t.id === id);
    if (idx === -1) return;

    const tab = App.tabs[idx];
    if (tab.modified && !confirm(`"${tab.name}" has unsaved changes. Close?`)) return;

    App.tabs.splice(idx, 1);

    // Close split if this was the split tab
    if (App.splitTabId === id) closeSplit();

    if (App.activeTabId === id) {
        if (App.tabs.length) setActive(App.tabs[Math.min(idx, App.tabs.length - 1)].id);
        else { App.activeTabId = null; if (App.editor) App.editor.setValue(''); }
    }
    renderTabs();
    updateUI();
}

function renderTabs() {
    const c = document.getElementById('tabs-container');
    c.innerHTML = '';
    App.tabs.forEach(t => {
        const el = document.createElement('div');
        el.className = 'tab' + (t.id === App.activeTabId ? ' active' : '') + (t.modified ? ' modified' : '');
        el.dataset.id = t.id;
        el.draggable = true;
        el.innerHTML = `<span class="tab-name">${t.name}</span><span class="tab-dot"></span><span class="tab-x">×</span>`;
        el.onclick = e => { if (!e.target.classList.contains('tab-x')) setActive(t.id); };
        el.querySelector('.tab-x').onclick = e => { e.stopPropagation(); closeTab(t.id); };
        c.appendChild(el);
    });
    // Auto-scroll to active tab
    setTimeout(() => {
        const activeTab = c.querySelector('.tab.active');
        if (activeTab) {
            activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, 10);
}

// ============================================================================
// MENUS
// ============================================================================
let activeMenu = null;

function initMenus() {
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.onclick = e => { toggleMenu('menu-' + btn.dataset.menu, btn); e.stopPropagation(); };
    });
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.onclick = () => { doAction(item.dataset.action); closeMenus(); };
    });
    document.onclick = closeMenus;
}

function toggleMenu(id, el) {
    const menu = document.getElementById(id);
    if (activeMenu === id) { closeMenus(); return; }
    closeMenus();
    menu.classList.add('show');
    el.classList.add('active');
    const rect = el.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = rect.bottom + 4 + 'px';
    activeMenu = id;
}

function closeMenus() {
    document.querySelectorAll('.dropdown').forEach(m => m.classList.remove('show'));
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    activeMenu = null;
}

function doAction(action) {
    const map = {
        new: newFile, open: openFile, save, run, buildrun: buildRun, stop,
        exit: () => window.electronAPI?.closeWindow?.(),
        undo: () => getActiveEditor()?.trigger('keyboard', 'undo'),
        redo: () => getActiveEditor()?.trigger('keyboard', 'redo'),
        find: () => getActiveEditor()?.trigger('keyboard', 'actions.find'),
        toggleio: toggleIO,
        toggleterm: toggleTerm,
        toggleproblems: toggleProblems,
        spliteditor: openSplit,
        closesplit: closeSplit,
        settings: openSettings
    };
    map[action]?.();
}

function getActiveEditor() {
    return App.activeEditor === 2 && App.editor2 ? App.editor2 : App.editor;
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================
async function openFile() { await window.electronAPI.openFile(); }

async function save() {
    const tab = App.tabs.find(t => t.id === App.activeTabId);
    if (!tab) return;
    tab.content = App.editor.getValue();

    if (tab.path) {
        const r = await window.electronAPI.saveFile({ path: tab.path, content: tab.content });
        if (r.success) { tab.original = tab.content; tab.modified = false; renderTabs(); setStatus('Saved', 'success'); }
    } else await saveAs();
}

async function saveAs() {
    const tab = App.tabs.find(t => t.id === App.activeTabId);
    if (!tab) return;
    tab.content = App.editor.getValue();
    const r = await window.electronAPI.saveFileDialog(tab.content);
    if (r.success) {
        tab.path = r.path;
        tab.name = r.path.split(/[/\\]/).pop();
        tab.original = tab.content;
        tab.modified = false;
        renderTabs();
        setStatus('Saved', 'success');
    }
}

// ============================================================================
// BUILD & RUN
// ============================================================================
async function buildRun() {
    const tab = App.tabs.find(t => t.id === App.activeTabId);
    if (!tab) { log('No file open', 'warning'); return; }
    if (!tab.path) { log('Save file first', 'warning'); await saveAs(); if (!tab.path) return; }

    tab.content = App.editor.getValue();
    await window.electronAPI.saveFile({ path: tab.path, content: tab.content });
    tab.original = tab.content; tab.modified = false; renderTabs();

    // Auto-show terminal when building
    if (!App.showTerm) {
        App.showTerm = true;
        if (App.settings.panels) App.settings.panels.showTerm = true;
        saveSettings();
        updateUI();
    }

    if (App.settings.execution.clearTerminal) clearTerm();
    clearProblems();
    clearErrorDecorations();

    log('Building...', 'info');
    setStatus('Building...', 'building');

    const t0 = Date.now();

    const flags = [];
    if (App.settings.compiler.cppStandard) flags.push(`-std=${App.settings.compiler.cppStandard}`);
    if (App.settings.compiler.optimization) flags.push(App.settings.compiler.optimization);
    if (App.settings.compiler.warnings) flags.push('-Wall', '-Wextra');

    const r = await window.electronAPI.compile({
        filePath: tab.path,
        content: tab.content,
        flags: flags.join(' ')
    });
    const ms = Date.now() - t0;

    if (r.success) {
        App.exePath = r.outputPath;
        log(`Build OK (${ms}ms)`, 'success');
        if (r.warnings) {
            log(r.warnings, 'warning');
            parseProblems(r.warnings, 'warning');
        }
        setStatus(`Build: ${ms}ms`, 'success');
        await run();
    } else {
        log('Build failed', 'error');
        log(r.error, 'error');
        parseProblems(r.error, 'error');
        highlightErrorLines();
        setStatus('Build failed', 'error');
        App.exePath = null;
    }
}

async function run() {
    if (!App.exePath) { log('Build first (F11)', 'warning'); return; }

    if (!App.showTerm) {
        App.showTerm = true;
        updateUI();
    }

    const inputText = document.getElementById('input-area').value.trim();
    if (App.settings.execution.autoSendInput) {
        App.inputLines = inputText ? inputText.split('\n') : [];
    } else {
        App.inputLines = [];
    }
    App.inputIndex = 0;

    log('\n--- Running ---', 'system');
    setStatus('Running...', '');
    setRunning(true);

    if (App.settings.execution.timeLimitEnabled && App.settings.execution.timeLimitSeconds > 0) {
        App.runTimeout = setTimeout(() => {
            if (App.isRunning) {
                log('\nTime limit exceeded!', 'error');
                stop();
            }
        }, App.settings.execution.timeLimitSeconds * 1000);
    }

    await window.electronAPI.run(App.exePath);

    if (App.inputLines.length > 0) {
        setTimeout(sendNextInput, 100);
    }
}

function sendNextInput() {
    if (App.inputIndex < App.inputLines.length && App.isRunning) {
        const line = App.inputLines[App.inputIndex];
        log('> ' + line, '');
        window.electronAPI.sendInput(line);
        App.inputIndex++;
        setTimeout(sendNextInput, 50);
    }
}

async function stop() {
    if (App.runTimeout) {
        clearTimeout(App.runTimeout);
        App.runTimeout = null;
    }
    await window.electronAPI.stopProcess();
}

// ============================================================================
// ERROR HIGHLIGHTING
// ============================================================================
function highlightErrorLines() {
    if (!App.editor || App.problems.length === 0) return;

    const decorations = App.problems
        .filter(p => p.type === 'error')
        .map(p => ({
            range: new monaco.Range(p.line, 1, p.line, 1),
            options: {
                isWholeLine: true,
                className: 'error-line-decoration',
                glyphMarginClassName: 'error-glyph'
            }
        }));

    App.errorDecorations = App.editor.deltaDecorations(App.errorDecorations, decorations);
}

function clearErrorDecorations() {
    if (App.editor && App.errorDecorations.length > 0) {
        App.errorDecorations = App.editor.deltaDecorations(App.errorDecorations, []);
    }
}

// ============================================================================
// PROBLEMS PANEL
// ============================================================================
function clearProblems() {
    App.problems = [];
    renderProblems();
}

function parseProblems(text, type) {
    const lines = text.split('\n');
    const regex = /(.+):(\d+):(\d+):\s*(error|warning):\s*(.+)/;

    lines.forEach(line => {
        const m = line.match(regex);
        if (m) {
            App.problems.push({
                file: m[1],
                line: parseInt(m[2]),
                col: parseInt(m[3]),
                type: m[4],
                message: m[5]
            });
        }
    });

    if (App.problems.length > 0) {
        App.showProblems = true;
        updateUI();
    }

    renderProblems();
}

function renderProblems() {
    const list = document.getElementById('problems-list');
    const count = document.getElementById('problem-count');

    count.textContent = App.problems.length;
    list.innerHTML = '';

    App.problems.forEach(p => {
        const el = document.createElement('div');
        el.className = 'problem-item ' + p.type;
        const icon = p.type === 'error'
            ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'
            : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg>';
        el.innerHTML = `<span class="problem-icon">${icon}</span>
      <span>${p.message}</span>
      <span style="margin-left:auto;opacity:0.6">${p.file.split(/[/\\]/).pop()}:${p.line}</span>`;
        el.onclick = () => {
            if (App.editor) {
                App.editor.revealLineInCenter(p.line);
                App.editor.setPosition({ lineNumber: p.line, column: p.col });
                App.editor.focus();
            }
        };
        list.appendChild(el);
    });
}

// ANSI 16-color palette (basic colors)
const ANSI_COLORS_16 = {
    // Standard colors (30-37)
    30: '#1a1a1a', // black
    31: '#e06c75', // red
    32: '#98c379', // green
    33: '#e5c07b', // yellow
    34: '#61afef', // blue
    35: '#c678dd', // magenta
    36: '#56b6c2', // cyan
    37: '#abb2bf', // white
    // Bright colors (90-97)
    90: '#5c6370', // bright black (gray)
    91: '#ff6b6b', // bright red
    92: '#a6e22e', // bright green
    93: '#f1fa8c', // bright yellow
    94: '#8be9fd', // bright blue
    95: '#ff79c6', // bright magenta
    96: '#66d9ef', // bright cyan
    97: '#f8f8f2', // bright white
    // Background colors (40-47)
    40: '#1a1a1a',
    41: '#e06c75',
    42: '#98c379',
    43: '#e5c07b',
    44: '#61afef',
    45: '#c678dd',
    46: '#56b6c2',
    47: '#abb2bf'
};

// Parse ANSI escape codes and convert to HTML spans
function parseAnsiToHtml(text) {
    // Strip or parse ANSI escape sequences
    // Regex matches ANSI escape codes: ESC[...m
    const ansiRegex = /\x1b\[([0-9;]*)m/g;

    // Check if color scheme is disabled
    const colorScheme = App.settings?.terminal?.colorScheme || 'ansi-16';
    if (colorScheme === 'disabled') {
        // Strip all ANSI codes and return plain text
        return escapeHtml(text.replace(ansiRegex, ''));
    }

    let result = '';
    let lastIndex = 0;
    let currentFg = null;
    let currentBg = null;
    let isBold = false;
    let isUnderline = false;
    let match;

    while ((match = ansiRegex.exec(text)) !== null) {
        // Append text before this match (escaped for HTML)
        if (match.index > lastIndex) {
            const textChunk = text.slice(lastIndex, match.index);
            result += applyAnsiStyle(escapeHtml(textChunk), currentFg, currentBg, isBold, isUnderline);
        }

        // Parse the ANSI codes
        const codes = match[1].split(';').map(c => parseInt(c) || 0);

        for (const code of codes) {
            if (code === 0) {
                // Reset all
                currentFg = null;
                currentBg = null;
                isBold = false;
                isUnderline = false;
            } else if (code === 1) {
                isBold = true;
            } else if (code === 4) {
                isUnderline = true;
            } else if (code === 22) {
                isBold = false;
            } else if (code === 24) {
                isUnderline = false;
            } else if (code >= 30 && code <= 37) {
                currentFg = ANSI_COLORS_16[code];
            } else if (code >= 90 && code <= 97) {
                currentFg = ANSI_COLORS_16[code];
            } else if (code >= 40 && code <= 47) {
                currentBg = ANSI_COLORS_16[code];
            } else if (code === 39) {
                currentFg = null; // default foreground
            } else if (code === 49) {
                currentBg = null; // default background
            }
        }

        lastIndex = ansiRegex.lastIndex;
    }

    // Append remaining text
    if (lastIndex < text.length) {
        const textChunk = text.slice(lastIndex);
        result += applyAnsiStyle(escapeHtml(textChunk), currentFg, currentBg, isBold, isUnderline);
    }

    return result;
}

// Apply ANSI style to text chunk
function applyAnsiStyle(text, fg, bg, bold, underline) {
    if (!fg && !bg && !bold && !underline) {
        return text;
    }

    let style = '';
    if (fg) style += `color:${fg};`;
    if (bg) style += `background:${bg};`;
    if (bold) style += 'font-weight:bold;';
    if (underline) style += 'text-decoration:underline;';

    return `<span style="${style}">${text}</span>`;
}

function log(msg, type = '') {
    const t = document.getElementById('terminal');
    const l = document.createElement('pre');
    l.className = 'line' + (type ? ' ' + type : '');
    l.style.margin = '0';
    l.style.fontFamily = 'inherit';

    // Parse ANSI codes and render with colors
    const colorScheme = App.settings?.terminal?.colorScheme || 'ansi-16';
    if (colorScheme !== 'disabled' && msg.includes('\x1b[')) {
        l.innerHTML = parseAnsiToHtml(msg);
    } else {
        // Plain text - use textContent for safety (no HTML injection)
        l.textContent = msg.replace(/\x1b\[[0-9;]*m/g, '');
    }

    t.appendChild(l);
    t.scrollTop = t.scrollHeight;
}

function clearTerm() { document.getElementById('terminal').innerHTML = ''; }

function setRunning(v) {
    App.isRunning = v;
    document.getElementById('btn-stop').disabled = !v;
    document.getElementById('terminal-in').disabled = !v;
    document.getElementById('btn-send').disabled = !v;
    if (v) document.getElementById('terminal-in').focus();
}

async function sendInput() {
    const inp = document.getElementById('terminal-in');
    if (inp.value && App.isRunning) {
        log('> ' + inp.value, '');
        await window.electronAPI.sendInput(inp.value);
        inp.value = '';
    }
}

function setStatus(msg, type) {
    const bar = document.getElementById('status-bar');
    bar.className = 'status-bar' + (type ? ' ' + type : '');
    document.getElementById('status').innerHTML = `<span class="dot"></span>${msg}`;
}

function compareOutput() {
    const expectedText = document.getElementById('expected-area').value.trim();
    if (!expectedText) return;

    // Extract actual output from terminal (filter out system messages and inputs)
    const terminalEl = document.getElementById('terminal');
    const lines = Array.from(terminalEl.querySelectorAll('pre, .line'));
    let actualText = '';
    let capturing = false;

    for (const line of lines) {
        const text = line.textContent;
        if (text.includes('--- Running ---')) {
            capturing = true;
            continue;
        }
        if (text.includes('--- Exit') || text.includes('--- Stopped')) {
            break;
        }
        if (capturing && !text.startsWith('>') && !line.classList.contains('system') && !line.classList.contains('info')) {
            actualText += (actualText ? '\n' : '') + text;
        }
    }

    // Tokenize: split by whitespace, keeping structure
    const expectedTokens = expectedText.split(/(\s+)/);
    const actualTokens = actualText.split(/(\s+)/);

    const diffDisplay = document.getElementById('expected-diff');
    const textarea = document.getElementById('expected-area');

    // Build diff HTML - compare token by token
    let html = '';
    let actualIdx = 0;

    for (let i = 0; i < expectedTokens.length; i++) {
        const expToken = expectedTokens[i];

        // Whitespace tokens - just render
        if (/^\s+$/.test(expToken)) {
            html += expToken.includes('\n') ? '<br>' : ' ';
            continue;
        }

        // Find corresponding actual token (skip whitespace)
        while (actualIdx < actualTokens.length && /^\s+$/.test(actualTokens[actualIdx])) {
            actualIdx++;
        }

        const actToken = actualIdx < actualTokens.length ? actualTokens[actualIdx] : null;
        actualIdx++;

        if (actToken === null) {
            // Missing in actual
            html += `<span class="diff-token incorrect">${escapeHtml(expToken)}</span>`;
        } else if (expToken === actToken) {
            // Match
            html += `<span class="diff-token correct">${escapeHtml(expToken)}</span>`;
        } else {
            // Mismatch
            html += `<span class="diff-token incorrect">${escapeHtml(expToken)}</span>`;
        }
    }

    // Show diff display, hide textarea
    diffDisplay.innerHTML = html;
    diffDisplay.style.display = 'block';
    textarea.style.display = 'none';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function switchToExpectedEdit() {
    const textarea = document.getElementById('expected-area');
    const diffDisplay = document.getElementById('expected-diff');
    textarea.style.display = 'block';
    diffDisplay.style.display = 'none';
    textarea.focus();
}

// ============================================================================
// IPC HANDLERS
// ============================================================================
if (window.electronAPI) {
    window.electronAPI.onFileOpened?.(data => {
        const exists = App.tabs.find(t => t.path === data.path);
        if (exists) setActive(exists.id);
        else {
            const id = 'tab_' + Date.now();
            App.tabs.push({ id, name: data.path.split(/[/\\]/).pop(), path: data.path, content: data.content, original: data.content, modified: false });
            setActive(id);
            updateUI();
        }
        log(`Opened: ${data.path}`, 'system');
    });

    window.electronAPI.onProcessStarted?.(() => setRunning(true));
    window.electronAPI.onProcessOutput?.(d => log(d));
    window.electronAPI.onProcessError?.(d => log(d, 'error'));
    window.electronAPI.onProcessExit?.(data => {
        if (App.runTimeout) {
            clearTimeout(App.runTimeout);
            App.runTimeout = null;
        }
        // Handle both old format (just code) and new format (object with code + executionTime + peakMemoryKB)
        const code = typeof data === 'object' ? data.code : data;
        const execTime = typeof data === 'object' ? data.executionTime : null;
        const peakMemKB = typeof data === 'object' ? data.peakMemoryKB : null;

        // Format execution time
        let timeStr = '';
        if (execTime !== null) {
            if (execTime >= 1000) {
                timeStr = (execTime / 1000).toFixed(2) + 's';
            } else {
                timeStr = execTime + 'ms';
            }
        }

        // Format memory
        let memStr = '';
        if (peakMemKB && peakMemKB > 0) {
            if (peakMemKB >= 1024) {
                memStr = (peakMemKB / 1024).toFixed(1) + 'MB';
            } else {
                memStr = peakMemKB + 'KB';
            }
        }

        // Display with detailed format
        // --- Exit: 0 ---
        // Time: 757ms | Memory: 2.4MB
        log(`\n--- Exit: ${code} ---`, code === 0 ? 'success' : 'warning');

        // Show stats on separate line if available (no dashes)
        if (timeStr || memStr) {
            const parts = [];
            if (timeStr) parts.push('Time: ' + timeStr);
            if (memStr) parts.push('Memory: ' + memStr);
            log(parts.join(' | '), 'info');
        }

        setRunning(false);
        // Status bar shows compact version
        const statusParts = [];
        if (timeStr) statusParts.push(timeStr);
        if (memStr) statusParts.push(memStr);
        setStatus(code === 0 ? (statusParts.join(' | ') || 'Done') : `Exit: ${code}`, code === 0 ? 'success' : '');
        if (code === 0) setTimeout(compareOutput, 100);
    });
    window.electronAPI.onProcessStopped?.(() => {
        if (App.runTimeout) {
            clearTimeout(App.runTimeout);
            App.runTimeout = null;
        }
        log('\n--- Stopped ---', 'warning');
        setRunning(false);
        setStatus('Stopped', '');
    });
}
