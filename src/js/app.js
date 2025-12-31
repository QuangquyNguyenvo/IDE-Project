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
        fontFamily: "Consolas, monospace",
        tabSize: 4,
        minimap: true,
        wordWrap: false,
        colorScheme: 'auto',
        autoSave: false,
        autoSaveDelay: 3,  // seconds
        liveCheck: false,  // Real-time syntax checking
        liveCheckDelay: 1000  // milliseconds
    },
    compiler: {
        cppStandard: '',
        optimization: '',
        warnings: false
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
    },
    oj: {
        verified: false
    },
    template: {
        code: `#include<bits/stdc++.h>
using namespace std;

int main() {
    
    return 0;
}`
    },
    keybindings: {
        compile: 'F9',
        buildRun: 'F11',
        run: 'F10',
        stop: 'Shift+F5',
        save: 'Ctrl+S',
        newFile: 'Ctrl+N',
        openFile: 'Ctrl+O',
        closeTab: 'Ctrl+W',
        toggleProblems: 'Ctrl+J',
        settings: 'Ctrl+,',
        toggleSplit: 'Ctrl+\\',
        formatCode: 'Ctrl+Shift+A'
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

const DEFAULT_CODE = `#include<bits/stdc++.h>
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
    initCompetitiveCompanion();
    updateUI();

    // Refresh editor layout on window resize (maximize/restore)
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (App.editor) App.editor.layout();
            if (App.editor2) App.editor2.layout();
        }, 100);
    });
});

function initMonaco() {
    require(['vs/editor/editor.main'], function () {
        // Define all Monaco themes
        defineMonacoThemes();

        App.editor = createEditor('editor-container');
        App.ready = true;

        // Apply initial theme
        applyTheme(App.settings.appearance.theme);

        // Track active editor on focus and switch to corresponding tab
        document.getElementById('editor-container').addEventListener('mousedown', () => {
            App.activeEditor = 1;
            // Re-render tabs to show focus indicator on primary tab
            renderTabs();
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

        // Trigger auto-save if enabled
        scheduleAutoSave();

        // Trigger live syntax check if enabled
        scheduleLiveCheck();
    });

    // Shortcuts
    editor.addCommand(monaco.KeyCode.F9, compileOnly);  // Compile only
    editor.addCommand(monaco.KeyCode.F11, buildRun);     // Compile & Run
    editor.addCommand(monaco.KeyCode.F10, run);          // Run only
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F5, stop);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, save);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, newFile);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO, openFile);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, toggleProblems);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Comma, openSettings);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backslash, toggleSplit);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyA, formatCode);  // Format code

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
    document.body.classList.add('split-active');

    // Show split pane
    const pane2 = document.getElementById('editor-pane-2');
    const resizer = document.getElementById('resizer-split');

    pane2.style.display = 'flex';
    resizer.style.display = 'block';

    // Create second editor if not exists
    if (!App.editor2) {
        App.editor2 = createEditor('editor-container-2');
        document.getElementById('editor-container-2').addEventListener('mousedown', () => {
            App.activeEditor = 2;
            // Re-render tabs to show focus indicator on split tab
            renderTabs();
        });
    }

    // Disable minimap when split is active to save space
    if (App.editor) App.editor.updateOptions({ minimap: { enabled: false } });
    if (App.editor2) App.editor2.updateOptions({ minimap: { enabled: false } });

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

    // Force layout update for both editors after a short delay
    setTimeout(() => {
        if (App.editor) App.editor.layout();
        if (App.editor2) App.editor2.layout();
    }, 100);
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
    document.body.classList.remove('split-active');

    document.getElementById('editor-pane-2').style.display = 'none';
    document.getElementById('resizer-split').style.display = 'none';

    // Re-enable minimap based on user settings
    const minimapEnabled = App.settings?.editor?.minimap !== false;
    if (App.editor) App.editor.updateOptions({ minimap: { enabled: minimapEnabled } });

    // Refresh layout
    setTimeout(() => {
        if (App.editor) App.editor.layout();
    }, 50);
}

// Swap files between left and right editors
function swapSplitEditors() {
    if (!App.isSplit || !App.editor2) return;

    // Save current content to tabs
    const leftTab = App.tabs.find(t => t.id === App.activeTabId);
    const rightTab = App.tabs.find(t => t.id === App.splitTabId);

    if (leftTab) leftTab.content = App.editor.getValue();
    if (rightTab) rightTab.content = App.editor2.getValue();

    // Swap tab IDs
    const tempId = App.activeTabId;
    App.activeTabId = App.splitTabId;
    App.splitTabId = tempId;

    // Swap editor content
    const leftContent = App.editor.getValue();
    const rightContent = App.editor2.getValue();

    App.editor.setValue(rightContent);
    App.editor2.setValue(leftContent);

    // Update tabs UI
    renderTabs();
}

function initTabDrag() {
    // Make tabs draggable for reordering and split
    const container = document.getElementById('tabs-container');
    const editorPane1 = document.getElementById('editor-pane-1');
    const editorPane2 = document.getElementById('editor-pane-2');

    let draggedTabId = null;
    let draggedTabEl = null;
    let dropIndicator = null;

    // Create drop indicator element
    function createDropIndicator() {
        if (!dropIndicator) {
            dropIndicator = document.createElement('div');
            dropIndicator.className = 'tab-drop-indicator';
        }
        return dropIndicator;
    }

    container.addEventListener('dragstart', e => {
        const tab = e.target.closest('.tab');
        if (tab) {
            draggedTabId = tab.dataset.id;
            draggedTabEl = tab;
            e.dataTransfer.effectAllowed = 'move';
            tab.classList.add('dragging');
            // Set drag image
            e.dataTransfer.setDragImage(tab, tab.offsetWidth / 2, tab.offsetHeight / 2);
        }
    });

    container.addEventListener('dragend', e => {
        const tab = e.target.closest('.tab');
        if (tab) tab.classList.remove('dragging');
        draggedTabId = null;
        draggedTabEl = null;
        // Remove drop indicator
        if (dropIndicator && dropIndicator.parentNode) {
            dropIndicator.parentNode.removeChild(dropIndicator);
        }
        // Remove all drag-over classes
        container.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over-left', 'drag-over-right'));
    });

    // Tab reordering within container
    container.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (!draggedTabEl) return;

        const afterElement = getDragAfterElement(container, e.clientX);
        const indicator = createDropIndicator();

        // Remove previous indicators
        container.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over-left', 'drag-over-right'));

        if (afterElement) {
            // Show indicator before the target tab
            afterElement.classList.add('drag-over-left');
        } else {
            // Show at the end
            const lastTab = container.querySelector('.tab:last-of-type');
            if (lastTab && lastTab !== draggedTabEl) {
                lastTab.classList.add('drag-over-right');
            }
        }
    });

    container.addEventListener('dragleave', e => {
        // Only handle leaf elements
        if (e.target === container) {
            container.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over-left', 'drag-over-right'));
        }
    });

    container.addEventListener('drop', e => {
        e.preventDefault();

        if (!draggedTabId) return;

        // Check if dropping in the tab bar (not on editor pane)
        const droppedOnTab = e.target.closest('.tab');
        const droppedOnContainer = e.target.closest('.tabs-container');

        if (droppedOnContainer || droppedOnTab) {
            // Reorder tabs
            const draggedIndex = App.tabs.findIndex(t => t.id === draggedTabId);
            if (draggedIndex === -1) return;

            const afterElement = getDragAfterElement(container, e.clientX);
            let targetIndex;

            if (afterElement) {
                const afterId = afterElement.dataset.id;
                targetIndex = App.tabs.findIndex(t => t.id === afterId);
            } else {
                targetIndex = App.tabs.length;
            }

            // Only reorder if position changed
            if (draggedIndex !== targetIndex && draggedIndex !== targetIndex - 1) {
                const [draggedTab] = App.tabs.splice(draggedIndex, 1);
                // Adjust target index if dragged from before target
                if (draggedIndex < targetIndex) {
                    targetIndex--;
                }
                App.tabs.splice(targetIndex, 0, draggedTab);
                renderTabs();
            }
        }

        // Clean up
        container.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over-left', 'drag-over-right'));
    });

    // Helper function to find the element after which to insert
    function getDragAfterElement(container, x) {
        const draggableElements = [...container.querySelectorAll('.tab:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // Drop zones on editor panes (for split editor)
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

            // Only handle if not dropped on tab bar
            if (e.target.closest('.tabs-container')) return;

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
            App.settings = {
                editor: { ...DEFAULT_SETTINGS.editor, ...saved.editor },
                compiler: { ...DEFAULT_SETTINGS.compiler, ...saved.compiler },
                execution: { ...DEFAULT_SETTINGS.execution, ...saved.execution },
                appearance: { ...DEFAULT_SETTINGS.appearance, ...saved.appearance },
                terminal: { ...DEFAULT_SETTINGS.terminal, ...saved.terminal },
                panels: { ...DEFAULT_SETTINGS.panels, ...saved.panels },
                oj: { ...DEFAULT_SETTINGS.oj, ...saved.oj },
                template: { ...DEFAULT_SETTINGS.template, ...saved.template },
                keybindings: { ...DEFAULT_SETTINGS.keybindings, ...saved.keybindings }
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

    // Template reset button
    const templateResetBtn = document.getElementById('btn-template-reset');
    if (templateResetBtn) {
        templateResetBtn.onclick = resetTemplate;
    }

    // Template Monaco editor will be initialized when settings panel opens

    // Keybindings reset button
    const keybindingsResetBtn = document.getElementById('btn-keybindings-reset');
    if (keybindingsResetBtn) {
        keybindingsResetBtn.onclick = resetKeybindings;
    }
}

// Template editor (Monaco mini editor for settings)
let templateEditor = null;

function initTemplateEditor() {
    const container = document.getElementById('template-editor-container');
    if (!container || templateEditor) return;

    templateEditor = monaco.editor.create(container, {
        value: App.settings.template?.code || DEFAULT_SETTINGS.template.code,
        language: 'cpp',
        theme: App.settings.appearance.theme || 'kawaii-dark',
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Consolas', monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        lineNumbers: 'on',
        folding: false,
        renderWhitespace: 'none',
        overviewRulerBorder: false,
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10
        }
    });

    // Sync to hidden textarea on change
    templateEditor.onDidChangeModelContent(() => {
        document.getElementById('set-template').value = templateEditor.getValue();
    });
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
    document.getElementById('set-editorColorScheme').value = App.settings.editor.colorScheme || 'auto';
    document.getElementById('set-autoSave').checked = App.settings.editor.autoSave || false;
    document.getElementById('set-autoSaveDelay').value = App.settings.editor.autoSaveDelay || 3;
    document.getElementById('set-liveCheck').checked = App.settings.editor.liveCheck || false;
    document.getElementById('set-liveCheckDelay').value = App.settings.editor.liveCheckDelay || 1000;

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

    // Template - sync to hidden textarea and update Monaco editor
    const templateCode = App.settings.template?.code || DEFAULT_SETTINGS.template.code;
    document.getElementById('set-template').value = templateCode;

    // Initialize template editor if not exists, or update its content
    if (!templateEditor) {
        // Delay to ensure container is visible
        setTimeout(() => {
            initTemplateEditor();
        }, 100);
    } else {
        templateEditor.setValue(templateCode);
    }

    // Keybindings
    renderKeybindings();

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
    App.settings.editor.colorScheme = document.getElementById('set-editorColorScheme').value;
    App.settings.editor.autoSave = document.getElementById('set-autoSave').checked;
    App.settings.editor.autoSaveDelay = parseInt(document.getElementById('set-autoSaveDelay').value) || 3;
    App.settings.editor.liveCheck = document.getElementById('set-liveCheck').checked;
    App.settings.editor.liveCheckDelay = parseInt(document.getElementById('set-liveCheckDelay').value) || 1000;

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

    // Template
    if (!App.settings.template) App.settings.template = {};
    App.settings.template.code = document.getElementById('set-template').value;

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

// ============================================================================
// KEYBINDINGS MANAGEMENT
// ============================================================================
const KEYBINDING_LABELS = {
    compile: 'Compile Only',
    buildRun: 'Compile & Run',
    run: 'Run Only',
    stop: 'Stop Process',
    save: 'Save File',
    newFile: 'New File',
    openFile: 'Open File',
    closeTab: 'Close Tab',
    toggleProblems: 'Toggle Problems',
    settings: 'Open Settings',
    toggleSplit: 'Toggle Split',
    formatCode: 'Format Code'
};

let editingKeybinding = null;

function renderKeybindings() {
    const container = document.getElementById('keybindings-list');
    if (!container) return;

    const keybindings = App.settings.keybindings || DEFAULT_SETTINGS.keybindings;

    container.innerHTML = Object.entries(keybindings).map(([key, value]) => `
        <div class="keybinding-item" data-action="${key}">
            <span class="keybinding-name">${KEYBINDING_LABELS[key] || key}</span>
            <button class="keybinding-key" data-action="${key}">${value}</button>
        </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.keybinding-key').forEach(btn => {
        btn.addEventListener('click', startEditingKeybinding);
    });
}

