/**
 * C++ IDE - Full Featured with Settings, Error Highlighting & Split Editor
 */

// ===== DEFAULT SETTINGS =====
const DEFAULT_SETTINGS = {
    editor: {
        fontSize: 14,
        fontFamily: "'JetBrains Mono', monospace",
        tabSize: 4,
        minimap: false,
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
        theme: 'kawaii-dark',
        accentColor: '#b48ead',
        bgOpacity: 50,
        bgUrl: ''
    },
    panels: {
        showIO: false,
        showTerm: true,
        showProblems: false
    }
};

// ===== APP STATE =====
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
    int n;
    cin >> n;
    cout << "Result: " << n * 2 << endl;
    return 0;
}
`;

// ===== INIT =====
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

// ===== MONACO EDITOR =====
function initMonaco() {
    require(['vs/editor/editor.main'], function () {
        monaco.editor.defineTheme('kawaii', {
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
            }
        });

        App.editor = createEditor('editor-container');
        App.ready = true;

        // Track active editor on focus
        document.getElementById('editor-container').addEventListener('mousedown', () => {
            App.activeEditor = 1;
        });
    });
}

function createEditor(containerId) {
    const editor = monaco.editor.create(document.getElementById(containerId), {
        value: '',
        language: 'cpp',
        theme: 'kawaii',
        fontSize: App.settings.editor.fontSize,
        fontFamily: App.settings.editor.fontFamily,
        fontLigatures: true,
        minimap: { enabled: App.settings.editor.minimap },
        wordWrap: App.settings.editor.wordWrap ? 'on' : 'off',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: App.settings.editor.tabSize,
        cursorBlinking: 'smooth',
        smoothScrolling: true,
        bracketPairColorization: { enabled: true },
        padding: { top: 12 }
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

// ===== SPLIT EDITOR =====
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

// ===== SETTINGS =====
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

    const fontSizeSlider = document.getElementById('set-fontSize');
    fontSizeSlider.oninput = () => {
        document.getElementById('val-fontSize').textContent = fontSizeSlider.value + 'px';
    };

    // Background opacity slider
    const bgOpacitySlider = document.getElementById('set-bgOpacity');
    bgOpacitySlider.oninput = () => {
        document.getElementById('val-bgOpacity').textContent = bgOpacitySlider.value + '%';
    };

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
        document.getElementById('set-bgUrl').value = '';
    };

    document.getElementById('btn-save-settings').onclick = saveSettingsAndClose;
    document.getElementById('btn-reset-settings').onclick = resetSettings;
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

    document.getElementById('set-theme').value = App.settings.appearance.theme;
    document.getElementById('set-accentColor').value = App.settings.appearance.accentColor;
    document.getElementById('set-bgOpacity').value = App.settings.appearance.bgOpacity || 50;
    document.getElementById('val-bgOpacity').textContent = (App.settings.appearance.bgOpacity || 50) + '%';
    document.getElementById('set-bgUrl').value = App.settings.appearance.bgUrl || '';

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

    App.settings.appearance.theme = document.getElementById('set-theme').value;
    App.settings.appearance.accentColor = document.getElementById('set-accentColor').value;
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
    document.documentElement.style.setProperty('--accent', App.settings.appearance.accentColor);

    // Apply background opacity overlay
    const opacity = (App.settings.appearance.bgOpacity || 50) / 100;
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
        appContainer.style.background = `rgba(255, 255, 255, ${opacity * 0.3})`;
    }

    // Apply custom background or default gradient
    const bgUrl = App.settings.appearance.bgUrl;
    if (bgUrl) {
        document.body.style.background = `url('${bgUrl}') no-repeat center center fixed`;
        document.body.style.backgroundSize = 'cover';
    } else {
        document.body.style.background = 'linear-gradient(135deg, #e8f4fc 0%, #d4eaf7 50%, #c5e3f6 100%)';
    }
}

// ===== KEYBOARD SHORTCUTS =====
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

// ===== UI UPDATE =====
function updateUI() {
    const hasTabs = App.tabs.length > 0;
    document.getElementById('welcome').style.display = hasTabs ? 'none' : 'flex';
    document.getElementById('editor-section').style.display = hasTabs ? 'flex' : 'none';

    document.getElementById('io-section').style.display = App.showIO ? 'flex' : 'none';
    document.getElementById('resizer-io').style.display = App.showIO ? 'block' : 'none';
    document.getElementById('btn-toggle-io').classList.toggle('active', App.showIO);

    document.getElementById('terminal-section').style.display = App.showTerm ? 'flex' : 'none';
    document.getElementById('resizer-term').style.display = App.showTerm ? 'block' : 'none';
    document.getElementById('btn-toggle-term').classList.toggle('active', App.showTerm);

    document.getElementById('problems-panel').classList.toggle('hidden', !App.showProblems);
    document.getElementById('resizer-problems').style.display = App.showProblems ? 'block' : 'none';
    document.getElementById('btn-toggle-problems').classList.toggle('active', App.showProblems);
}

// ===== HEADER =====
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

// ===== PANELS =====
function initPanels() {
    document.getElementById('clear-input').onclick = () => { document.getElementById('input-area').value = ''; };
    document.getElementById('clear-output').onclick = () => { document.getElementById('expected-area').value = ''; };
    document.getElementById('clear-term').onclick = clearTerm;
    document.getElementById('close-problems').onclick = () => { App.showProblems = false; updateUI(); };

    document.getElementById('btn-send').onclick = sendInput;
    document.getElementById('terminal-in').onkeypress = e => { if (e.key === 'Enter') sendInput(); };
}

// ===== RESIZERS =====
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

// ===== TABS =====
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

// ===== MENUS =====
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

// ===== FILE OPERATIONS =====
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

// ===== BUILD & RUN =====
async function buildRun() {
    const tab = App.tabs.find(t => t.id === App.activeTabId);
    if (!tab) { log('No file open', 'warning'); return; }
    if (!tab.path) { log('Save file first', 'warning'); await saveAs(); if (!tab.path) return; }

    tab.content = App.editor.getValue();
    await window.electronAPI.saveFile({ path: tab.path, content: tab.content });
    tab.original = tab.content; tab.modified = false; renderTabs();

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

// ===== ERROR HIGHLIGHTING =====
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

// ===== PROBLEMS =====
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

// ===== TERMINAL =====
function log(msg, type = '') {
    const t = document.getElementById('terminal');
    const l = document.createElement('pre');
    l.className = 'line' + (type ? ' ' + type : '');
    l.style.margin = '0';
    l.style.fontFamily = 'inherit';
    l.textContent = msg;
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
    const expected = document.getElementById('expected-area').value.trim();
    if (!expected) return;
    const actual = document.getElementById('terminal').innerText;
    if (actual.includes(expected)) {
        log('\nOutput matches!', 'success');
    } else {
        log('\nOutput differs', 'warning');
    }
}

// ===== IPC HANDLERS =====
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
    window.electronAPI.onProcessExit?.(code => {
        if (App.runTimeout) {
            clearTimeout(App.runTimeout);
            App.runTimeout = null;
        }
        log(`\n--- Exit (${code}) ---`, code === 0 ? 'success' : 'warning');
        setRunning(false);
        setStatus(code === 0 ? 'Done' : `Exit: ${code}`, code === 0 ? 'success' : '');
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
