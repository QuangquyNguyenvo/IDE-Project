/**
 * Sameko Dev C++ IDE - Theme Manager
 * Theme loading, switching, and customization
 * 
 * @module src/features/themes/theme-manager
 */

// ============================================================================
// BUILT-IN THEMES
// ============================================================================

const BUILTIN_THEMES = {
    'kawaii-dark': {
        name: 'Kawaii Dark',
        category: 'dark',
        colors: {
            headerBg: '#2d3748',
            editorBg: '#1a202c',
            terminalBg: '#171923',
            statusBg: '#2d3748',
            text: '#e2e8f0',
            textMuted: '#a0aec0',
            accent: '#ed64a6',
            success: '#68d391',
            error: '#fc8181',
            warning: '#f6e05e'
        }
    },
    'sakura': {
        name: 'Sakura',
        category: 'dark',
        colors: {
            headerBg: '#ffb7c5',
            editorBg: '#2d1f2f',
            terminalBg: '#251a26',
            statusBg: '#ffb7c5',
            text: '#f8e8f0',
            accent: '#ffb7c5'
        }
    },
    'dracula': {
        name: 'Dracula',
        category: 'dark',
        colors: {
            headerBg: '#282a36',
            editorBg: '#282a36',
            terminalBg: '#1e1f29',
            text: '#f8f8f2',
            accent: '#bd93f9'
        }
    },
    'monokai': {
        name: 'Monokai',
        category: 'dark',
        colors: {
            headerBg: '#272822',
            editorBg: '#272822',
            text: '#f8f8f2',
            accent: '#f92672'
        }
    },
    'nord': {
        name: 'Nord',
        category: 'dark',
        colors: {
            headerBg: '#2e3440',
            editorBg: '#2e3440',
            text: '#eceff4',
            accent: '#88c0d0'
        }
    },
    'one-dark': {
        name: 'One Dark',
        category: 'dark',
        colors: {
            headerBg: '#282c34',
            editorBg: '#282c34',
            text: '#abb2bf',
            accent: '#61afef'
        }
    },
    'kawaii-light': {
        name: 'Kawaii Light',
        category: 'light',
        colors: {
            headerBg: '#c8e7f5',
            editorBg: '#ffffff',
            text: '#2d3748',
            accent: '#7fc4e8'
        }
    }
};

// ============================================================================
// THEME STATE
// ============================================================================

let currentThemeId = 'kawaii-dark';
let customThemes = new Map();

// ============================================================================
// THEME FUNCTIONS
// ============================================================================

/**
 * Get theme by ID
 * @param {string} themeId
 * @returns {Object|undefined}
 */
function getTheme(themeId) {
    return BUILTIN_THEMES[themeId] || customThemes.get(themeId);
}

/**
 * Get all available themes
 * @returns {Array}
 */
function getAllThemes() {
    const themes = [];

    for (const [id, theme] of Object.entries(BUILTIN_THEMES)) {
        themes.push({ id, ...theme, isBuiltin: true });
    }

    for (const [id, theme] of customThemes) {
        themes.push({ id, ...theme, isBuiltin: false });
    }

    return themes;
}

/**
 * Apply theme
 * @param {string} themeId
 */
function applyTheme(themeId) {
    const theme = getTheme(themeId);
    if (!theme) {
        console.warn(`Theme not found: ${themeId}`);
        return;
    }

    currentThemeId = themeId;
    document.body.dataset.theme = themeId;

    // Apply CSS variables
    const root = document.documentElement;
    if (theme.colors) {
        for (const [key, value] of Object.entries(theme.colors)) {
            root.style.setProperty(`--${kebabCase(key)}`, value);
        }
    }

    // Update Monaco theme if needed
    if (window.monaco) {
        // Map to Monaco theme name
        const monacoTheme = themeId.includes('light') ? 'vs' : 'vs-dark';
        window.monaco.editor.setTheme(monacoTheme);
    }

    console.log(`[Theme] Applied: ${theme.name}`);
}

/**
 * Get current theme ID
 * @returns {string}
 */
function getCurrentThemeId() {
    return currentThemeId;
}

/**
 * Register custom theme
 * @param {string} id
 * @param {Object} theme
 */
function registerTheme(id, theme) {
    customThemes.set(id, theme);
}

// ============================================================================
// HELPERS
// ============================================================================

function kebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BUILTIN_THEMES,
        getTheme,
        getAllThemes,
        applyTheme,
        getCurrentThemeId,
        registerTheme
    };
}

if (typeof window !== 'undefined') {
    window.ThemeManager = {
        BUILTIN_THEMES,
        getTheme,
        getAllThemes,
        applyTheme,
        getCurrentThemeId,
        registerTheme
    };
}
