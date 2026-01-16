/**
 * Sameko Dev C++ IDE - Split Editor Manager
 * Manages split view functionality
 * 
 * @module src/core/editor/split-manager
 */

// ============================================================================
// SPLIT STATE
// ============================================================================

let isSplitOpen = false;
let editorLeft = null;
let editorRight = null;
let activeEditorIndex = 1; // 1 = left, 2 = right

// ============================================================================
// SPLIT FUNCTIONS
// ============================================================================

/**
 * Toggle split view
 */
function toggleSplit() {
    if (isSplitOpen) {
        closeSplit();
    } else {
        openSplit();
    }
}

/**
 * Open split view
 */
function openSplit() {
    const container1 = document.getElementById('editor-container-1');
    const container2 = document.getElementById('editor-container-2');
    const splitter = document.getElementById('split-resizer');

    if (!container1 || !container2 || !splitter) return;

    container1.style.width = '50%';
    container2.style.display = 'block';
    container2.style.width = '50%';
    splitter.style.display = 'block';

    isSplitOpen = true;

    // Layout editors after split
    if (editorLeft) editorLeft.layout();
    if (editorRight) editorRight.layout();
}

/**
 * Close split view
 */
function closeSplit() {
    const container1 = document.getElementById('editor-container-1');
    const container2 = document.getElementById('editor-container-2');
    const splitter = document.getElementById('split-resizer');

    if (!container1 || !container2 || !splitter) return;

    container1.style.width = '100%';
    container2.style.display = 'none';
    splitter.style.display = 'none';

    isSplitOpen = false;
    activeEditorIndex = 1;

    if (editorLeft) editorLeft.layout();
}

/**
 * Swap files between split editors
 */
function swapSplitEditors() {
    if (!isSplitOpen || !editorLeft || !editorRight) return;

    const leftContent = editorLeft.getValue();
    const rightContent = editorRight.getValue();

    editorLeft.setValue(rightContent);
    editorRight.setValue(leftContent);
}

/**
 * Get active editor
 * @returns {monaco.editor.IStandaloneCodeEditor}
 */
function getActiveEditor() {
    return activeEditorIndex === 1 ? editorLeft : editorRight;
}

/**
 * Set active editor
 * @param {number} index - 1 for left, 2 for right
 */
function setActiveEditor(index) {
    activeEditorIndex = index;
}

/**
 * Check if split is open
 * @returns {boolean}
 */
function isSplitViewOpen() {
    return isSplitOpen;
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        toggleSplit,
        openSplit,
        closeSplit,
        swapSplitEditors,
        getActiveEditor,
        setActiveEditor,
        isSplitViewOpen
    };
}

if (typeof window !== 'undefined') {
    window.SplitManager = {
        toggleSplit,
        openSplit,
        closeSplit,
        swapSplitEditors,
        getActiveEditor,
        setActiveEditor,
        isSplitViewOpen
    };
}
