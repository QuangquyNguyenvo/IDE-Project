/**
 * Sameko Dev C++ IDE - Tab Manager
 * Tab creation, switching, and management
 * 
 * @module src/features/tabs/tab-manager
 */

// ============================================================================
// TAB STATE
// ============================================================================

const tabs = new Map(); // Map<tabId, TabInfo>
let activeTabId = null;
let tabCounter = 0;

/**
 * @typedef {Object} TabInfo
 * @property {string} id - Unique tab ID
 * @property {string} title - Tab title
 * @property {string} path - File path (null for unsaved)
 * @property {string} content - File content
 * @property {boolean} modified - Has unsaved changes
 * @property {number} viewState - Monaco view state
 */

// ============================================================================
// TAB FUNCTIONS
// ============================================================================

/**
 * Create new tab
 * @param {Object} options
 * @returns {string} Tab ID
 */
function createTab(options = {}) {
    const id = `tab-${++tabCounter}`;
    const tab = {
        id,
        title: options.title || 'Untitled',
        path: options.path || null,
        content: options.content || '',
        modified: false,
        viewState: null
    };
    tabs.set(id, tab);
    renderTab(tab);
    return id;
}

/**
 * Close tab
 * @param {string} tabId
 * @param {boolean} force - Close without save prompt
 */
function closeTab(tabId, force = false) {
    const tab = tabs.get(tabId);
    if (!tab) return;

    if (!force && tab.modified) {
        // Show save prompt
        if (!confirm(`Save changes to ${tab.title}?`)) {
            return;
        }
    }

    // Remove from DOM
    const tabEl = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabEl) tabEl.remove();

    // Remove from state
    tabs.delete(tabId);

    // Switch to another tab if this was active
    if (activeTabId === tabId) {
        const remaining = Array.from(tabs.keys());
        if (remaining.length > 0) {
            switchToTab(remaining[remaining.length - 1]);
        } else {
            activeTabId = null;
        }
    }
}

/**
 * Switch to tab
 * @param {string} tabId
 */
function switchToTab(tabId) {
    const tab = tabs.get(tabId);
    if (!tab) return;

    // Save current view state
    if (activeTabId) {
        const currentTab = tabs.get(activeTabId);
        if (currentTab && window.App?.editor) {
            currentTab.content = window.App.editor.getValue();
            currentTab.viewState = window.App.editor.saveViewState();
        }
    }

    // Update UI
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    const tabEl = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabEl) tabEl.classList.add('active');

    activeTabId = tabId;

    // Load content into editor
    if (window.App?.editor) {
        window.App.editor.setValue(tab.content);
        if (tab.viewState) {
            window.App.editor.restoreViewState(tab.viewState);
        }
    }
}

/**
 * Mark tab as modified
 * @param {string} tabId
 * @param {boolean} modified
 */
function setTabModified(tabId, modified) {
    const tab = tabs.get(tabId);
    if (!tab) return;

    tab.modified = modified;
    const tabEl = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (tabEl) {
        tabEl.classList.toggle('modified', modified);
    }
}

/**
 * Update tab path and title
 * @param {string} tabId
 * @param {string} path
 */
function updateTabPath(tabId, path) {
    const tab = tabs.get(tabId);
    if (!tab) return;

    tab.path = path;
    tab.title = path.split(/[\\/]/).pop();

    const tabEl = document.querySelector(`[data-tab-id="${tabId}"] .tab-name`);
    if (tabEl) tabEl.textContent = tab.title;
}

/**
 * Get tab info
 * @param {string} tabId
 * @returns {TabInfo|undefined}
 */
function getTab(tabId) {
    return tabs.get(tabId);
}

/**
 * Get active tab
 * @returns {TabInfo|undefined}
 */
function getActiveTab() {
    return activeTabId ? tabs.get(activeTabId) : undefined;
}

/**
 * Get all tabs
 * @returns {TabInfo[]}
 */
function getAllTabs() {
    return Array.from(tabs.values());
}

/**
 * Render tab element
 * @param {TabInfo} tab
 */
function renderTab(tab) {
    const tabsContainer = document.getElementById('tabs-container');
    if (!tabsContainer) return;

    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.dataset.tabId = tab.id;
    tabEl.innerHTML = `
        <span class="tab-name">${tab.title}</span>
        <span class="tab-close">×</span>
    `;

    tabEl.addEventListener('click', () => switchToTab(tab.id));
    tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tab.id);
    });

    tabsContainer.appendChild(tabEl);
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createTab,
        closeTab,
        switchToTab,
        setTabModified,
        updateTabPath,
        getTab,
        getActiveTab,
        getAllTabs
    };
}

if (typeof window !== 'undefined') {
    window.TabManager = {
        createTab,
        closeTab,
        switchToTab,
        setTabModified,
        updateTabPath,
        getTab,
        getActiveTab,
        getAllTabs
    };
}
