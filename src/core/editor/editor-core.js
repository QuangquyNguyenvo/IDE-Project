/**
 * Sameko Dev C++ IDE - Editor Core
 * Monaco Editor initialization and configuration
 * 
 * NOTE: This is a modular version of the editor code from app.js.
 * Currently for reference/future use. The app still uses app.js directly.
 * 
 * @module src/core/editor/editor-core
 */

// ============================================================================
// EDITOR FACTORY
// ============================================================================

/**
 * Default Monaco editor options
 */
const DEFAULT_EDITOR_OPTIONS = {
    language: 'cpp',
    automaticLayout: true,
    minimap: { enabled: true },
    fontSize: 14,
    fontFamily: 'Consolas, monospace',
    tabSize: 4,
    wordWrap: 'off',
    lineNumbers: 'on',
    roundedSelection: true,
    scrollBeyondLastLine: false,
    renderWhitespace: 'none',
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
    bracketPairColorization: { enabled: true },
    'semanticHighlighting.enabled': true,
    'editor.suggest.showKeywords': true,
    suggestSelection: 'first',
    quickSuggestions: true,
    snippetSuggestions: 'inline',
    formatOnPaste: false,
    formatOnType: false,
    autoClosingBrackets: 'always',
    autoClosingQuotes: 'always',
    autoIndent: 'full'
};

/**
 * Create Monaco editor instance
 * @param {HTMLElement|string} container - Container element or ID
 * @param {Object} options - Editor options
 * @returns {monaco.editor.IStandaloneCodeEditor}
 */
function createEditor(container, options = {}) {
    const containerEl = typeof container === 'string'
        ? document.getElementById(container)
        : container;

    if (!containerEl) {
        throw new Error(`Editor container not found: ${container}`);
    }

    const mergedOptions = {
        ...DEFAULT_EDITOR_OPTIONS,
        ...options,
        value: options.value || ''
    };

    const editor = monaco.editor.create(containerEl, mergedOptions);

    // Add resize observer for automatic layout
    const resizeObserver = new ResizeObserver(() => {
        editor.layout();
    });
    resizeObserver.observe(containerEl);

    return editor;
}

/**
 * Update editor options
 * @param {monaco.editor.IStandaloneCodeEditor} editor
 * @param {Object} options
 */
function updateEditorOptions(editor, options) {
    editor.updateOptions(options);
}

/**
 * Apply theme to editor
 * @param {string} themeName
 */
function setEditorTheme(themeName) {
    monaco.editor.setTheme(themeName);
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DEFAULT_EDITOR_OPTIONS,
        createEditor,
        updateEditorOptions,
        setEditorTheme
    };
}

// For browser global
if (typeof window !== 'undefined') {
    window.EditorCore = {
        DEFAULT_EDITOR_OPTIONS,
        createEditor,
        updateEditorOptions,
        setEditorTheme
    };
}