function startEditingKeybinding(e) {
    const btn = e.target;
    const action = btn.dataset.action;

    // Remove editing from all
    document.querySelectorAll('.keybinding-key').forEach(b => b.classList.remove('editing'));

    btn.classList.add('editing');
    btn.textContent = 'Press a key...';
    editingKeybinding = action;

    // Listen for key press
    document.addEventListener('keydown', captureKeybinding);
}

function captureKeybinding(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!editingKeybinding) return;

    // Escape to cancel
    if (e.key === 'Escape') {
        cancelEditingKeybinding();
        return;
    }

    // Build key string
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    // Get the key name
    let keyName = e.key;
    if (keyName === ' ') keyName = 'Space';
    else if (keyName.length === 1) keyName = keyName.toUpperCase();
    else if (keyName.startsWith('Arrow')) keyName = keyName.replace('Arrow', '');

    // Don't add modifier keys alone
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        parts.push(keyName);
    } else {
        return; // Wait for non-modifier key
    }

    const keyCombo = parts.join('+');

    // Save the new keybinding
    if (!App.settings.keybindings) {
        App.settings.keybindings = { ...DEFAULT_SETTINGS.keybindings };
    }
    App.settings.keybindings[editingKeybinding] = keyCombo;

    // Update UI
    const btn = document.querySelector(`.keybinding-key[data-action="${editingKeybinding}"]`);
    if (btn) {
        btn.textContent = keyCombo;
        btn.classList.remove('editing');
    }

    // Cleanup
    editingKeybinding = null;
    document.removeEventListener('keydown', captureKeybinding);
}

function cancelEditingKeybinding() {
    if (!editingKeybinding) return;

    const keybindings = App.settings.keybindings || DEFAULT_SETTINGS.keybindings;
    const btn = document.querySelector(`.keybinding-key[data-action="${editingKeybinding}"]`);
    if (btn) {
        btn.textContent = keybindings[editingKeybinding];
        btn.classList.remove('editing');
    }

    editingKeybinding = null;
    document.removeEventListener('keydown', captureKeybinding);
}

function resetKeybindings() {
    if (confirm('Reset all keybindings to defaults?')) {
        App.settings.keybindings = { ...DEFAULT_SETTINGS.keybindings };
        renderKeybindings();
        log('Keybindings reset to defaults', 'info');
    }
}

function resetTemplate() {
    if (confirm('Reset template to default?')) {
        const defaultCode = DEFAULT_SETTINGS.template.code;
        const textarea = document.getElementById('set-template');
        if (textarea) {
            textarea.value = defaultCode;
        }
        // Also update Monaco editor if exists
        if (templateEditor) {
            templateEditor.setValue(defaultCode);
        }
    }
}

// ============================================================================
// AUTO-SAVE
// ============================================================================
let autoSaveTimer = null;

function scheduleAutoSave() {
    if (!App.settings.editor.autoSave) return;

    // Clear existing timer
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }

    // Schedule new save
    const delay = (App.settings.editor.autoSaveDelay || 3) * 1000;
    autoSaveTimer = setTimeout(() => {
        autoSaveCurrentFile();
    }, delay);
}

async function autoSaveCurrentFile() {
    const tabId = App.activeEditor === 2 ? App.splitTabId : App.activeTabId;
    if (!tabId) return;

    const tab = App.tabs.find(t => t.id === tabId);
    if (!tab || !tab.path || !tab.modified) return;

    // Only auto-save if file has been saved before (has path)
    const editor = App.activeEditor === 2 ? App.editor2 : App.editor;
    if (!editor) return;

    const content = editor.getValue();

    try {
        const result = await window.electronAPI.saveFile({ path: tab.path, content });
        if (result.success) {
            tab.original = content;
            tab.modified = false;
            renderTabs();
            // Silent save - no log message
        }
    } catch (e) {
        console.log('Auto-save failed:', e);
    }
}

// ============================================================================
// LIVE SYNTAX CHECKING
// ============================================================================
let liveCheckTimer = null;
let isLiveChecking = false;

function scheduleLiveCheck() {
    if (!App.settings.editor.liveCheck || !window.electronAPI?.syntaxCheck) {
        return;
    }

    if (liveCheckTimer) {
        clearTimeout(liveCheckTimer);
    }

    const delay = App.settings.editor.liveCheckDelay || 1000;
    liveCheckTimer = setTimeout(doLiveCheck, delay);
}

async function doLiveCheck() {
    if (isLiveChecking || !App.editor) return;

    const editor = App.activeEditor === 2 && App.editor2 ? App.editor2 : App.editor;
    const tabId = App.activeEditor === 2 ? App.splitTabId : App.activeTabId;
    const tab = App.tabs.find(t => t.id === tabId);

    const code = editor.getValue();
    if (!code || !code.trim()) {
        clearLiveCheckMarkers();
        return;
    }

    isLiveChecking = true;

    try {
        const result = await window.electronAPI.syntaxCheck(code, tab?.path || null);

        if (result && result.diagnostics && result.diagnostics.length > 0) {
            applyLiveCheckMarkers(editor, result.diagnostics);
        } else if (result && result.success) {
            // No errors - clear markers silently
            clearLiveCheckMarkers();
        }
    } catch (e) {
        // Silent fail - don't spam terminal
    } finally {
        isLiveChecking = false;
    }
}

function applyLiveCheckMarkers(editor, diagnostics) {
    const model = editor.getModel();
    if (!model) return;

    // Convert diagnostics to Monaco markers
    const markers = diagnostics.map(d => ({
        severity: d.severity === 'error' ? monaco.MarkerSeverity.Error :
            d.severity === 'warning' ? monaco.MarkerSeverity.Warning :
                monaco.MarkerSeverity.Info,
        startLineNumber: d.line,
        startColumn: d.column || 1,
        endLineNumber: d.line,
        endColumn: d.column ? d.column + 50 : 1000,
        message: d.message,
        source: 'g++'
    }));

    // Apply markers to editor (this shows red squiggly underlines)
    monaco.editor.setModelMarkers(model, 'live-check', markers);

    // Update problems panel silently
    App.problems = diagnostics.map(d => ({
        type: d.severity,
        line: d.line,
        column: d.column,
        message: d.message
    }));
    renderProblems();
}

function clearLiveCheckMarkers() {
    if (App.editor) {
        const model1 = App.editor.getModel();
        if (model1) monaco.editor.setModelMarkers(model1, 'live-check', []);
    }
    if (App.editor2) {
        const model2 = App.editor2.getModel();
        if (model2) monaco.editor.setModelMarkers(model2, 'live-check', []);
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

    // Determine editor theme: use separate colorScheme if set, otherwise use UI theme
    const editorColorScheme = App.settings.editor?.colorScheme || 'auto';
    const editorTheme = editorColorScheme === 'auto' ? theme : editorColorScheme;

    // Update Monaco editor theme if editors exist
    if (typeof monaco !== 'undefined') {
        monaco.editor.setTheme(editorTheme);
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
        if (e.ctrlKey && !e.shiftKey && e.key === '\\') { e.preventDefault(); toggleSplit(); }
        if (e.ctrlKey && e.shiftKey && e.key === '|') { e.preventDefault(); swapSplitEditors(); }
        if (e.key === 'F11') { e.preventDefault(); buildRun(); }
        if (e.key === 'F10') { e.preventDefault(); run(); }
        if (e.key === 'F5' && e.shiftKey) { e.preventDefault(); stop(); }
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); formatCode(); }
        if (e.key === 'Escape') closeSettings();
    });
}

