/**
 * Sameko Dev C++ IDE - Panel Manager
 * Collapsible panels (File Explorer, Output, Problems)
 * 
 * @module src/features/panels/panel-manager
 */

// ============================================================================
// PANEL STATE
// ============================================================================

const panels = new Map();

/**
 * @typedef {Object} PanelConfig
 * @property {string} id
 * @property {string} title
 * @property {string} position - 'left', 'right', 'bottom'
 * @property {boolean} isOpen
 * @property {number} size - Width or height in px
 */

// ============================================================================
// PANEL FUNCTIONS
// ============================================================================

/**
 * Register panel
 * @param {PanelConfig} config
 */
function registerPanel(config) {
    panels.set(config.id, {
        ...config,
        isOpen: config.isOpen ?? true,
        size: config.size ?? 250
    });
}

/**
 * Toggle panel
 * @param {string} panelId
 */
function togglePanel(panelId) {
    const panel = panels.get(panelId);
    if (!panel) return;

    panel.isOpen = !panel.isOpen;
    updatePanelUI(panelId);
}

/**
 * Open panel
 * @param {string} panelId
 */
function openPanel(panelId) {
    const panel = panels.get(panelId);
    if (!panel) return;

    panel.isOpen = true;
    updatePanelUI(panelId);
}

/**
 * Close panel
 * @param {string} panelId
 */
function closePanel(panelId) {
    const panel = panels.get(panelId);
    if (!panel) return;

    panel.isOpen = false;
    updatePanelUI(panelId);
}

/**
 * Set panel size
 * @param {string} panelId
 * @param {number} size
 */
function setPanelSize(panelId, size) {
    const panel = panels.get(panelId);
    if (!panel) return;

    panel.size = size;
    updatePanelUI(panelId);
}

/**
 * Get panel state
 * @param {string} panelId
 * @returns {PanelConfig|undefined}
 */
function getPanel(panelId) {
    return panels.get(panelId);
}

/**
 * Check if panel is open
 * @param {string} panelId
 * @returns {boolean}
 */
function isPanelOpen(panelId) {
    return panels.get(panelId)?.isOpen ?? false;
}

// ============================================================================
// UI UPDATE
// ============================================================================

/**
 * Update panel UI based on state
 * @param {string} panelId
 */
function updatePanelUI(panelId) {
    const panel = panels.get(panelId);
    if (!panel) return;

    const el = document.getElementById(panelId);
    if (!el) return;

    if (panel.isOpen) {
        el.classList.remove('collapsed');
        el.style[panel.position === 'bottom' ? 'height' : 'width'] = `${panel.size}px`;
    } else {
        el.classList.add('collapsed');
        el.style[panel.position === 'bottom' ? 'height' : 'width'] = '0';
    }

    // Trigger layout update for editors
    if (window.App?.editor) {
        setTimeout(() => window.App.editor.layout(), 50);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { registerPanel, togglePanel, openPanel, closePanel, setPanelSize, getPanel, isPanelOpen };
}

if (typeof window !== 'undefined') {
    window.PanelManager = { registerPanel, togglePanel, openPanel, closePanel, setPanelSize, getPanel, isPanelOpen };
}
