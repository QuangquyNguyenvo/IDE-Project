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

    builtinThemeIds: [
        'kawaii-dark',
        'kawaii-light',
        'sakura',
        'dracula',
        'monokai',
        'nord'
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
        const promises = this.builtinThemeIds.map(async (themeId) => {
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
                console.warn(`[ThemeManager] Failed to load JSON for ${themeId}:`, error.message);
            }
        });
        await Promise.all(promises);
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
     * Hardcoded theme definitions (fallback) - Complete CSS variable sets
     */
    _getHardcodedThemes() {
        return {
            'kawaii-dark': {
                meta: { id: 'kawaii-dark', name: 'Kawaii Dark', type: 'dark' },
                colors: {
                    appBackground: 'assets/background.jpg',
                    bgOceanLight: '#1a3a50',
                    bgOceanMedium: '#152535',
                    bgOceanDeep: '#88c9ea',
                    bgOceanDark: '#0d1a25',
                    bgGlass: 'rgba(26, 37, 48, 0.95)',
                    bgGlassHeavy: 'rgba(21, 37, 53, 0.97)',
                    bgGlassBorder: 'rgba(58, 96, 117, 0.8)',
                    accent: '#88c9ea',
                    accentHover: '#5eb7e0',
                    textPrimary: '#e0f0ff',
                    textSecondary: '#a0c0d0',
                    textMuted: '#7990a0',
                    success: '#7dcea0',
                    error: '#ff6b6b',
                    warning: '#fcd5ce',
                    border: '#3a6075',
                    borderStrong: '#88c9ea',
                    shadowSoft: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    shadowCard: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    glow: '0 0 15px rgba(136, 201, 234, 0.4)',
                    bgHeader: 'rgba(21, 37, 53, 0.97)',
                    bgPanel: 'rgba(26, 37, 48, 0.95)',
                    bgInput: '#1a2a3a',
                    bgButton: '#243040',
                    bgButtonHover: '#3a5060',
                    editorBg: '#1a2530',
                    terminalBg: '#152535',
                    settingsLabelColor: '#a0c0d0',
                    settingsSectionColor: '#88c9ea',
                    buttonTextOnAccent: '#ffffff',
                    // Button properties for custom themes
                    btnBg: 'rgba(255, 255, 255, 0.1)',
                    btnBgHover: 'rgba(255, 255, 255, 0.15)',
                    btnBorder: '#3a6075',
                    btnText: '#e0f0ff',
                    btnTextHover: '#88c9ea',
                    btnPrimaryBg: '#88c9ea',
                    btnPrimaryBgHover: '#5eb7e0',
                    btnPrimaryText: '#ffffff'
                },
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
                colors: {
                    appBackground: 'assets/background.jpg',
                    bgOceanLight: '#e8f4fc',
                    bgOceanMedium: '#d0e8f5',
                    bgOceanDeep: '#4a9bc9',
                    bgOceanDark: '#2a7ab0',
                    bgGlass: 'rgba(232, 244, 252, 0.95)',
                    bgGlassHeavy: 'rgba(208, 232, 245, 0.97)',
                    bgGlassBorder: 'rgba(74, 155, 201, 0.5)',
                    accent: '#4a9bc9',
                    accentHover: '#3a8ab8',
                    textPrimary: '#2a4a5a',
                    textSecondary: '#4a6a7a',
                    textMuted: '#7a9aaa',
                    success: '#5dbe8a',
                    error: '#e55a5a',
                    warning: '#e5a05a',
                    border: '#a0c8e0',
                    borderStrong: '#4a9bc9',
                    shadowSoft: '0 8px 32px rgba(74, 155, 201, 0.2)',
                    shadowCard: '0 4px 12px rgba(74, 155, 201, 0.15)',
                    glow: '0 0 15px rgba(74, 155, 201, 0.3)',
                    bgHeader: 'rgba(208, 232, 245, 0.97)',
                    bgPanel: 'rgba(232, 244, 252, 0.95)',
                    bgInput: '#ffffff',
                    bgButton: '#e8f4fc',
                    bgButtonHover: '#d0e8f5',
                    editorBg: '#1a2530',
                    terminalBg: '#152535',
                    settingsLabelColor: '#4a6a7a',
                    settingsSectionColor: '#4a9bc9',
                    buttonTextOnAccent: '#ffffff',
                    // Button properties
                    btnBg: '#ffffff',
                    btnBgHover: '#e8f4fc',
                    btnBorder: '#a0c8e0',
                    btnText: '#2a4a5a',
                    btnTextHover: '#4a9bc9',
                    btnPrimaryBg: '#4a9bc9',
                    btnPrimaryBgHover: '#3a8ab8',
                    btnPrimaryText: '#ffffff'
                },
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
            'sakura': {
                meta: { id: 'sakura', name: 'Sakura', type: 'light' },
                colors: {
                    appBackground: 'assets/pink.gif',
                    bgOceanLight: '#fff5f8',
                    bgOceanMedium: '#ffe4e1',
                    bgOceanDeep: '#ffb7c5',
                    bgOceanDark: '#e097a8',
                    bgGlass: 'rgba(255, 245, 250, 0.92)',
                    bgGlassHeavy: 'rgba(255, 228, 225, 0.97)',
                    bgGlassBorder: 'rgba(255, 182, 193, 0.6)',
                    accent: '#ff9aaf',
                    accentHover: '#ff758f',
                    textPrimary: '#5d4a4d',
                    textSecondary: '#8b5f65',
                    textMuted: '#bc8f8f',
                    success: '#b8e2b8',
                    error: '#ffb3b3',
                    warning: '#fff9c4',
                    border: '#ffcad4',
                    borderStrong: '#ffb7c5',
                    shadowSoft: '0 8px 32px rgba(255, 182, 193, 0.25)',
                    shadowCard: '0 4px 12px rgba(255, 105, 180, 0.15)',
                    glow: '0 0 15px rgba(255, 182, 193, 0.4)',
                    bgHeader: 'rgba(255, 228, 225, 0.97)',
                    bgPanel: 'rgba(255, 245, 248, 0.95)',
                    bgInput: '#fffafa',
                    bgButton: '#fff0f5',
                    bgButtonHover: '#ffe4e1',
                    editorBg: '#2d1f2f',
                    terminalBg: '#251a26',
                    settingsLabelColor: '#8b5f65',
                    settingsSectionColor: '#ff9aaf',
                    buttonTextOnAccent: '#ffffff',
                    // Button properties
                    btnBg: '#fff0f5',
                    btnBgHover: '#ffe4e1',
                    btnBorder: '#ffcad4',
                    btnText: '#5d4a4d',
                    btnTextHover: '#ff9aaf',
                    btnPrimaryBg: '#ff9aaf',
                    btnPrimaryBgHover: '#ff758f',
                    btnPrimaryText: '#ffffff'
                },
                editor: {
                    base: 'vs-dark', inherit: true,
                    background: '#2d1f2f', foreground: '#f8e8f0',
                    lineHighlight: '#3d2a3f',
                    selection: '#5d3a5f',
                    cursor: '#ff69b4',
                    lineNumber: '#6d5060',
                    lineNumberActive: '#ff69b4',
                    syntax: {
                        comment: { color: '8b7080', fontStyle: 'italic' },
                        keyword: { color: 'ff69b4' },
                        string: { color: '98d998' },
                        number: { color: 'da75e3' },
                        type: { color: 'ffb7c5', fontStyle: 'italic' },
                        function: { color: 'ffb07a' },
                        variable: { color: 'f8e8f0' },
                        operator: { color: 'ff69b4' }
                    }
                }
            },
            'dracula': {
                meta: { id: 'dracula', name: 'Dracula', type: 'dark' },
                colors: {
                    bgOceanLight: '#44475a',
                    bgOceanMedium: '#383a59',
                    bgOceanDeep: '#bd93f9',
                    bgOceanDark: '#21222c',
                    bgGlass: 'rgba(40, 42, 54, 0.95)',
                    bgGlassHeavy: 'rgba(33, 34, 44, 0.97)',
                    bgGlassBorder: 'rgba(68, 71, 90, 0.9)',
                    accent: '#ff79c6',
                    accentHover: '#ff92d0',
                    textPrimary: '#f8f8f2',
                    textSecondary: '#bd93f9',
                    textMuted: '#6272a4',
                    success: '#50fa7b',
                    error: '#ff5555',
                    warning: '#ffb86c',
                    border: '#6272a4',
                    borderStrong: '#bd93f9',
                    shadowSoft: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    shadowCard: '0 4px 12px rgba(0, 0, 0, 0.4)',
                    glow: '0 0 15px rgba(189, 147, 249, 0.4)',
                    bgHeader: 'rgba(33, 34, 44, 0.97)',
                    bgPanel: 'rgba(40, 42, 54, 0.95)',
                    bgInput: '#282a36',
                    bgButton: '#44475a',
                    bgButtonHover: '#6272a4',
                    editorBg: '#282a36',
                    terminalBg: '#21222c',
                    settingsLabelColor: '#f8f8f2',
                    settingsSectionColor: '#bd93f9',
                    buttonTextOnAccent: '#ffffff',
                    // Button properties
                    btnBg: 'rgba(255, 255, 255, 0.1)',
                    btnBgHover: 'rgba(255, 255, 255, 0.15)',
                    btnBorder: '#6272a4',
                    btnText: '#f8f8f2',
                    btnTextHover: '#ff79c6',
                    btnPrimaryBg: '#ff79c6',
                    btnPrimaryBgHover: '#ff92d0',
                    btnPrimaryText: '#ffffff'
                },
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
                colors: {
                    bgOceanLight: '#3e3d32',
                    bgOceanMedium: '#272822',
                    bgOceanDeep: '#a6e22e',
                    bgOceanDark: '#1e1f1c',
                    bgGlass: 'rgba(39, 40, 34, 0.95)',
                    bgGlassHeavy: 'rgba(30, 31, 28, 0.97)',
                    bgGlassBorder: 'rgba(62, 61, 50, 0.9)',
                    accent: '#a6e22e',
                    accentHover: '#b8f32e',
                    textPrimary: '#f8f8f2',
                    textSecondary: '#a6e22e',
                    textMuted: '#75715e',
                    success: '#a6e22e',
                    error: '#f92672',
                    warning: '#e6db74',
                    border: '#49483e',
                    borderStrong: '#a6e22e',
                    shadowSoft: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    shadowCard: '0 4px 12px rgba(0, 0, 0, 0.4)',
                    glow: '0 0 15px rgba(166, 226, 46, 0.4)',
                    bgHeader: 'rgba(30, 31, 28, 0.97)',
                    bgPanel: 'rgba(39, 40, 34, 0.95)',
                    bgInput: '#272822',
                    bgButton: '#3e3d32',
                    bgButtonHover: '#49483e',
                    editorBg: '#272822',
                    terminalBg: '#1e1f1c',
                    settingsLabelColor: '#f8f8f2',
                    settingsSectionColor: '#a6e22e',
                    buttonTextOnAccent: '#272822',
                    // Button properties
                    btnBg: 'rgba(255, 255, 255, 0.08)',
                    btnBgHover: 'rgba(255, 255, 255, 0.12)',
                    btnBorder: '#49483e',
                    btnText: '#f8f8f2',
                    btnTextHover: '#a6e22e',
                    btnPrimaryBg: '#a6e22e',
                    btnPrimaryBgHover: '#b8f32e',
                    btnPrimaryText: '#272822'
                },
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
                colors: {
                    bgOceanLight: '#3b4252',
                    bgOceanMedium: '#2e3440',
                    bgOceanDeep: '#88c0d0',
                    bgOceanDark: '#242933',
                    bgGlass: 'rgba(46, 52, 64, 0.95)',
                    bgGlassHeavy: 'rgba(36, 41, 51, 0.97)',
                    bgGlassBorder: 'rgba(59, 66, 82, 0.9)',
                    accent: '#88c0d0',
                    accentHover: '#8fbcbb',
                    textPrimary: '#eceff4',
                    textSecondary: '#d8dee9',
                    textMuted: '#616e88',
                    success: '#a3be8c',
                    error: '#bf616a',
                    warning: '#ebcb8b',
                    border: '#4c566a',
                    borderStrong: '#88c0d0',
                    shadowSoft: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    shadowCard: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    glow: '0 0 15px rgba(136, 192, 208, 0.3)',
                    bgHeader: 'rgba(36, 41, 51, 0.97)',
                    bgPanel: 'rgba(46, 52, 64, 0.95)',
                    bgInput: '#2e3440',
                    bgButton: '#3b4252',
                    bgButtonHover: '#4c566a',
                    editorBg: '#2e3440',
                    terminalBg: '#242933',
                    settingsLabelColor: '#d8dee9',
                    settingsSectionColor: '#88c0d0',
                    buttonTextOnAccent: '#2e3440',
                    // Button properties
                    btnBg: 'rgba(255, 255, 255, 0.08)',
                    btnBgHover: 'rgba(255, 255, 255, 0.12)',
                    btnBorder: '#4c566a',
                    btnText: '#eceff4',
                    btnTextHover: '#88c0d0',
                    btnPrimaryBg: '#88c0d0',
                    btnPrimaryBgHover: '#8fbcbb',
                    btnPrimaryText: '#2e3440'
                },
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

        // If this is the active theme, re-apply it to update UI colors (e.g. after background JSON load)
        if (id === this.activeThemeId) {
            this.setTheme(id);
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

                // Update all existing editor instances
                if (typeof App !== 'undefined' && App.editors) {
                    Object.values(App.editors).forEach(editor => {
                        if (editor && editor.updateOptions) {
                            editor.updateOptions({ theme: themeId });
                        }
                    });
                }

                // Update template editor if exists
                if (typeof templateEditor !== 'undefined' && templateEditor) {
                    templateEditor.updateOptions({ theme: themeId });
                }
            } catch (e) {
                console.warn('[ThemeManager] Monaco theme not ready:', e);
            }
        }
    },

    /**
     * Apply CSS variables from theme colors
     */
    _applyCSSVariables(theme) {
        const root = document.documentElement;

        // Map JSON keys to CSS variable names
        const varMappings = {
            // Simplified Group Base Keys
            'bgBase': '--bg-base',
            'bgSurface': '--bg-surface',

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

            // Component Layer - Header Variants (NEW: fixes scope leakage)
            'bgHeader-main': '--bg-header-main',
            'bgHeader-statusbar': '--bg-header-statusbar',

            // Component Layer - Panel Variants (NEW: fixes scope leakage)
            'bgPanel-problems': '--bg-panel-problems',
            'bgPanel-input': '--bg-panel-input',
            'bgPanel-expected': '--bg-panel-expected',

            'editorBg': '--editor-bg',
            'editorBackground': '--editor-bg-image',
            'appBackground': '--app-bg-image',
            'bgPosition': '--app-bg-position',
            'editorBgPosition': '--editor-bg-position',
            'bgOpacity': '--app-bg-opacity',
            'bgBlur': '--app-bg-blur',
            'editorBgOpacity': '--editor-bg-opacity',
            'editorBgBlur': '--editor-bg-blur',
            'terminalBg': '--terminal-bg',
            'terminalBgBlur': '--terminal-bg-blur',
            'settingsLabelColor': '--settings-label-color',
            'settingsSectionColor': '--settings-section-color',
            'buttonTextOnAccent': '--button-text-on-accent',

            // Button CSS Variables
            'btnBg': '--btn-bg',
            'btnBgHover': '--btn-bg-hover',
            'btnBorder': '--btn-border',
            'btnText': '--btn-text',
            'btnTextHover': '--btn-text-hover',
            'btnPrimaryBg': '--btn-primary-bg',
            'btnPrimaryBgHover': '--btn-primary-bg-hover',
            'btnPrimaryText': '--btn-primary-text',
            'btnSuccessBg': '--btn-success-bg',
            'btnSuccessText': '--btn-success-text',
            'btnErrorBg': '--btn-error-bg',
            'btnErrorText': '--btn-error-text',

            // Opacity variables
            'terminalOpacity': '--terminal-opacity',
            'panelOpacity': '--panel-opacity'
        };

        // 1. First clear all existing theme variables from root style
        Object.values(varMappings).forEach(cssVar => {
            root.style.removeProperty(cssVar);
        });

        // 2. Apply current theme variables
        const colors = theme.colors || {};
        Object.entries(colors).forEach(([key, value]) => {
            const cssVar = varMappings[key];
            if (cssVar && value !== undefined && value !== null) {
                // Wrap image values in url() for background-image properties
                if (key === 'editorBackground' || key === 'appBackground') {
                    // Check if it's already wrapped in url() or is none/empty
                    if (value && value !== 'none' && !value.startsWith('url(')) {
                        // For data URLs, use double quotes to avoid escaping issues
                        // For file paths, escape single quotes
                        if (value.startsWith('data:')) {
                            // Data URLs can contain special characters, use double quotes
                            root.style.setProperty(cssVar, `url("${value}")`);
                        } else {
                            // File paths - escape single quotes
                            const escapedValue = value.replace(/'/g, "\\'");
                            root.style.setProperty(cssVar, `url('${escapedValue}')`);
                        }
                    } else {
                        root.style.setProperty(cssVar, value || 'none');
                    }
                } else if (key === 'bgOpacity' || key === 'editorBgOpacity' ||
                    key === 'terminalOpacity' || key === 'panelOpacity') {
                    // Convert percentage to decimal for opacity (70 → 0.7)
                    root.style.setProperty(cssVar, (parseFloat(value) / 100).toString());
                } else if (key === 'bgBlur' || key === 'editorBgBlur' || key === 'terminalBgBlur') {
                    // Add px unit for blur values
                    root.style.setProperty(cssVar, `${parseInt(value)}px`);
                } else if (key === 'bgPosition' || key === 'editorBgPosition') {
                    // Set background position directly
                    root.style.setProperty(cssVar, value || 'center center');
                } else {
                    root.style.setProperty(cssVar, value);
                }
            }
        });

        // 3. Apply inheritance for variant colors
        // If variant not explicitly set, inherit from parent
        this._applyInheritance(root, colors, 'bgHeader-main', 'bgHeader', '--bg-header-main');
        this._applyInheritance(root, colors, 'bgHeader-statusbar', 'bgHeader', '--bg-header-statusbar');
        this._applyInheritance(root, colors, 'bgPanel-problems', 'bgPanel', '--bg-panel-problems');
        this._applyInheritance(root, colors, 'bgPanel-input', 'bgPanel', '--bg-panel-input');
        this._applyInheritance(root, colors, 'bgPanel-expected', 'bgPanel', '--bg-panel-expected');
    },

    /**
     * Apply inheritance: if child not set, use parent value
     * This ensures variant CSS variables always have a value
     * @private
     */
    _applyInheritance(root, colors, childKey, parentKey, cssVar) {
        // Check if child already has explicit value
        const hasChild = colors[childKey] !== undefined && colors[childKey] !== null;
        if (!hasChild && colors[parentKey]) {
            root.style.setProperty(cssVar, colors[parentKey]);
        }
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