// ============================================================================
// CODE FORMATTING - AStyle Integration
// ============================================================================
async function formatCode() {
    const editor = App.activeEditor === 2 && App.editor2 ? App.editor2 : App.editor;
    if (!editor) return;

    const code = editor.getValue();
    if (!code.trim()) return;

    // Save cursor position and scroll
    const position = editor.getPosition();
    const scrollTop = editor.getScrollTop();

    // Show status
    setStatus('formatting', 'Đang format code...');

    try {
        if (!window.electronAPI?.formatCode) {
            setStatus('error', 'Format không khả dụng');
            termLog('⚠ Format code không khả dụng trong môi trường này', 'warning');
            return;
        }

        const result = await window.electronAPI.formatCode(code, 'google');

        if (result.success) {
            const model = editor.getModel();
            if (!model) return;

            // Use executeEdits to preserve undo history (allows Ctrl+Z)
            const fullRange = model.getFullModelRange();

            editor.pushUndoStop(); // Create undo point before edit
            editor.executeEdits('format-code', [{
                range: fullRange,
                text: result.code,
                forceMoveMarkers: true
            }]);
            editor.pushUndoStop(); // Create undo point after edit

            // Restore cursor position (best effort)
            if (position) {
                const newLineCount = result.code.split('\n').length;
                const newLine = Math.min(position.lineNumber, newLineCount);
                editor.setPosition({ lineNumber: newLine, column: position.column });
            }
            editor.setScrollTop(scrollTop);

            setStatus('ready', 'Format thành công!');
            termLog('✓ Code đã được format (Google Style) - Nhấn Ctrl+Z để hoàn tác', 'success');
        } else {
            setStatus('error', 'Format thất bại');
            termLog(`⚠ Format thất bại: ${result.error}`, 'error');
        }
    } catch (err) {
        setStatus('error', 'Format lỗi');
        termLog(`⚠ Lỗi format: ${err.message}`, 'error');
    }
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

    // Hamburger menu toggle for small screens
    const hamburgerBtn = document.getElementById('btn-hamburger');
    const menuGroup = document.getElementById('menu-group');
    if (hamburgerBtn && menuGroup) {
        hamburgerBtn.onclick = (e) => {
            e.stopPropagation();
            hamburgerBtn.classList.toggle('active');
            menuGroup.classList.toggle('show');
        };

        // Close hamburger menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!menuGroup.contains(e.target) && !hamburgerBtn.contains(e.target)) {
                hamburgerBtn.classList.remove('active');
                menuGroup.classList.remove('show');
            }
        });

        // Close hamburger menu when menu item is clicked
        menuGroup.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                hamburgerBtn.classList.remove('active');
                menuGroup.classList.remove('show');
            });
        });
    }

    setupSplitResizer();
}

function toggleIO() {
    App.showIO = !App.showIO;
    if (!App.settings.panels) App.settings.panels = {};
    App.settings.panels.showIO = App.showIO;
    saveSettings();
    updateUI();
    // Refresh editor layout after panel visibility changes
    setTimeout(() => {
        if (App.editor) App.editor.layout();
        if (App.editor2) App.editor2.layout();
    }, 50);
}
function toggleTerm() {
    // If terminal is docked to problems, toggle the problems panel and switch to terminal tab
    if (DockingState.terminalDocked) {
        if (!App.showProblems) {
            App.showProblems = true;
            if (!App.settings.panels) App.settings.panels = {};
            App.settings.panels.showProblems = true;
            saveSettings();
            updateUI();
        }
        // Switch to terminal tab
        switchDockedPanel('terminal');
        return;
    }

    App.showTerm = !App.showTerm;
    if (!App.settings.panels) App.settings.panels = {};
    App.settings.panels.showTerm = App.showTerm;
    saveSettings();
    updateUI();
    // Refresh editor layout after panel visibility changes
    setTimeout(() => {
        if (App.editor) App.editor.layout();
        if (App.editor2) App.editor2.layout();
    }, 50);
}
function toggleProblems() {
    App.showProblems = !App.showProblems;
    if (!App.settings.panels) App.settings.panels = {};
    App.settings.panels.showProblems = App.showProblems;
    saveSettings();
    updateUI();
    // Refresh editor layout after panel visibility changes
    setTimeout(() => {
        if (App.editor) App.editor.layout();
        if (App.editor2) App.editor2.layout();
    }, 50);
}

// ============================================================================
// PANELS
// ============================================================================
function initPanels() {
    // Clear buttons (optional - may not exist)
    const clearInput = document.getElementById('clear-input');
    const clearOutput = document.getElementById('clear-output');

    if (clearInput) {
        clearInput.onclick = () => { document.getElementById('input-area').value = ''; };
    }
    if (clearOutput) {
        clearOutput.onclick = () => {
            document.getElementById('expected-area').value = '';
            document.getElementById('expected-area').style.display = 'block';
            document.getElementById('expected-diff').style.display = 'none';
            document.getElementById('expected-diff').innerHTML = '';
        };
    }

    document.getElementById('clear-term').onclick = clearTerm;
    document.getElementById('close-problems').onclick = () => { App.showProblems = false; updateUI(); };

    document.getElementById('btn-send').onclick = sendInput;

    // Terminal textarea logic moved to initTerminalUX at the end of file

    // Click on diff display to go back to edit mode
    document.getElementById('expected-diff').onclick = switchToExpectedEdit;

    // Right-click paste support for Input/Expected textareas and terminal input
    const setupRightClickPaste = (element) => {
        if (!element) return;
        element.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            try {
                const text = await navigator.clipboard.readText();
                const start = element.selectionStart;
                const end = element.selectionEnd;
                element.value = element.value.slice(0, start) + text + element.value.slice(end);
                element.selectionStart = element.selectionEnd = start + text.length;
            } catch (err) {
                console.log('Clipboard access denied:', err);
            }
        });
    };

    setupRightClickPaste(document.getElementById('input-area'));
    setupRightClickPaste(document.getElementById('expected-area'));
    setupRightClickPaste(document.getElementById('terminal-in'));

    // Initialize dockable panels
    initDockablePanels();
}

// ============================================================================
// SIMPLE DOCKING SYSTEM - Dock Terminal and I/O into Problems panel
// ============================================================================

// Docking state
const DockingState = {
    draggedPanel: null,
    terminalDocked: false,
    ioDocked: false
};

function initDockablePanels() {
    // Simple docking: allow dragging Terminal and IO panel headers to dock with Problems panel
    const terminalSection = document.getElementById('terminal-section');
    const ioSection = document.getElementById('io-section');
    const problemsPanel = document.getElementById('problems-panel');
    const terminalHead = terminalSection?.querySelector('.panel-head');
    const ioHead = ioSection?.querySelector('.panel-head');

    if (!problemsPanel) return;

    // Make terminal header draggable
    if (terminalHead) {
        terminalHead.setAttribute('draggable', 'true');
        terminalHead.style.cursor = 'grab';

        terminalHead.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', 'terminal');
            e.dataTransfer.effectAllowed = 'move';
            terminalSection.classList.add('panel-dragging');
            DockingState.draggedPanel = 'terminal';
        });

        terminalHead.addEventListener('dragend', () => {
            terminalSection.classList.remove('panel-dragging');
            DockingState.draggedPanel = null;
            document.querySelectorAll('.dock-drop-target').forEach(el => {
                el.classList.remove('dock-drop-target');
            });
        });
    }

    // Make IO header draggable
    if (ioHead) {
        ioHead.setAttribute('draggable', 'true');
        ioHead.style.cursor = 'grab';

        ioHead.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', 'io');
            e.dataTransfer.effectAllowed = 'move';
            ioSection.classList.add('panel-dragging');
            DockingState.draggedPanel = 'io';
        });

        ioHead.addEventListener('dragend', () => {
            ioSection.classList.remove('panel-dragging');
            DockingState.draggedPanel = null;
            document.querySelectorAll('.dock-drop-target').forEach(el => {
                el.classList.remove('dock-drop-target');
            });
        });
    }

    // Problems panel as drop target
    problemsPanel.addEventListener('dragover', (e) => {
        if (DockingState.draggedPanel !== 'terminal' && DockingState.draggedPanel !== 'io') return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        problemsPanel.classList.add('dock-drop-target');
    });

    problemsPanel.addEventListener('dragleave', (e) => {
        if (!problemsPanel.contains(e.relatedTarget)) {
            problemsPanel.classList.remove('dock-drop-target');
        }
    });

    problemsPanel.addEventListener('drop', (e) => {
        e.preventDefault();
        problemsPanel.classList.remove('dock-drop-target');
        if (DockingState.draggedPanel === 'terminal') {
            dockTerminalToProblems();
        } else if (DockingState.draggedPanel === 'io') {
            dockIOToProblems();
        }
    });

    // Load saved state
    if (App.settings?.panels?.terminalDocked) {
        setTimeout(() => dockTerminalToProblems(), 100);
    }
    if (App.settings?.panels?.ioDocked) {
        setTimeout(() => dockIOToProblems(), 150);
    }
}

