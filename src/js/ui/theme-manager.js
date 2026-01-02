/**
 * C++ IDE - Theme Manager (v2.0)
 * 
 * JSON-based theme system with Import/Export support.
 * Handles theme registration, application, and CSS/Monaco synchronization.
 * 
 * @author Sameko Team
 */

const ThemeManager = {
    // Registry of all loaded themes
    themes: new Map(),

    // Current active theme ID
    activeThemeId: null,

    // User customization overrides
    userOverrides: {},

    // Path to builtin themes (relative to app root)
    builtinThemesPath: 'src/themes/builtin',

    // Builtin theme IDs (loaded at startup)
    builtinThemeIds: [
        'kawaii-dark',
        'kawaii-light',
        'dracula',
        'monokai',
        'nord',
        'one-dark'
    ],

    /**
     * Initialize Theme Manager
     */
    async init() {
        console.log('[ThemeManager] Initializing v2.0...');

        // Load hardcoded themes IMMEDIATELY (no lag)
        this._loadAllHardcodedThemes();
        this.loadUserThemes();
        console.log(`[ThemeManager] Loaded ${this.themes.size} themes (hardcoded)`);

        // Then async load JSON versions in background (optional enhancement)
        this._loadJSONThemesInBackground();
    },

    /**
     * Load all hardcoded themes immediately
     */
    _loadAllHardcodedThemes() {
        const hardcoded = this._getHardcodedThemes();
        for (const themeId of this.builtinThemeIds) {
            if (hardcoded[themeId]) {
                this.registerTheme(hardcoded[themeId]);
            }
        }
    },

    /**
     * Load JSON themes in background (non-blocking)
     */
    _loadJSONThemesInBackground() {
        // Don't await - let it run in background
        this._loadBuiltinThemesAsync().catch(e => {
            console.warn('[ThemeManager] Background JSON load failed:', e.message);
        });
    },

    /**
     * Load builtin themes from JSON files (async, non-blocking)
     */
    async _loadBuiltinThemesAsync() {
        for (const themeId of this.builtinThemeIds) {
            try {
                const themePath = `${this.builtinThemesPath}/${themeId}.json`;
                const response = await fetch(themePath);
                if (response.ok) {
                    const themeData = await response.json();
                    // Update the theme with full JSON data
                    this.registerTheme(themeData);
                }
            } catch (error) {
                // Silent fail - hardcoded version already loaded
            }
        }
    },


    /**
     * Fallback: Load hardcoded theme definition
     */
    _loadHardcodedTheme(themeId) {
        const hardcodedThemes = this._getHardcodedThemes();
        if (hardcodedThemes[themeId]) {
            this.registerTheme(hardcodedThemes[themeId]);
        }
    },

    /**
     * Hardcoded theme definitions (fallback)
     */
    _getHardcodedThemes() {
        return {
            'kawaii-dark': {
                meta: { id: 'kawaii-dark', name: 'Kawaii Dark', type: 'dark' },
                colors: {},
                editor: {
                    base: 'vs-dark', inherit: true,
                    background: '#1a2530', foreground: '#e0f0ff',
                    syntax: {
                        comment: { color: '6a8a9a', fontStyle: 'italic' },
                        keyword: { color: '88c9ea' },
                        string: { color: 'a3d9a5' },
                        number: { color: 'ebcb8b' },
                        type: { color: 'e8a8b8' },
                        function: { color: '7ec8e3' }
                    }
                }
            },
            'kawaii-light': {
                meta: { id: 'kawaii-light', name: 'Kawaii Light', type: 'light' },
                colors: {},
                editor: {
                    base: 'vs-dark', inherit: true,
                    background: '#1a2530', foreground: '#e0f0ff',
                    syntax: {
                        comment: { color: '6a8a9a', fontStyle: 'italic' },
                        keyword: { color: '88c9ea' },
                        string: { color: 'a3d9a5' },
                        number: { color: 'ebcb8b' },
                        type: { color: 'e8a8b8' },
                        function: { color: '7ec8e3' }
                    }
                }
            },
            'dracula': {
                meta: { id: 'dracula', name: 'Dracula', type: 'dark' },
                colors: {},
                editor: {
                    base: 'vs-dark', inherit: true,
                    background: '#282a36', foreground: '#f8f8f2',
                    syntax: {
                        comment: { color: '6272a4', fontStyle: 'italic' },
                        keyword: { color: 'ff79c6' },
                        string: { color: 'f1fa8c' },
                        number: { color: 'bd93f9' },
                        type: { color: '8be9fd', fontStyle: 'italic' },
                        function: { color: '50fa7b' }
                    }
                }
            },
            'monokai': {
                meta: { id: 'monokai', name: 'Monokai', type: 'dark' },
                colors: {},
                editor: {
                    base: 'vs-dark', inherit: true,
                    background: '#272822', foreground: '#f8f8f2',
                    syntax: {
                        comment: { color: '75715e', fontStyle: 'italic' },
                        keyword: { color: 'f92672' },
                        string: { color: 'e6db74' },
                        number: { color: 'ae81ff' },
                        type: { color: '66d9ef', fontStyle: 'italic' },
                        function: { color: 'a6e22e' }
                    }
                }
            },
            'nord': {
                meta: { id: 'nord', name: 'Nord', type: 'dark' },
                colors: {},
                editor: {
                    base: 'vs-dark', inherit: true,
                    background: '#2e3440', foreground: '#eceff4',
                    syntax: {
                        comment: { color: '616e88', fontStyle: 'italic' },
                        keyword: { color: '81a1c1' },
                        string: { color: 'a3be8c' },
                        number: { color: 'b48ead' },
                        type: { color: '8fbcbb' },
                        function: { color: '88c0d0' }
                    }
                }
            },
            'one-dark': {
                meta: { id: 'one-dark', name: 'One Dark Pro', type: 'dark' },
                colors: {},
                editor: {
                    base: 'vs-dark', inherit: true,
                    background: '#282c34', foreground: '#abb2bf',
                    syntax: {
                        comment: { color: '5c6370', fontStyle: 'italic' },
                        keyword: { color: 'c678dd' },
                        string: { color: '98c379' },
                        number: { color: 'd19a66' },
                        type: { color: 'e5c07b' },
                        function: { color: '61afef' }
                    }
                }
            }
        };
    },

    /**
     * Load user-created themes from storage
     */
    loadUserThemes() {
        try {
            const stored = localStorage.getItem('sameko-user-themes');
            if (stored) {
                const userThemes = JSON.parse(stored);
                userThemes.forEach(theme => this.registerTheme(theme));
            }
        } catch (e) {
            console.warn('[ThemeManager] Failed to load user themes:', e);
        }
    },

    /**
     * Save user themes to storage
     */
    _saveUserThemes() {
        const userThemes = [];
        this.themes.forEach((theme, id) => {
            if (!this.builtinThemeIds.includes(id)) {
                userThemes.push(theme);
            }
        });
        localStorage.setItem('sameko-user-themes', JSON.stringify(userThemes));
    },

    /**
     * Register a theme from JSON object
     * @param {Object} themeData - Theme JSON object
     */
    registerTheme(themeData) {
        const id = themeData.meta?.id || themeData.id;
        if (!id) {
            console.error('[ThemeManager] Theme must have an id');
            return false;
        }

        // Normalize the theme structure
        const normalizedTheme = this._normalizeTheme(themeData);

        // Store in registry
        this.themes.set(id, normalizedTheme);

        // Define Monaco theme
        if (typeof monaco !== 'undefined') {
            this._defineMonacoTheme(normalizedTheme);
        }

        return true;
    },

    /**
     * Normalize theme structure for consistent access
     */
    _normalizeTheme(themeData) {
        return {
            id: themeData.meta?.id || themeData.id,
            name: themeData.meta?.name || themeData.name || 'Unnamed Theme',
            type: themeData.meta?.type || themeData.type || 'dark',
            author: themeData.meta?.author || 'Unknown',
            version: themeData.meta?.version || '1.0.0',
            description: themeData.meta?.description || '',
            tags: themeData.meta?.tags || [],
            colors: themeData.colors || {},
            editor: themeData.editor || {},
            terminal: themeData.terminal || {}
        };
    },

    /**
     * Define Monaco Editor theme from normalized theme data
     */
    _defineMonacoTheme(theme) {
        const editorConfig = theme.editor;
        const syntax = editorConfig.syntax || {};

        const rules = [];
        if (syntax.comment) rules.push({ token: 'comment', foreground: syntax.comment.color, fontStyle: syntax.comment.fontStyle });
        if (syntax.keyword) rules.push({ token: 'keyword', foreground: syntax.keyword.color });
        if (syntax.string) rules.push({ token: 'string', foreground: syntax.string.color });
        if (syntax.number) rules.push({ token: 'number', foreground: syntax.number.color });
        if (syntax.type) rules.push({ token: 'type', foreground: syntax.type.color, fontStyle: syntax.type.fontStyle });
        if (syntax.function) rules.push({ token: 'function', foreground: syntax.function.color });
        if (syntax.variable) rules.push({ token: 'variable', foreground: syntax.variable.color });
        if (syntax.operator) rules.push({ token: 'operator', foreground: syntax.operator.color });

        const monacoTheme = {
            base: editorConfig.base || 'vs-dark',
            inherit: editorConfig.inherit !== false,
            rules: rules,
            colors: {
                'editor.background': editorConfig.background || '#1a2530',
                'editor.foreground': editorConfig.foreground || '#e0f0ff',
                'editor.lineHighlightBackground': editorConfig.lineHighlight || '#243040',
                'editor.selectionBackground': editorConfig.selection || '#88c9ea40',
                'editorCursor.foreground': editorConfig.cursor || '#88c9ea',
                'editorLineNumber.foreground': editorConfig.lineNumber || '#4a6a7a',
                'editorLineNumber.activeForeground': editorConfig.lineNumberActive || '#88c9ea',
                'scrollbarSlider.background': editorConfig.scrollbar || '#4a6a7a50',
                'scrollbarSlider.hoverBackground': editorConfig.scrollbarHover || '#6a8a9a70',
                'scrollbarSlider.activeBackground': editorConfig.scrollbarActive || '#88c9ea80'
            }
        };

        try {
            monaco.editor.defineTheme(theme.id, monacoTheme);
        } catch (e) {
            console.error(`[ThemeManager] Failed to define Monaco theme ${theme.id}:`, e);
        }
    },

    /**
     * Apply a theme by ID
     * @param {string} themeId 
     */
    setTheme(themeId) {
        let theme = this.themes.get(themeId);

        if (!theme) {
            console.warn(`[ThemeManager] Theme '${themeId}' not found, falling back to kawaii-dark`);
            themeId = 'kawaii-dark';
            theme = this.themes.get(themeId);
        }

        if (!theme) {
            console.error('[ThemeManager] No themes available!');
            return;
        }

        console.log(`[ThemeManager] Applying theme: ${theme.name} (${themeId})`);
        this.activeThemeId = themeId;

        // 1. Set data-theme attribute for CSS
        document.documentElement.setAttribute('data-theme', themeId);

        // 2. Inject CSS variables if theme provides them
        this._applyCSSVariables(theme);

        // 3. Apply Monaco Editor theme
        if (typeof monaco !== 'undefined') {
            try {
                monaco.editor.setTheme(themeId);
            } catch (e) {
                console.warn('[ThemeManager] Monaco theme not ready');
            }
        }
    },

    /**
     * Apply CSS variables from theme colors
     */
    _applyCSSVariables(theme) {
        const colors = theme.colors;
        if (!colors || Object.keys(colors).length === 0) return;

        const root = document.documentElement;

        // Map JSON keys to CSS variable names
        const varMappings = {
            'bgOceanLight': '--bg-ocean-light',
            'bgOceanMedium': '--bg-ocean-medium',
            'bgOceanDeep': '--bg-ocean-deep',
            'bgOceanDark': '--bg-ocean-dark',
            'bgGlass': '--bg-glass',
            'bgGlassHeavy': '--bg-glass-heavy',
            'bgGlassBorder': '--bg-glass-border',
            'accent': '--accent',
            'accentHover': '--accent-hover',
            'textPrimary': '--text-primary',
            'textSecondary': '--text-secondary',
            'textMuted': '--text-muted',
            'success': '--success',
            'error': '--error',
            'warning': '--warning',
            'border': '--border',
            'borderStrong': '--border-strong',
            'shadowSoft': '--shadow-soft',
            'shadowCard': '--shadow-card',
            'glow': '--glow',
            'bgHeader': '--bg-header',
            'bgPanel': '--bg-panel',
            'bgInput': '--bg-input',
            'bgButton': '--bg-button',
            'bgButtonHover': '--bg-button-hover',
            'editorBg': '--editor-bg',
            'terminalBg': '--terminal-bg',
            'settingsLabelColor': '--settings-label-color',
            'settingsSectionColor': '--settings-section-color'
        };

        Object.entries(colors).forEach(([key, value]) => {
            const cssVar = varMappings[key];
            if (cssVar && value) {
                root.style.setProperty(cssVar, value);
            }
        });
    },

    /**
     * Get list of all available themes
     * @returns {Array} List of theme info objects
     */
    getThemeList() {
        const list = [];
        this.themes.forEach((theme, id) => {
            list.push({
                id: id,
                name: theme.name,
                type: theme.type,
                author: theme.author,
                isBuiltin: this.builtinThemeIds.includes(id)
            });
        });
        return list;
    },

    /**
     * Export theme to JSON string
     * @param {string} themeId 
     * @returns {string|null} JSON string or null if not found
     */
    exportTheme(themeId) {
        const theme = this.themes.get(themeId);
        if (!theme) return null;

        // Reconstruct full JSON structure for export
        const exportData = {
            meta: {
                id: theme.id,
                name: theme.name,
                author: theme.author,
                version: theme.version,
                description: theme.description,
                type: theme.type,
                tags: theme.tags
            },
            colors: theme.colors,
            editor: theme.editor,
            terminal: theme.terminal
        };

        return JSON.stringify(exportData, null, 2);
    },

    /**
     * Import theme from JSON string
     * @param {string} jsonString 
     * @returns {Object} Result with success and message
     */
    importTheme(jsonString) {
        try {
            const themeData = JSON.parse(jsonString);

            // Validate structure
            if (!this.validateTheme(themeData)) {
                return { success: false, message: 'Invalid theme structure' };
            }

            // Check for ID conflict with builtin themes
            const id = themeData.meta?.id;
            if (this.builtinThemeIds.includes(id)) {
                return { success: false, message: 'Cannot override builtin theme' };
            }

            // Register the theme
            this.registerTheme(themeData);
            this._saveUserThemes();

            return {
                success: true,
                message: `Theme "${themeData.meta?.name}" imported successfully`,
                themeId: id
            };
        } catch (e) {
            return { success: false, message: `Parse error: ${e.message}` };
        }
    },

    /**
     * Validate theme structure
     * @param {Object} theme 
     */
    validateTheme(theme) {
        if (!theme) return false;
        if (!theme.meta?.id && !theme.id) return false;
        if (!theme.meta?.name && !theme.name) return false;
        return true;
    },

    /**
     * Delete a user-created theme
     * @param {string} themeId 
     */
    deleteTheme(themeId) {
        if (this.builtinThemeIds.includes(themeId)) {
            return { success: false, message: 'Cannot delete builtin theme' };
        }

        if (!this.themes.has(themeId)) {
            return { success: false, message: 'Theme not found' };
        }

        this.themes.delete(themeId);
        this._saveUserThemes();

        // Switch to default if deleted theme was active
        if (this.activeThemeId === themeId) {
            this.setTheme('kawaii-dark');
        }

        return { success: true, message: 'Theme deleted' };
    },

    /**
     * Duplicate a theme for customization
     * @param {string} sourceThemeId 
     * @param {string} newName 
     */
    duplicateTheme(sourceThemeId, newName) {
        const source = this.themes.get(sourceThemeId);
        if (!source) {
            return { success: false, message: 'Source theme not found' };
        }

        const newId = newName.toLowerCase().replace(/\s+/g, '-');

        // Deep clone
        const newTheme = JSON.parse(JSON.stringify(source));
        newTheme.id = newId;
        newTheme.name = newName;
        newTheme.author = 'User';

        this.registerTheme({
            meta: {
                id: newId,
                name: newName,
                author: 'User',
                type: source.type,
                version: '1.0.0'
            },
            colors: newTheme.colors,
            editor: newTheme.editor,
            terminal: newTheme.terminal
        });

        this._saveUserThemes();

        return { success: true, themeId: newId, message: `Created "${newName}"` };
    }
};

// Make globally available
window.ThemeManager = ThemeManager;