function dockTerminalToProblems() {
    if (DockingState.terminalDocked) return;

    const terminalSection = document.getElementById('terminal-section');
    const problemsPanel = document.getElementById('problems-panel');
    const resizerTerm = document.getElementById('resizer-term');

    if (!terminalSection || !problemsPanel) return;

    // Hide terminal section
    terminalSection.classList.add('docked-away');
    if (resizerTerm) resizerTerm.classList.add('docked-away');

    // Add Terminal tab to the panel-head, right after PROBLEMS
    const panelHead = problemsPanel.querySelector('.panel-head');
    if (panelHead) {
        // Create Terminal tab that looks like PROBLEMS title
        const terminalTab = document.createElement('span');
        terminalTab.className = 'panel-title terminal docked-tab';
        terminalTab.id = 'docked-terminal-tab';
        terminalTab.innerHTML = 'TERMINAL <span class="dock-undock" title="Kéo để tách">×</span>';
        terminalTab.setAttribute('draggable', 'true');

        // Insert after problem-count
        const problemCount = panelHead.querySelector('.problem-count');
        if (problemCount) {
            problemCount.after(terminalTab);
        } else {
            const problemsTitle = panelHead.querySelector('.panel-title');
            if (problemsTitle) {
                problemsTitle.after(terminalTab);
            }
        }

        // Mark PROBLEMS as active
        const problemsTitle = panelHead.querySelector('.panel-title.problems');
        if (problemsTitle) {
            problemsTitle.classList.add('active');
        }

        // Click to switch tabs
        terminalTab.onclick = (e) => {
            if (e.target.classList.contains('dock-undock')) {
                undockTerminal();
                return;
            }
            switchDockedPanel('terminal');
        };

        // Click on PROBLEMS to switch back
        const problemsTitleEl = panelHead.querySelector('.panel-title.problems');
        if (problemsTitleEl) {
            problemsTitleEl.onclick = () => switchDockedPanel('problems');
        }

        // Drag to undock
        terminalTab.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', 'undock-terminal');
            e.dataTransfer.effectAllowed = 'move';
            terminalTab.classList.add('dragging');
        });

        terminalTab.addEventListener('dragend', () => {
            terminalTab.classList.remove('dragging');
            // Undock when dropped anywhere outside
            undockTerminal();
        });
    }

    DockingState.terminalDocked = true;

    // Save state
    if (!App.settings.panels) App.settings.panels = {};
    App.settings.panels.terminalDocked = true;
    saveSettings();

    // Show problems if hidden
    if (!App.showProblems) {
        App.showProblems = true;
        updateUI();
    }

    log('Terminal docked to Problems', 'info');
    refreshEditorLayout();
}

function switchDockedPanel(panelId) {
    const problemsPanel = document.getElementById('problems-panel');
    if (!problemsPanel) return;

    const problemsTitle = problemsPanel.querySelector('.panel-title.problems');
    const terminalTab = document.getElementById('docked-terminal-tab');
    const ioTab = document.getElementById('docked-io-tab');
    const problemsBody = problemsPanel.querySelector('.problems-body');
    let terminalView = problemsPanel.querySelector('.docked-terminal-view');
    let ioView = problemsPanel.querySelector('.docked-io-view');

    // Remove all active states
    problemsTitle?.classList.remove('active');
    terminalTab?.classList.remove('active');
    ioTab?.classList.remove('active');

    // Hide all views
    if (problemsBody) problemsBody.style.display = 'none';
    if (terminalView) terminalView.style.display = 'none';
    if (ioView) ioView.style.display = 'none';

    if (panelId === 'problems') {
        problemsTitle?.classList.add('active');
        if (problemsBody) problemsBody.style.display = '';
    } else if (panelId === 'terminal') {
        terminalTab?.classList.add('active');
        if (!terminalView) {
            createDockedTerminalView(problemsPanel);
            terminalView = problemsPanel.querySelector('.docked-terminal-view');
        }
        if (terminalView) terminalView.style.display = 'flex';
        syncTerminalContent();
    } else if (panelId === 'io') {
        ioTab?.classList.add('active');
        if (!ioView) {
            createDockedIOView(problemsPanel);
            ioView = problemsPanel.querySelector('.docked-io-view');
        }
        if (ioView) ioView.style.display = 'flex';
        syncIOContent();
    }
}

function createDockedTerminalView(container) {
    const view = document.createElement('div');
    view.className = 'docked-terminal-view';
    view.innerHTML = `
        <div class="docked-terminal-body" id="docked-terminal-output"></div>
        <div class="docked-terminal-input">
            <span class="prompt">></span>
            <textarea id="docked-terminal-in" rows="1" placeholder="Input..."></textarea>
            <button class="send-btn" id="docked-send-btn">➤</button>
        </div>
    `;
    container.appendChild(view);

    // Wire up input
    const input = view.querySelector('#docked-terminal-in');
    const sendBtn = view.querySelector('#docked-send-btn');

    const sendDockedInput = () => {
        if (input.value && App.isRunning) {
            // Send each line separately
            const lines = input.value.split('\n');
            lines.forEach(line => {
                log('> ' + line, '');
                window.electronAPI?.sendInput(line);
            });
            input.value = '';
            input.rows = 1;
        }
    };

    // Ctrl+Enter or button to send, Enter for new line
    input.onkeydown = (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            sendDockedInput();
        } else if (e.key === 'Enter' && !e.shiftKey && input.rows === 1) {
            // Single line mode: Enter sends
            e.preventDefault();
            sendDockedInput();
        }
    };

    // Auto-resize logic with paste fix
    const handleResize = function () {
        if (this.value === '') {
            this.style.height = '';
            return;
        }
        this.style.height = 0;
        this.style.height = (this.scrollHeight) + 'px';
    };
    input.addEventListener('input', handleResize);
    input.addEventListener('paste', function () {
        setTimeout(() => handleResize.call(this), 10);
    });

    // Right-click to paste
    input.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        try {
            const text = await navigator.clipboard.readText();
            const start = input.selectionStart;
            const end = input.selectionEnd;
            input.value = input.value.slice(0, start) + text + input.value.slice(end);
            input.selectionStart = input.selectionEnd = start + text.length;
            input.dispatchEvent(new Event('input')); // Trigger resize
        } catch (err) {
            console.log('Clipboard access denied:', err);
        }
    });

    sendBtn.onclick = sendDockedInput;

    // Right-click on empty space to paste
    view.addEventListener('contextmenu', async (e) => {
        // Ignore if valid interactive elements
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

        e.preventDefault();
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                const start = input.selectionStart;
                const end = input.selectionEnd;
                input.value = input.value.slice(0, start) + text + input.value.slice(end);

                // Trigger events for auto-resize
                input.dispatchEvent(new Event('input'));
                input.focus();

                // Update cursor
                input.selectionStart = input.selectionEnd = start + text.length;
            }
        } catch (err) {
            console.warn('Paste failed', err);
        }
    });

    syncTerminalContent();
}

function syncTerminalContent() {
    const original = document.getElementById('terminal');
    const docked = document.getElementById('docked-terminal-output');
    if (original && docked) {
        docked.innerHTML = original.innerHTML;
        // Scroll to bottom
        scrollDockedTerminalToBottom();
    }
}

function scrollDockedTerminalToBottom() {
    const docked = document.getElementById('docked-terminal-output');
    if (docked) {
        docked.scrollTop = docked.scrollHeight;
    }
}

function undockTerminal() {
    if (!DockingState.terminalDocked) return;

    const terminalSection = document.getElementById('terminal-section');
    const problemsPanel = document.getElementById('problems-panel');
    const resizerTerm = document.getElementById('resizer-term');

    // Show terminal section again
    terminalSection?.classList.remove('docked-away');
    resizerTerm?.classList.remove('docked-away');

    // Remove terminal tab from panel-head
    const terminalTab = document.getElementById('docked-terminal-tab');
    terminalTab?.remove();

    // Remove docked terminal view
    const dockedView = problemsPanel?.querySelector('.docked-terminal-view');
    dockedView?.remove();

    // Show problems body
    const problemsBody = problemsPanel?.querySelector('.problems-body');
    if (problemsBody) problemsBody.style.display = '';

    // Remove active state from problems title
    const problemsTitle = problemsPanel?.querySelector('.panel-title.problems');
    if (problemsTitle) {
        problemsTitle.classList.remove('active');
        problemsTitle.onclick = null; // Remove click handler
    }

    DockingState.terminalDocked = false;

    // Save state
    if (App.settings.panels) {
        App.settings.panels.terminalDocked = false;
        saveSettings();
    }

    log('Terminal undocked', 'info');
    refreshEditorLayout();
}

// ============================================================================
// I/O DOCKING FUNCTIONS
// ============================================================================

function dockIOToProblems() {
    if (DockingState.ioDocked) return;

    const ioSection = document.getElementById('io-section');
    const problemsPanel = document.getElementById('problems-panel');
    const resizerIO = document.getElementById('resizer-io');

    if (!ioSection || !problemsPanel) return;

    // Hide IO section
    ioSection.classList.add('docked-away');
    if (resizerIO) resizerIO.classList.add('docked-away');

    // Add I/O tab to the panel-head
    const panelHead = problemsPanel.querySelector('.panel-head');
    if (panelHead) {
        const ioTab = document.createElement('span');
        ioTab.className = 'panel-title io docked-tab';
        ioTab.id = 'docked-io-tab';
        ioTab.innerHTML = 'I/O <span class="dock-undock" title="Kéo để tách">×</span>';
        ioTab.setAttribute('draggable', 'true');

        // Insert after problem-count or terminal tab
        const terminalTab = document.getElementById('docked-terminal-tab');
        const problemCount = panelHead.querySelector('.problem-count');
        if (terminalTab) {
            terminalTab.after(ioTab);
        } else if (problemCount) {
            problemCount.after(ioTab);
        } else {
            const problemsTitle = panelHead.querySelector('.panel-title');
            if (problemsTitle) problemsTitle.after(ioTab);
        }

        // Click to switch tabs
        ioTab.onclick = (e) => {
            if (e.target.classList.contains('dock-undock')) {
                undockIO();
                return;
            }
            switchDockedPanel('io');
        };

        // Drag to undock
        ioTab.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', 'undock-io');
            e.dataTransfer.effectAllowed = 'move';
            ioTab.classList.add('dragging');
        });

        ioTab.addEventListener('dragend', () => {
            ioTab.classList.remove('dragging');
            undockIO();
        });
    }

    DockingState.ioDocked = true;

    // Save state
    if (!App.settings.panels) App.settings.panels = {};
    App.settings.panels.ioDocked = true;
    saveSettings();

    // Show problems if hidden
    if (!App.showProblems) {
        App.showProblems = true;
        updateUI();
    }

    log('I/O docked to Problems', 'info');
    refreshEditorLayout();
}

function undockIO() {
    if (!DockingState.ioDocked) return;

    const ioSection = document.getElementById('io-section');
    const problemsPanel = document.getElementById('problems-panel');
    const resizerIO = document.getElementById('resizer-io');

    // Show IO section again
    ioSection?.classList.remove('docked-away');
    resizerIO?.classList.remove('docked-away');

    // Remove IO tab from panel-head
    const ioTab = document.getElementById('docked-io-tab');
    ioTab?.remove();

    // Remove docked IO view
    const dockedView = problemsPanel?.querySelector('.docked-io-view');
    dockedView?.remove();

    // Show problems body if no other docked panels are active
    if (!DockingState.terminalDocked) {
        const problemsBody = problemsPanel?.querySelector('.problems-body');
        if (problemsBody) problemsBody.style.display = '';
    }

    DockingState.ioDocked = false;

    // Save state
    if (App.settings.panels) {
        App.settings.panels.ioDocked = false;
        saveSettings();
    }

    log('I/O undocked', 'info');
    refreshEditorLayout();
}

function createDockedIOView(container) {
    // Create docked IO view with split INPUT and EXPECTED
    let dockedIOView = container.querySelector('.docked-io-view');
    if (!dockedIOView) {
        dockedIOView = document.createElement('div');
        dockedIOView.className = 'docked-io-view';
        dockedIOView.innerHTML = `
            <div class="docked-io-split">
                <div class="docked-io-panel">
                    <div class="docked-io-header">INPUT</div>
                    <textarea class="docked-io-textarea" id="docked-input" placeholder="Nhập dữ liệu test..."></textarea>
                </div>
                <div class="docked-io-divider"></div>
                <div class="docked-io-panel">
                    <div class="docked-io-header">EXPECTED</div>
                    <textarea class="docked-io-textarea" id="docked-expected" placeholder="Kết quả mong đợi..."></textarea>
                </div>
            </div>
        `;
        container.appendChild(dockedIOView);

        // Sync content from original inputs
        syncIOContent();

        // Two-way sync: docked -> original
        const dockedInput = document.getElementById('docked-input');
        const dockedExpected = document.getElementById('docked-expected');

        dockedInput?.addEventListener('input', () => {
            const original = document.getElementById('input-area');
            if (original) original.value = dockedInput.value;
        });

        dockedExpected?.addEventListener('input', () => {
            const original = document.getElementById('expected-area');
            if (original) original.value = dockedExpected.value;
        });
    }
    return dockedIOView;
}

function syncIOContent() {
    const originalInput = document.getElementById('input-area');
    const originalExpected = document.getElementById('expected-area');
    const dockedInput = document.getElementById('docked-input');
    const dockedExpected = document.getElementById('docked-expected');

    if (originalInput && dockedInput) {
        dockedInput.value = originalInput.value;
    }
    if (originalExpected && dockedExpected) {
        dockedExpected.value = originalExpected.value;
    }
}

function refreshEditorLayout() {
    setTimeout(() => {
        if (App.editor) App.editor.layout();
        if (App.editor2) App.editor2.layout();
    }, 50);
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
    // Use template from settings, fallback to DEFAULT_CODE
    const templateCode = App.settings.template?.code || DEFAULT_CODE;
    const tab = { id, name: 'untitled.cpp', path: null, content: templateCode, original: templateCode, modified: false };
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

    // Stop watching this file
    if (tab.path) stopFileWatch(tab.path);

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
        const isActiveTab = t.id === App.activeTabId;
        const isSplitTab = App.isSplit && t.id === App.splitTabId;
        const isFocused = (App.activeEditor === 1 && isActiveTab) || (App.activeEditor === 2 && isSplitTab);

        const el = document.createElement('div');
        let className = 'tab';
        if (isActiveTab) className += ' active';
        if (isSplitTab) className += ' split';
        if (isFocused) className += ' focused';
        if (t.modified) className += ' modified';

        el.className = className;
        el.dataset.id = t.id;
        el.draggable = true;
        el.innerHTML = `<span class="tab-name">${t.name}</span><span class="tab-dot"></span><span class="tab-x">×</span>`;
        el.onclick = e => {
            if (!e.target.classList.contains('tab-x')) {
                if (App.isSplit && isSplitTab) {
                    // Clicking on split tab - switch focus to split editor
                    App.activeEditor = 2;
                    renderTabs();
                } else {
                    setActive(t.id);
                    App.activeEditor = 1;
                }
            }
        };
        el.querySelector('.tab-x').onclick = e => { e.stopPropagation(); closeTab(t.id); };
        c.appendChild(el);
    });
    // Auto-scroll to focused tab
    setTimeout(() => {
        const focusedTab = c.querySelector('.tab.focused') || c.querySelector('.tab.active');
        if (focusedTab) {
            focusedTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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
        swapsplit: swapSplitEditors,
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
    // Save the tab that's currently being edited based on active editor
    const tabId = App.activeEditor === 2 && App.splitTabId ? App.splitTabId : App.activeTabId;
    const editor = App.activeEditor === 2 && App.editor2 ? App.editor2 : App.editor;

    const tab = App.tabs.find(t => t.id === tabId);
    if (!tab) return;
    tab.content = editor.getValue();

    if (tab.path) {
        const r = await window.electronAPI.saveFile({ path: tab.path, content: tab.content });
        if (r.success) { tab.original = tab.content; tab.modified = false; renderTabs(); setStatus(`Saved ${tab.name}`, 'success'); }
    } else await saveAs(tabId);
}

async function saveAs(tabIdOverride = null) {
    // Save As for the specified tab or current active tab
    const tabId = tabIdOverride || (App.activeEditor === 2 && App.splitTabId ? App.splitTabId : App.activeTabId);
    const editor = App.activeEditor === 2 && App.editor2 ? App.editor2 : App.editor;

    const tab = App.tabs.find(t => t.id === tabId);
    if (!tab) return;
    tab.content = editor.getValue();
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

// Anti-spam: prevent multiple rapid build requests
let isBuilding = false;

function setBuildingState(building) {
    isBuilding = building;
    const btnBuildRun = document.getElementById('btn-buildrun');
    const btnRunOnly = document.getElementById('btn-run-only');
    const btnRunAll = document.getElementById('btn-run-all-tests');

    if (btnBuildRun) btnBuildRun.disabled = building;
    if (btnRunOnly) btnRunOnly.disabled = building;
    if (btnRunAll) btnRunAll.disabled = building;

    // Visual feedback
    if (btnBuildRun) {
        if (building) {
            btnBuildRun.classList.add('building');
        } else {
            btnBuildRun.classList.remove('building');
        }
    }
}

// Compile only (F9) - compile without running
async function compileOnly() {
    // Anti-spam check
    if (isBuilding) {
        log('Build in progress...', 'warning');
        return;
    }

    const tabId = App.activeEditor === 2 && App.splitTabId ? App.splitTabId : App.activeTabId;
    const editor = App.activeEditor === 2 && App.editor2 ? App.editor2 : App.editor;

    const tab = App.tabs.find(t => t.id === tabId);
    if (!tab) { log('No file open', 'warning'); return; }

    setBuildingState(true);

    try {
        tab.content = editor.getValue();

        // Auto-save if file has path
        if (tab.path) {
            await window.electronAPI.saveFile({ path: tab.path, content: tab.content });
            tab.original = tab.content; tab.modified = false; renderTabs();
        }

        // Show terminal for build output
        if (!App.showTerm) {
            App.showTerm = true;
            if (App.settings.panels) App.settings.panels.showTerm = true;
            saveSettings();
            updateUI();
        }

        if (App.settings.execution.clearTerminal) clearTerm();
        clearProblems();
        clearErrorDecorations();

        log('Compiling...', 'info');
        setStatus('Compiling...', 'building');

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
            if (r.linkedFiles && r.linkedFiles.length > 0) {
                log(`Linked: ${r.linkedFiles.join(', ')}`, 'system');
            }
            log(`Compile OK (${ms}ms)`, 'success');
            if (r.warnings) {
                log(r.warnings, 'warning');
                parseProblems(r.warnings, 'warning');
            }
            setStatus(`Compile: ${ms}ms`, 'success');
        } else {
            log('Compile failed', 'error');
            log(r.error, 'error');
            parseProblems(r.error, 'error');
            highlightErrorLines();
            setStatus('Compile failed', 'error');
            App.exePath = null;

            if (DockingState.terminalDocked) {
                switchDockedPanel('problems');
            }
        }
    } finally {
        setBuildingState(false);
    }
}

async function buildRun() {
    // Anti-spam check
    if (isBuilding) {
        log('Build in progress...', 'warning');
        return;
    }

    // Get tab based on which editor is focused (for split mode support)
    const tabId = App.activeEditor === 2 && App.splitTabId ? App.splitTabId : App.activeTabId;
    const editor = App.activeEditor === 2 && App.editor2 ? App.editor2 : App.editor;

    const tab = App.tabs.find(t => t.id === tabId);
    if (!tab) { log('No file open', 'warning'); return; }

    setBuildingState(true);

    try {
        // Get current content from the focused editor
        tab.content = editor.getValue();

        // If file has a path, save it first (optional auto-save)
        if (tab.path) {
            await window.electronAPI.saveFile({ path: tab.path, content: tab.content });
            tab.original = tab.content; tab.modified = false; renderTabs();
        }

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
            // Show linked files if multi-file project
            if (r.linkedFiles && r.linkedFiles.length > 0) {
                log(`Linked: ${r.linkedFiles.join(', ')}`, 'system');
            }
            log(`Build OK (${ms}ms)`, 'success');
            if (r.warnings) {
                log(r.warnings, 'warning');
                parseProblems(r.warnings, 'warning');
            }
            setStatus(`Build: ${ms}ms`, 'success');

            // Unlock before running so stop button works
            setBuildingState(false);
            await run(false); // Don't clear terminal - keep build info visible
        } else {
            log('Build failed', 'error');
            log(r.error, 'error');
            parseProblems(r.error, 'error');
            highlightErrorLines();
            setStatus('Build failed', 'error');
            App.exePath = null;

            // If terminal docked, switch to Problems tab to show errors
            if (DockingState.terminalDocked) {
                switchDockedPanel('problems');
            }
            setBuildingState(false);
        }
    } catch (e) {
        setBuildingState(false);
        throw e;
    }
}

async function run(clearTerminal = true) {
    if (!App.exePath) { log('Build first (F11)', 'warning'); return; }

    if (!App.showTerm) {
        App.showTerm = true;
        updateUI();
    }

    // Clear terminal before running (only when called directly, not from buildRun)
    if (clearTerminal) clearTerm();

    const inputText = document.getElementById('input-area').value.trim();
    if (App.settings.execution.autoSendInput) {
        App.inputLines = inputText ? inputText.split('\n') : [];
    } else {
        App.inputLines = [];
    }
    App.inputIndex = 0;

    log('--- Running ---', 'system');
    setStatus('Running...', '');
    setRunning(true);

    // If terminal is docked, switch to terminal tab, scroll to bottom, and focus input
    if (DockingState.terminalDocked) {
        switchDockedPanel('terminal');
        scrollDockedTerminalToBottom();
        // Auto-focus the docked terminal input
        setTimeout(() => {
            const dockedInput = document.getElementById('docked-terminal-in');
            if (dockedInput) dockedInput.focus();
        }, 100);
    }

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

    setRunning(false);
    log('\n[System] Process terminated.', 'error');

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

// Terminal Color Schemes
const TERMINAL_COLOR_SCHEMES = {
    'ansi-16': ANSI_COLORS_16,
    'ansi-256': ANSI_COLORS_16, // Same as 16 for basic colors
    'dracula': {
        30: '#21222c', 31: '#ff5555', 32: '#50fa7b', 33: '#f1fa8c',
        34: '#bd93f9', 35: '#ff79c6', 36: '#8be9fd', 37: '#f8f8f2',
        90: '#6272a4', 91: '#ff6e6e', 92: '#69ff94', 93: '#ffffa5',
        94: '#d6acff', 95: '#ff92df', 96: '#a4ffff', 97: '#ffffff',
        40: '#21222c', 41: '#ff5555', 42: '#50fa7b', 43: '#f1fa8c',
        44: '#bd93f9', 45: '#ff79c6', 46: '#8be9fd', 47: '#f8f8f2'
    },
    'monokai': {
        30: '#272822', 31: '#f92672', 32: '#a6e22e', 33: '#f4bf75',
        34: '#66d9ef', 35: '#ae81ff', 36: '#a1efe4', 37: '#f8f8f2',
        90: '#75715e', 91: '#f92672', 92: '#a6e22e', 93: '#e6db74',
        94: '#66d9ef', 95: '#ae81ff', 96: '#a1efe4', 97: '#f9f8f5',
        40: '#272822', 41: '#f92672', 42: '#a6e22e', 43: '#f4bf75',
        44: '#66d9ef', 45: '#ae81ff', 46: '#a1efe4', 47: '#f8f8f2'
    },
    'nord': {
        30: '#2e3440', 31: '#bf616a', 32: '#a3be8c', 33: '#ebcb8b',
        34: '#81a1c1', 35: '#b48ead', 36: '#88c0d0', 37: '#eceff4',
        90: '#4c566a', 91: '#bf616a', 92: '#a3be8c', 93: '#ebcb8b',
        94: '#81a1c1', 95: '#b48ead', 96: '#8fbcbb', 97: '#eceff4',
        40: '#2e3440', 41: '#bf616a', 42: '#a3be8c', 43: '#ebcb8b',
        44: '#81a1c1', 45: '#b48ead', 46: '#88c0d0', 47: '#eceff4'
    },
    'solarized': {
        30: '#073642', 31: '#dc322f', 32: '#859900', 33: '#b58900',
        34: '#268bd2', 35: '#d33682', 36: '#2aa198', 37: '#eee8d5',
        90: '#586e75', 91: '#cb4b16', 92: '#859900', 93: '#b58900',
        94: '#268bd2', 95: '#6c71c4', 96: '#2aa198', 97: '#fdf6e3',
        40: '#073642', 41: '#dc322f', 42: '#859900', 43: '#b58900',
        44: '#268bd2', 45: '#d33682', 46: '#2aa198', 47: '#eee8d5'
    }
};

// Terminal message colors for different types (success, error, info, warning, system)
const TERMINAL_MESSAGE_COLORS = {
    'ansi-16': { success: '#98c379', error: '#e06c75', warning: '#e5c07b', info: '#61afef', system: '#7a8a9a' },
    'ansi-256': { success: '#98c379', error: '#e06c75', warning: '#e5c07b', info: '#61afef', system: '#7a8a9a' },
    'dracula': { success: '#50fa7b', error: '#ff5555', warning: '#f1fa8c', info: '#bd93f9', system: '#6272a4' },
    'monokai': { success: '#a6e22e', error: '#f92672', warning: '#f4bf75', info: '#66d9ef', system: '#75715e' },
    'nord': { success: '#a3be8c', error: '#bf616a', warning: '#ebcb8b', info: '#81a1c1', system: '#4c566a' },
    'solarized': { success: '#859900', error: '#dc322f', warning: '#b58900', info: '#268bd2', system: '#586e75' }
};

// Get current color scheme
function getTerminalColorScheme() {
    const scheme = App.settings?.terminal?.colorScheme || 'ansi-16';
    return TERMINAL_COLOR_SCHEMES[scheme] || ANSI_COLORS_16;
}

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
                const colors = getTerminalColorScheme();
                currentFg = colors[code];
            } else if (code >= 90 && code <= 97) {
                const colors = getTerminalColorScheme();
                currentFg = colors[code];
            } else if (code >= 40 && code <= 47) {
                const colors = getTerminalColorScheme();
                currentBg = colors[code];
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

    // Apply message type color from color scheme
    if (type && colorScheme !== 'disabled') {
        const messageColors = TERMINAL_MESSAGE_COLORS[colorScheme] || TERMINAL_MESSAGE_COLORS['ansi-16'];
        if (messageColors[type]) {
            l.style.color = messageColors[type];
        }
    }

    t.appendChild(l);
    t.scrollTop = t.scrollHeight;

    // Sync to docked terminal if docked
    if (DockingState.terminalDocked) {
        syncTerminalContent();
    }
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
        // Send each line separately
        const lines = inp.value.split('\n');
        for (const line of lines) {
            log('> ' + line, '');
            await window.electronAPI.sendInput(line);
        }
        inp.value = '';
        inp.style.height = 'auto';
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

    const diffDisplay = document.getElementById('expected-diff');
    const textarea = document.getElementById('expected-area');

    // Normalize: split into lines, trim each, filter empty
    const expectedLines = expectedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const actualLines = actualText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Find where expected starts in actual (suffix matching)
    // This handles cases where program outputs menu/prompts before the actual answer
    let startIdx = 0;
    if (actualLines.length > expectedLines.length) {
        // Try to find expected lines at the end of actual
        for (let i = actualLines.length - expectedLines.length; i >= 0; i--) {
            let match = true;
            for (let j = 0; j < expectedLines.length; j++) {
                if (actualLines[i + j] !== expectedLines[j]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                startIdx = i;
                break;
            }
        }
        // If no exact match found, use the last N lines
        if (startIdx === 0 && actualLines.length > expectedLines.length) {
            startIdx = actualLines.length - expectedLines.length;
        }
    }

    // Compare expected lines with corresponding actual lines
    let html = '';
    for (let i = 0; i < expectedLines.length; i++) {
        const expLine = expectedLines[i];
        const actLine = actualLines[startIdx + i] || '';
        const isMatch = expLine === actLine;

        if (isMatch) {
            html += `<span class="diff-token correct">${escapeHtml(expLine)}</span><br>`;
        } else {
            html += `<span class="diff-token incorrect">${escapeHtml(expLine)}</span><br>`;
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
            // Use timestamp + random suffix to ensure uniqueness when opening multiple files rapidly
            const id = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            App.tabs.push({ id, name: data.path.split(/[/\\]/).pop(), path: data.path, content: data.content, original: data.content, modified: false });
            setActive(id);
            updateUI();
            // Start watching this file for external changes
            startFileWatch(data.path);
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

    window.electronAPI.onSystemMessage?.(data => {
        log(data.message, data.type || 'system');
    });
}

// ============================================================================
// COMPETITIVE COMPANION
// ============================================================================
let ccConnected = false;
let ccProblem = null;
let ccTestIndex = 0;
let ccHasReceivedProblem = false;

function initCompetitiveCompanion() {
    const btn = document.getElementById('btn-cc');
    if (!btn) return;

    // Load verified status from settings
    ccHasReceivedProblem = App.settings?.oj?.verified || false;

    // Auto-start CC server on app load (silent mode)
    startCCServer(true);

    // Button click handler - show popup with guide
    btn.onclick = () => {
        showCCPopup();
    };

    // Test navigation buttons
    document.getElementById('btn-prev-test')?.addEventListener('click', prevTestCase);
    document.getElementById('btn-next-test')?.addEventListener('click', nextTestCase);

    // CC Popup handlers
    document.getElementById('cc-close')?.addEventListener('click', hideCCPopup);
    document.getElementById('cc-cancel')?.addEventListener('click', hideCCPopup);
    document.getElementById('cc-install')?.addEventListener('click', () => {
        window.electronAPI?.ccOpenExtensionPage?.();
        hideCCPopup();
    });

    // Close popup on overlay click
    document.getElementById('cc-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'cc-overlay') hideCCPopup();
    });

    // Listen for incoming problems
    window.electronAPI?.onProblemReceived?.(handleProblemReceived);
}

function showCCPopup() {
    document.getElementById('cc-overlay')?.classList.add('show');
    document.getElementById('btn-cc')?.classList.add('active');
}

function hideCCPopup() {
    document.getElementById('cc-overlay')?.classList.remove('show');
    document.getElementById('btn-cc')?.classList.remove('active');
}

async function startCCServer(silent = false) {
    const btn = document.getElementById('btn-cc');
    if (!btn || !window.electronAPI?.ccStartServer) return;

    try {
        const result = await window.electronAPI.ccStartServer();

        if (result?.success) {
            ccConnected = true;
            btn.title = 'Lấy test từ OJ';

            if (!silent) {
                log('OJ: Sẵn sàng nhận test cases', 'success');

                // Only show extension guide if never received a problem before
                if (!ccHasReceivedProblem) {
                    log('    Cài extension: Chrome Web Store > "Competitive Companion"', 'info');
                    log('    Sau đó vào VNOI/Codeforces và click icon extension', 'info');
                }
            }
        } else if (!silent) {
            ccConnected = false;
            log('OJ: Không thể khởi động (port 27121 đang dùng)', 'warning');
        }
    } catch (e) {
        console.error('CC Server error:', e);
    }
}

function handleProblemReceived(problem) {
    console.log('Received problem:', problem);

    // Mark that we have received at least one problem and save to settings
    if (!ccHasReceivedProblem) {
        ccHasReceivedProblem = true;
        if (!App.settings.oj) App.settings.oj = {};
        App.settings.oj.verified = true;
        saveSettings();
    }

    // Store problem data
    ccProblem = problem;
    ccTestIndex = 0;

    // Remove Vietnamese diacritics and create safe filename
    const removeVietnameseDiacritics = (str) => {
        return str
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D');
    };

    const safeName = removeVietnameseDiacritics(problem.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 50);
    const fileName = safeName + '.cpp';

    // Create new tab with template
    const id = 'tab_' + Date.now();
    const template = DEFAULT_CODE;

    App.tabs.push({
        id,
        name: fileName,
        path: null,
        content: template,
        original: template,
        modified: false
    });

    // Set active and force UI update
    App.activeTabId = id;

    // Ensure editor displays the content
    if (App.editor && App.ready) {
        App.editor.setValue(template);
    }

    renderTabs();
    updateUI();

    // Fill in test cases
    const testCount = problem.tests?.length || 0;
    if (testCount > 0) {
        const inputArea = document.getElementById('input-area');
        const expectedArea = document.getElementById('expected-area');

        if (inputArea) inputArea.value = problem.tests[0].input || '';
        if (expectedArea) expectedArea.value = problem.tests[0].output || '';
    }

    // Show/hide test navigation based on test count
    updateTestNavUI();

    // Show IO panel if hidden
    if (!App.showIO) toggleIO();

    // Log success - clean format without emojis
    const timeLimit = problem.timeLimit ? `${problem.timeLimit}ms` : '-';
    const memLimit = problem.memoryLimit ? `${problem.memoryLimit}MB` : '-';

    log(`[OJ] ${problem.name}`, 'success');
    log(`     ${testCount} test | ${timeLimit} | ${memLimit}`, 'info');

    // Update status
    setStatus(`${problem.name}`, 'success');

    // Flash the CC button to indicate success
    const btn = document.getElementById('btn-cc');
    if (btn) {
        btn.classList.add('cc-flash');
        setTimeout(() => btn.classList.remove('cc-flash'), 1000);
    }

    // Force editor focus after a short delay to ensure it's ready
    setTimeout(() => {
        if (App.editor) {
            App.editor.focus();
            App.editor.layout();
        }
    }, 100);
}

// Update test navigation UI
function updateTestNavUI() {
    const testNav = document.getElementById('test-nav');
    const testLabel = document.getElementById('test-nav-label');
    const runAllBtn = document.getElementById('btn-run-all-tests');

    const testCount = ccProblem?.tests?.length || 0;

    // Show/hide Run All button in header
    if (runAllBtn) {
        runAllBtn.style.display = testCount > 0 ? 'flex' : 'none';
    }

    if (!testNav || !testLabel) return;

    // Show test navigation only when multiple tests
    if (testCount > 1) {
        testNav.style.display = 'flex';
        testLabel.textContent = `${ccTestIndex + 1}/${testCount}`;
    } else {
        testNav.style.display = 'none';
    }
}

// Helper: Switch between test cases (if multiple)
function switchTestCase(index) {
    if (!ccProblem || !ccProblem.tests || index < 0 || index >= ccProblem.tests.length) return;

    ccTestIndex = index;
    const test = ccProblem.tests[index];

    const inputArea = document.getElementById('input-area');
    const expectedArea = document.getElementById('expected-area');

    if (inputArea) inputArea.value = test.input || '';
    if (expectedArea) expectedArea.value = test.output || '';

    // Update nav UI
    updateTestNavUI();
}

function nextTestCase() {
    if (ccProblem && ccProblem.tests) {
        switchTestCase((ccTestIndex + 1) % ccProblem.tests.length);
    }
}

function prevTestCase() {
    if (ccProblem && ccProblem.tests) {
        switchTestCase((ccTestIndex - 1 + ccProblem.tests.length) % ccProblem.tests.length);
    }
}

// ============================================================================
// FILE WATCHER - Detect external changes
// ============================================================================
let pendingReloadNotifications = new Set(); // Track which files have pending notifications

// Start watching a file when it's opened
function startFileWatch(filePath) {
    if (!filePath || !window.electronAPI?.watchFile) return;
    window.electronAPI.watchFile(filePath);
}

// Stop watching a file when tab is closed
function stopFileWatch(filePath) {
    if (!filePath || !window.electronAPI?.unwatchFile) return;
    window.electronAPI.unwatchFile(filePath);
}

// Handle external file change notification
function handleExternalFileChange(filePath) {
    // Don't show duplicate notifications
    if (pendingReloadNotifications.has(filePath)) return;

    // Find the tab for this file
    const tab = App.tabs.find(t => t.path === filePath);
    if (!tab) return;

    pendingReloadNotifications.add(filePath);

    // Show notification popup
    showReloadNotification(tab);
}

// Show reload notification popup (similar to Dev-C++)
function showReloadNotification(tab) {
    // Remove any existing notification for this file
    const existingNotif = document.querySelector(`.reload-notification[data-path="${CSS.escape(tab.path)}"]`);
    if (existingNotif) existingNotif.remove();

    const notification = document.createElement('div');
    notification.className = 'reload-notification';
    notification.dataset.path = tab.path;

    notification.innerHTML = `
        <div class="reload-notification-content">
            <div class="reload-notification-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
            </div>
            <div class="reload-notification-text">
                <div class="reload-notification-title">File đã thay đổi</div>
                <div class="reload-notification-file">${tab.name}</div>
                <div class="reload-notification-desc">File đã được thay đổi bên ngoài. Bạn có muốn tải lại?</div>
            </div>
            <div class="reload-notification-actions">
                <button class="reload-btn reload-btn-yes" title="Tải lại từ disk">Tải lại</button>
                <button class="reload-btn reload-btn-no" title="Giữ nguyên">Bỏ qua</button>
            </div>
        </div>
    `;

    // Yes - Reload from disk
    notification.querySelector('.reload-btn-yes').onclick = async () => {
        const result = await window.electronAPI?.reloadFile?.(tab.path);
        if (result?.success) {
            tab.content = result.content;
            tab.original = result.content;
            tab.modified = false;

            // Update editor if this tab is currently active
            if (tab.id === App.activeTabId && App.editor) {
                const position = App.editor.getPosition();
                App.editor.setValue(result.content);
                if (position) App.editor.setPosition(position);
            }
            if (tab.id === App.splitTabId && App.editor2) {
                const position = App.editor2.getPosition();
                App.editor2.setValue(result.content);
                if (position) App.editor2.setPosition(position);
            }

            renderTabs();
            log(`Reloaded: ${tab.name}`, 'system');
        }
        pendingReloadNotifications.delete(tab.path);
        notification.remove();
    };

    // No - Keep current content
    notification.querySelector('.reload-btn-no').onclick = () => {
        pendingReloadNotifications.delete(tab.path);
        notification.remove();
        log(`Kept local version: ${tab.name}`, 'system');
    };

    document.body.appendChild(notification);

    // Auto-dismiss after 30 seconds if no action taken
    setTimeout(() => {
        if (document.body.contains(notification)) {
            pendingReloadNotifications.delete(tab.path);
            notification.remove();
        }
    }, 30000);
}

// Initialize file watcher listener
if (window.electronAPI?.onFileChangedExternal) {
    window.electronAPI.onFileChangedExternal(data => {
        handleExternalFileChange(data.path);
    });
}

// ============================================================================
// BATCH TESTING - Run All Test Cases
// ============================================================================
let batchTestResults = [];
let isBatchTesting = false;

function initBatchTesting() {
    const runAllBtn = document.getElementById('btn-run-all-tests');
    if (!runAllBtn) return;

    runAllBtn.addEventListener('click', runAllTests);

    // Tab switching in Problems panel
    const problemsPanel = document.getElementById('problems-panel');
    if (problemsPanel) {
        problemsPanel.querySelectorAll('.panel-title[data-panel]').forEach(tab => {
            tab.addEventListener('click', () => switchProblemsTab(tab.dataset.panel));
        });
    }
}

async function runAllTests() {
    if (!ccProblem || !ccProblem.tests || ccProblem.tests.length === 0) {
        log('Không có test cases để chạy. Hãy lấy test từ OJ trước!', 'warning');
        return;
    }

    if (isBatchTesting) {
        log('Đang chạy tests...', 'warning');
        return;
    }

    const runAllBtn = document.getElementById('btn-run-all-tests');
    if (runAllBtn) {
        runAllBtn.classList.add('running');
    }

    isBatchTesting = true;
    batchTestResults = [];

    // First, compile the code
    log('=== Run All Tests ===', 'system');
    setStatus('Compiling...', '');

    const tab = App.tabs.find(t => t.id === App.activeTabId);
    if (!tab) {
        log('Không có file đang mở!', 'error');
        isBatchTesting = false;
        runAllBtn?.classList.remove('running');
        return;
    }

    const content = App.editor ? App.editor.getValue() : tab.content;
    const compileFlags = buildCompileFlags();

    const compileResult = await window.electronAPI.compile({
        filePath: tab.path,
        content: content,
        flags: compileFlags
    });

    if (!compileResult.success) {
        log('Compile Error!', 'error');
        log(compileResult.error, 'error');
        setStatus('Compile Error', 'error');
        isBatchTesting = false;
        runAllBtn?.classList.remove('running');
        return;
    }

    App.exePath = compileResult.outputPath;
    log(`Compiled in ${compileResult.time}ms`, 'success');

    // Get time limit from problem or settings
    const timeLimit = ccProblem.timeLimit || (App.settings.execution.timeLimitSeconds * 1000) || 3000;

    // Run each test case
    const totalTests = ccProblem.tests.length;
    let passedCount = 0;

    for (let i = 0; i < totalTests; i++) {
        const test = ccProblem.tests[i];
        setStatus(`Testing ${i + 1}/${totalTests}...`, '');

        const result = await window.electronAPI.runTest({
            exePath: App.exePath,
            input: test.input || '',
            expectedOutput: test.output || '',
            timeLimit: timeLimit
        });

        result.testIndex = i;
        result.testName = `Test ${i + 1}`;
        batchTestResults.push(result);

        if (result.status === 'AC') {
            passedCount++;
            log(`  Test ${i + 1}: AC (${result.executionTime}ms)`, 'success');
        } else {
            log(`  Test ${i + 1}: ${result.status} (${result.executionTime}ms)`,
                result.status === 'WA' ? 'error' : 'warning');
        }
    }

    // Show summary
    const allPassed = passedCount === totalTests;
    log(`\n=== ${passedCount}/${totalTests} AC ===`, allPassed ? 'success' : 'warning');
    setStatus(`${passedCount}/${totalTests} AC`, allPassed ? 'success' : '');

    // Update UI
    renderTestResults();
    showTestsTab();

    isBatchTesting = false;
    runAllBtn?.classList.remove('running');
}

function renderTestResults() {
    const container = document.getElementById('tests-results-list');
    const countEl = document.getElementById('test-results-count');

    if (!container) return;

    const passed = batchTestResults.filter(r => r.status === 'AC').length;
    const total = batchTestResults.length;

    // Update count badge
    if (countEl) {
        countEl.textContent = `${passed}/${total}`;
        countEl.style.display = total > 0 ? 'inline' : 'none';
    }

    // Build HTML
    let html = '';

    // Summary bar
    if (total > 0) {
        const allPassed = passed === total;
        html += `
            <div class="test-results-summary">
                <span class="test-summary-stat passed">✓ ${passed} passed</span>
                <span class="test-summary-stat failed">✗ ${total - passed} failed</span>
                <span class="test-summary-stat total">${batchTestResults.reduce((s, r) => s + r.executionTime, 0)}ms total</span>
            </div>
        `;
    }

    // Individual results
    batchTestResults.forEach((result, idx) => {
        const timeStr = result.executionTime >= 1000
            ? (result.executionTime / 1000).toFixed(2) + 's'
            : result.executionTime + 'ms';

        const memStr = result.peakMemoryKB > 0
            ? (result.peakMemoryKB >= 1024
                ? (result.peakMemoryKB / 1024).toFixed(1) + 'MB'
                : result.peakMemoryKB + 'KB')
            : '';

        html += `
            <div class="test-result-item" data-index="${idx}">
                <span class="test-result-status ${result.status}">${result.status}</span>
                <div class="test-result-info">
                    <span class="test-result-title">${result.testName}</span>
                    <span class="test-result-details">${result.details || ''}</span>
                </div>
                <span class="test-result-time">${timeStr}${memStr ? ' | ' + memStr : ''}</span>
            </div>
        `;
    });

    container.innerHTML = html;

    // Click to view test case
    container.querySelectorAll('.test-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.index);
            if (ccProblem && ccProblem.tests[idx]) {
                switchTestCase(idx);
            }
        });
    });
}

function switchProblemsTab(tabName) {
    const problemsList = document.getElementById('problems-list');
    const testsList = document.getElementById('tests-results-list');
    const problemsTitle = document.querySelector('.panel-title.problems');
    const testsTitle = document.querySelector('.panel-title.tests');

    if (tabName === 'problems') {
        problemsList.style.display = 'block';
        testsList.style.display = 'none';
        problemsTitle?.classList.add('active');
        testsTitle?.classList.remove('active');
    } else {
        problemsList.style.display = 'none';
        testsList.style.display = 'block';
        problemsTitle?.classList.remove('active');
        testsTitle?.classList.add('active');
    }
}

function showTestsTab() {
    const problemsPanel = document.getElementById('problems-panel');

    // Show problems panel if hidden
    if (!App.showProblems) {
        App.showProblems = true;
        updateUI();
    }

    // Switch to tests tab
    switchProblemsTab('tests');

    // Auto-expand panel for better visibility
    if (problemsPanel) {
        problemsPanel.classList.add('auto-expand');
        // Set a reasonable min-height based on number of tests
        const testCount = batchTestResults.length;
        const minHeight = Math.min(200 + testCount * 50, 400);
        problemsPanel.style.minHeight = `${minHeight}px`;
    }
}

function buildCompileFlags() {
    const flags = [];
    if (App.settings.compiler.cppStandard) {
        flags.push(`-std=${App.settings.compiler.cppStandard}`);
    }
    if (App.settings.compiler.optimization) {
        flags.push(App.settings.compiler.optimization);
    }
    if (App.settings.compiler.warnings) {
        flags.push('-Wall', '-Wextra');
    }
    return flags.join(' ');
}

// Initialize batch testing
initBatchTesting();

// ============================================================================
// AUTO UPDATE - Check for new versions
// ============================================================================
let updateInfo = null;
let updateDismissedVersion = null;

async function checkForUpdates() {
    if (!window.electronAPI?.checkForUpdates) return;

    try {
        const info = await window.electronAPI.checkForUpdates();

        if (info.hasUpdate) {
            // Check if user dismissed this version before
            const dismissedVersion = localStorage.getItem('dismissedUpdateVersion');
            if (dismissedVersion === info.latestVersion) {
                console.log('[Update] User previously dismissed this version');
                return;
            }

            updateInfo = info;
            showUpdateNotification(info);
        }
    } catch (error) {
        console.error('[Update] Check failed:', error);
    }
}

function showUpdateNotification(info) {
    const overlay = document.getElementById('update-overlay');
    const currentEl = document.getElementById('update-current');
    const newEl = document.getElementById('update-new');
    const notesEl = document.getElementById('update-notes');

    if (!overlay) return;

    // Update content
    if (currentEl) currentEl.textContent = `v${info.currentVersion}`;
    if (newEl) newEl.textContent = `v${info.latestVersion}`;
    if (notesEl) {
        // Simplified update message - Wibu style (High Contrast)
        notesEl.innerHTML = '<p style="text-align: center; font-weight: 600; font-size: 15px; margin: 10px 0;">Thằng wjbu nó mới fix bug hay thêm tính năng gì đó. Tải thử xem coi có gì khác không 🐟</p>';
    }

    // Show overlay
    overlay.classList.add('show');

    // Setup handlers
    document.getElementById('update-close')?.addEventListener('click', hideUpdateNotification);
    document.getElementById('update-later')?.addEventListener('click', () => {
        // Don't show again for this session
        hideUpdateNotification();
    });
    document.getElementById('update-download')?.addEventListener('click', () => {
        // Always open the release page (User preference: Link Git)
        window.electronAPI.openReleasePage(info.releaseUrl);
        hideUpdateNotification();
    });

    // Click overlay to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideUpdateNotification();
    });
}

function hideUpdateNotification() {
    const overlay = document.getElementById('update-overlay');
    if (overlay) {
        overlay.classList.remove('show');
    }
}

// Check for updates on startup (after a short delay)
setTimeout(() => {
    checkForUpdates();
}, 3000);

// Add keyboard shortcut for Run All Tests (Ctrl+Shift+F11)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'F11') {
        e.preventDefault();
        runAllTests();
    }
});

// ============================================================================
// TERMINAL UX ENHANCEMENTS & LOGIC
// ============================================================================
let termHistory = [];
let termHistoryIndex = -1;
let termCurrentDraft = '';

function initTerminalUX() {
    const termSection = document.getElementById('terminal-section');
    const termInput = document.getElementById('terminal-in');

    if (termInput) {
        // Auto-resize logic with paste fix
        const handleResize = function () {
            if (this.value === '') {
                this.style.height = '';
                return;
            }
            this.style.height = 0; // Set to 0 first to correctly calculate scrollHeight
            this.style.height = (this.scrollHeight) + 'px';
        };
        termInput.addEventListener('input', handleResize);
        termInput.addEventListener('paste', function () {
            setTimeout(() => handleResize.call(this), 10);
        });

        // Keydown Handler: History, Ctrl+C, Enter
        termInput.addEventListener('keydown', (e) => {
            // 1. Ctrl+C to Stop
            if (e.ctrlKey && e.key === 'c') {
                if (termInput.selectionStart === termInput.selectionEnd) {
                    e.preventDefault();
                    if (App.isRunning) {
                        stop();
                        log('^C', 'error');
                    }
                }
                return;
            }

            // 2. History Navigation (Up/Down)
            if (e.key === 'ArrowUp') {
                if (termHistory.length > 0) {
                    e.preventDefault();
                    if (termHistoryIndex === -1) {
                        termCurrentDraft = termInput.value; // Save current input
                        termHistoryIndex = termHistory.length - 1;
                    } else if (termHistoryIndex > 0) {
                        termHistoryIndex--;
                    }
                    termInput.value = termHistory[termHistoryIndex];
                    handleResize.call(termInput);
                }
            } else if (e.key === 'ArrowDown') {
                if (termHistoryIndex !== -1) {
                    e.preventDefault();
                    if (termHistoryIndex < termHistory.length - 1) {
                        termHistoryIndex++;
                        termInput.value = termHistory[termHistoryIndex];
                    } else {
                        termHistoryIndex = -1;
                        termInput.value = termCurrentDraft; // Restore draft
                    }
                    handleResize.call(termInput);
                }
            }

            // 3. Enter to Send
            if (e.key === 'Enter') {
                if (e.shiftKey) {
                    // Newline
                } else {
                    e.preventDefault();
                    const val = termInput.value.trim();
                    if (val) {
                        // Add to history if unique or last one different
                        if (termHistory.length === 0 || termHistory[termHistory.length - 1] !== val) {
                            termHistory.push(val);
                        }
                        termHistoryIndex = -1;
                        termCurrentDraft = '';
                    }
                    sendInput();
                }
            }
        });

        // 4. Paste context menu (Right click on terminal area)
        if (termSection && !termSection.dataset.contextMenuInitialized) {
            termSection.dataset.contextMenuInitialized = 'true';

            termSection.addEventListener('contextmenu', async (e) => {
                if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'TEXTAREA') {
                    if (e.target.tagName === 'TEXTAREA') return;
                }

                e.preventDefault();
                try {
                    const text = await navigator.clipboard.readText();
                    if (text && !termInput.disabled) {
                        const startPos = termInput.selectionStart;
                        const endPos = termInput.selectionEnd;
                        const currentValue = termInput.value;

                        termInput.value = currentValue.substring(0, startPos) + text + currentValue.substring(endPos);

                        // Dispatch input event to trigger auto-resize consistently
                        termInput.dispatchEvent(new Event('input'));

                        termInput.focus();

                        // Update cursor position
                        const newPos = startPos + text.length;
                        termInput.setSelectionRange(newPos, newPos);
                    }
                } catch (err) {
                    console.warn('Paste failed:', err);
                }
            });
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTerminalUX);
} else {
    initTerminalUX();
}
