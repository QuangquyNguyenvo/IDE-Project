/**
 * Theme Customizer v6.1
 * Click-to-edit live preview with background support
 * 
 * Features:
 * - Click on any element to edit its color
 * - Drag to reposition background image
 * - Full background upload/opacity/blur controls
 * - Save/Overwrite custom themes
 * 
 * @author Sameko Team
 */

const ThemeCustomizer = {
    // State
    sourceThemeId: null,
    workingTheme: null,
    popup: null,
    bgDragMode: false,
    currentColorPicker: null,
    _activeColorKey: null, // Track which color is being edited

    // History for undo/redo
    historyStack: [],
    historyIndex: -1,
    maxHistorySize: 50,

    // Performance
    _renderTimeout: null,
    _autoSaveTimeout: null,

    /**
     * Open customizer
     */
    open(themeId = null) {
        const themes = ThemeManager.getThemeList();
        if (themes.length === 0) {
            console.warn('[Customizer] No themes available');
            return;
        }

        // Get valid theme ID
        if (!themeId || !ThemeManager.themes.has(themeId)) {
            themeId = App?.settings?.appearance?.theme || themes[0].id;
        }

        this.sourceThemeId = themeId;
        this.workingTheme = this._deepClone(ThemeManager.themes.get(themeId));

        // Ensure structure
        if (!this.workingTheme.colors) this.workingTheme.colors = {};
        if (!this.workingTheme.editor) this.workingTheme.editor = { syntax: {} };

        // Initialize history stack with initial state
        this.historyStack = [this._deepClone(this.workingTheme)];
        this.historyIndex = 0;

        this._createUI();
        this._bindEvents();
        this._renderPreview();
        this._updateBgStyles(); // Force backgrounds to load immediately on open
        this._updateHistoryButtons(); // Initialize undo/redo button states

        // Show with animation
        requestAnimationFrame(() => {
            this.popup?.classList.add('visible');
        });
    },

    /**
     * Close customizer
     */
    close() {
        // Cleanup drag handlers
        this._cleanupBgDrag();

        if (this.popup) {
            this.popup.classList.remove('visible');
            setTimeout(() => {
                this.popup?.remove();
                this.popup = null;
            }, 300);
        }

        this._hideColorPicker();

        // Cleanup drag handlers
        this._cleanupBgDrag();

        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }

        if (this._renderTimeout) {
            cancelAnimationFrame(this._renderTimeout);
            this._renderTimeout = null;
        }

        this.workingTheme = null;
        this.sourceThemeId = null;
    },

    /**
     * Create the UI
     */
    _createUI() {
        document.getElementById('theme-customizer-v6')?.remove();

        this.popup = document.createElement('div');
        this.popup.id = 'theme-customizer-v6';
        this.popup.className = 'tc6-overlay';

        const isCustomTheme = this.sourceThemeId &&
            !ThemeManager.builtinThemeIds.includes(this.sourceThemeId);

        this.popup.innerHTML = `
            <div class="tc6-container">
                <div class="tc6-header">
                    <h2>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                        </svg>
                        <span>Theme Customizer</span>
                    </h2>
                    <button class="tc6-close" id="tc6-close">×</button>
                </div>
                
                <div class="tc6-body">
                    <!-- Toolbar -->
                    <div class="tc6-toolbar">
                        <button class="tc6-toolbar-btn active" data-category="ui">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                                <path d="M3 9h18M9 21V9"/>
                            </svg>
                            UI Colors
                        </button>
                        <button class="tc6-toolbar-btn" data-category="syntax">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="16 18 22 12 16 6"/>
                                <polyline points="8 6 2 12 8 18"/>
                            </svg>
                            Syntax
                        </button>
                        <button class="tc6-toolbar-btn" data-category="backgrounds">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <path d="M21 15l-5-5L5 21"/>
                            </svg>
                            Backgrounds
                        </button>
                        <button class="tc6-toolbar-btn" data-category="advanced">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
                            </svg>
                            Advanced
                        </button>
                    </div>
                    
                    <div class="tc6-main">
                        <!-- Controls Panel with Collapse -->
                        <div class="tc6-controls" id="tc6-controls">
                            <button class="tc6-controls-toggle" id="tc6-controls-toggle">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <polyline points="15 18 9 12 15 6"/>
                                </svg>
                            </button>
                            <div class="tc6-controls-content" id="tc6-controls-content"></div>
                        </div>
                        
                        <!-- Live Preview -->
                        <div class="tc6-preview">
                            <div class="tc6-edit-bar" id="tc6-edit-bar">
                                <!-- Undo/Redo - Always visible -->
                                <div class="tc6-edit-actions">
                                    <button class="tc6-edit-action" id="tc6-undo" disabled title="Undo (Ctrl+Z)">
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
                                            <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                                        </svg>
                                    </button>
                                    <button class="tc6-edit-action" id="tc6-redo" disabled title="Redo (Ctrl+Y)">
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
                                            <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
                                        </svg>
                                    </button>
                                </div>
                                
                                <!-- Divider -->
                                <div class="tc6-edit-divider"></div>
                                
                                <!-- Idle hint (shown when no element selected) -->
                                <span class="tc6-edit-hint" id="tc6-edit-hint">Click any element to edit</span>
                                
                                <!-- Active element info (hidden initially, replaces hint) -->
                                <div class="tc6-edit-element" id="tc6-edit-element" style="display: none;">
                                    <div class="tc6-edit-element-info">
                                        <span class="tc6-edit-element-name" id="tc6-edit-name">Element Name</span>
                                        <div class="tc6-edit-color-preview" id="tc6-edit-color"></div>
                                    </div>
                                    
                                    <div class="tc6-edit-properties" id="tc6-edit-properties"></div>
                                    
                                    <button class="tc6-edit-close" id="tc6-edit-close" title="Deselect">
                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div class="tc6-preview-wrapper" id="tc6-preview-wrapper"></div>
                        </div>
                    </div>
                </div>
                
                <div class="tc6-footer">
                    <div class="tc6-footer-left">
                        <button class="tc6-btn-reset" id="tc6-reset">Reset</button>
                        ${isCustomTheme ? `
                        <button class="tc6-btn-delete" id="tc6-delete">Delete Theme</button>
                        ` : ''}
                        <!-- Auto-save indicator -->
                        <span class="tc6-autosave-indicator" id="tc6-autosave" style="display: none;">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            Saved
                        </span>
                    </div>
                    <div class="tc6-footer-right">
                        <!-- Save as New - Secondary -->
                        <button class="tc6-btn-secondary" id="tc6-save-new">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Create New Theme
                        </button>
                        ${isCustomTheme ? `
                        <!-- Save & Close - Primary -->
                        <button class="tc6-btn-save" id="tc6-save">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                            </svg>
                            Save & Close
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        // Add styles
        this._injectStyles();
        document.body.appendChild(this.popup);

        // Render controls content
        this._renderControls();
    },

    /**
     * Inject CSS styles
     */
    _injectStyles() {
        if (document.getElementById('tc6-styles')) return;

        const style = document.createElement('style');
        style.id = 'tc6-styles';
        style.textContent = `
            /* ===== OVERLAY ===== */
            .tc6-overlay {
                position: fixed;
                inset: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(200, 230, 250, 0.6);
                backdrop-filter: blur(6px);
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            .tc6-overlay.visible { opacity: 1; }
            
            /* ===== CONTAINER - KAWAII STYLE ===== */
            .tc6-container {
                width: min(98vw, 1200px);
                height: min(95vh, 800px);
                background: var(--bg-panel, #e8f4fc);
                border: 3px solid var(--border-strong, #b3e2fa);
                border-radius: 24px 28px 26px 30px;
                box-shadow: 0 20px 60px rgba(136, 201, 234, 0.3);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                transform: scale(0.95) translateY(20px);
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .tc6-overlay.visible .tc6-container {
                transform: scale(1) translateY(0);
            }
            
            /* ===== HEADER - KAWAII STYLE ===== */
            .tc6-header {
                padding: 16px 24px;
                background: var(--bg-header, rgba(245, 250, 255, 0.95));
                border-bottom: 2px solid var(--border, #e0f0ff);
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            }
            .tc6-header h2 {
                font-family: 'Fredoka', sans-serif;
                font-size: 20px;
                color: var(--text-secondary, #7eb8c5);
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 0;
            }
            .tc6-header h2 svg { color: var(--accent, #88c9ea); }
            .tc6-close {
                width: 34px;
                height: 34px;
                background: var(--bg-input, #ffffff);
                border: 2px solid var(--border, #e0f0ff);
                border-radius: 50%;
                font-size: 18px;
                cursor: pointer;
                color: var(--text-muted, #8abac5);
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: Arial, sans-serif;
                line-height: 1;
            }
            .tc6-close:hover {
                background: var(--bg-ocean-light, #eff8fe);
                border-color: var(--error, #ff8fab);
                color: var(--error, #ff8fab);
                transform: rotate(90deg);
            }
            
            /* ===== BODY ===== */
            .tc6-body {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                background: var(--bg-panel, #e8f4fc);
            }
            
            /* ===== TOOLBAR ===== */
            .tc6-toolbar {
                display: flex;
                gap: 6px;
                padding: 10px 16px;
                background: var(--bg-input, #ffffff);
                border-bottom: 2px solid var(--border, #e0f0ff);
                overflow-x: auto;
                flex-shrink: 0;
            }
            .tc6-toolbar::-webkit-scrollbar { height: 0; }
            
            .tc6-toolbar-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 14px;
                background: transparent;
                border: 2px solid var(--border, #e0f0ff);
                border-radius: 12px 14px 13px 15px;
                color: var(--text-secondary, #7eb8c5);
                font-size: 12px;
                font-weight: 700;
                font-family: 'Fredoka', sans-serif;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
                flex-shrink: 0;
            }
            .tc6-toolbar-btn svg {
                width: 16px;
                height: 16px;
                stroke-width: 2.5;
            }
            .tc6-toolbar-btn:hover {
                background: var(--bg-ocean-light, #eff8fe);
                border-color: var(--border-strong, #b3e2fa);
                transform: translateY(-1px);
            }
            .tc6-toolbar-btn.active {
                background: var(--bg-ocean-medium, #bce2f5);
                border-color: var(--bg-ocean-deep, #88c9ea);
                color: var(--text-primary, #2a5a75);
                box-shadow: 0 2px 6px rgba(136, 201, 234, 0.2);
            }
            .tc6-toolbar-btn.active svg {
                color: var(--bg-ocean-dark, #3a7ca5);
            }
            
            /* ===== MAIN CONTENT ===== */
            .tc6-main {
                flex: 1;
                display: flex;
                gap: 16px;
                padding: 16px 20px;
                overflow: hidden;
            }
            
            /* ===== CONTROLS PANEL ===== */
            .tc6-controls {
                width: 320px;
                flex-shrink: 0;
                background: var(--bg-input, #ffffff);
                border-right: 2px solid var(--border, #e0f0ff);
                display: flex;
                overflow: hidden;
                position: relative;
                transition: width 0.3s ease;
            }
            .tc6-controls.collapsed {
                width: 44px;
            }
            .tc6-controls.collapsed .tc6-controls-content {
                opacity: 0;
                pointer-events: none;
            }
            
            .tc6-controls-toggle {
                position: absolute;
                top: 12px;
                right: 8px;
                z-index: 10;
                width: 28px;
                height: 28px;
                background: var(--bg-panel, #e8f4fc);
                border: 2px solid var(--border, #e0f0ff);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                color: var(--text-secondary, #7eb8c5);
            }
            .tc6-controls-toggle:hover {
                background: var(--bg-ocean-light, #eff8fe);
                border-color: var(--accent, #88c9ea);
                transform: scale(1.1);
            }
            .tc6-controls.collapsed .tc6-controls-toggle {
                left: 8px;
                right: auto;
            }
            .tc6-controls.collapsed .tc6-controls-toggle svg {
                transform: rotate(180deg);
            }
            
            .tc6-controls-content {
                flex: 1;
                overflow-y: auto;
                padding: 48px 16px 16px 16px;
                transition: opacity 0.3s ease;
            }
            .tc6-controls-content::-webkit-scrollbar { width: 6px; }
            .tc6-controls-content::-webkit-scrollbar-track { background: transparent; }
            .tc6-controls-content::-webkit-scrollbar-thumb {
                background: var(--border, #e0f0ff);
                border-radius: 10px;
            }
            .tc6-controls-content::-webkit-scrollbar-thumb:hover {
                background: var(--border-strong, #b3e2fa);
            }
            
            .tc6-category-panel {
                display: none;
            }
            .tc6-category-panel.active {
                display: block;
            }
            
            .tc6-section {
                margin-bottom: 20px;
            }
            .tc6-section:last-child { margin-bottom: 0; }
            
            .tc6-section-title {
                font-size: 11px;
                font-weight: 700;
                color: var(--settings-section-color, #5a9fc8);
                text-transform: uppercase;
                letter-spacing: 0.8px;
                margin-bottom: 10px;
                padding-bottom: 6px;
                border-bottom: 2px solid var(--border, #e0f0ff);
            }
            
            .tc6-color-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 8px;
            }
            
            .tc6-color-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 12px;
                background: var(--bg-panel, #e8f4fc);
                border: 2px solid var(--border, #e0f0ff);
                border-radius: 10px 12px 11px 13px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .tc6-color-item:hover {
                background: var(--bg-ocean-light, #eff8fe);
                border-color: var(--border-strong, #b3e2fa);
                transform: translateX(3px);
            }
            .tc6-color-item label {
                font-size: 11px;
                font-weight: 600;
                color: var(--settings-label-color, #5a8a95);
                cursor: pointer;
            }
            .tc6-color-item .tc6-color-swatch {
                width: 26px;
                height: 26px;
                border-radius: 6px;
                border: 2px solid var(--border, #e0f0ff);
                flex-shrink: 0;
                box-shadow: 0 2px 4px rgba(136, 201, 234, 0.1);
            }
            
            .tc6-field {
                margin-bottom: 14px;
            }
            .tc6-field:last-child { margin-bottom: 0; }
            
            .tc6-field-label {
                font-size: 11px;
                font-weight: 600;
                color: var(--settings-label-color, #5a8a95);
                margin-bottom: 6px;
                display: block;
            }
            
            .tc6-input {
                width: 100%;
                padding: 10px 14px;
                border-radius: 15px;
                border: 2px solid var(--border, #e0f0ff);
                background: var(--bg-panel, #e8f4fc);
                color: var(--text-primary, #2a5a75);
                font-size: 13px;
                font-family: inherit;
                transition: all 0.2s ease;
            }
            .tc6-input:focus {
                border-color: var(--accent, #88c9ea);
                outline: none;
                box-shadow: 0 0 0 2px rgba(136, 201, 234, 0.15);
            }
            
            .tc6-upload-row {
                display: flex;
                gap: 8px;
                align-items: center;
            }
            .tc6-upload-row .tc6-input {
                flex: 1;
                font-size: 11px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .tc6-upload-btn {
                padding: 10px 14px;
                border-radius: 12px;
                background: var(--bg-ocean-light, #eff8fe);
                border: 2px solid var(--bg-ocean-medium, #bce2f5);
                color: var(--text-secondary, #7eb8c5);
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
            }
            .tc6-upload-btn:hover {
                background: var(--bg-ocean-medium, #bce2f5);
            }
            
            .tc6-clear-btn {
                padding: 10px;
                border-radius: 12px;
                background: transparent;
                color: var(--text-muted, #8abac5);
                border: 2px solid var(--border, #e0f0ff);
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
            }
            .tc6-clear-btn:hover {
                color: var(--error, #ff8fab);
                border-color: var(--error, #ff8fab);
            }
            
            .tc6-slider-row {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .tc6-slider-row input[type="range"] {
                flex: 1;
                -webkit-appearance: none;
                appearance: none;
                background: var(--bg-panel, #e8f4fc);
                height: 10px;
                border-radius: 5px;
                border: 2px solid var(--border, #e0f0ff);
                cursor: pointer;
            }
            .tc6-slider-row input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 22px;
                height: 22px;
                background: var(--accent, #88c9ea);
                border-radius: 50%;
                border: 3px solid var(--bg-input, #ffffff);
                box-shadow: 2px 2px 0 rgba(136, 201, 234, 0.15);
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .tc6-slider-row input[type="range"]:hover::-webkit-slider-thumb {
                transform: scale(1.1);
            }
            .tc6-slider-val {
                min-width: 50px;
                text-align: right;
                font-size: 12px;
                color: var(--text-secondary, #7eb8c5);
                font-weight: 700;
                font-family: 'Fredoka', sans-serif;
            }
            
            /* ===== EDIT BAR - CANVA STYLE ===== */
            .tc6-edit-bar {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 16px;
                background: var(--bg-input, #ffffff);
                border-bottom: 2px solid var(--border, #e0f0ff);
                min-height: 50px;
                transition: min-height 0.3s ease;
                flex-shrink: 0;
            }
            
            .tc6-edit-actions {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
            }
            
            .tc6-edit-action {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                border: 2px solid var(--border, #e0f0ff);
                background: transparent;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-secondary, #7eb8c5);
            }
            .tc6-edit-action:hover:not(:disabled) {
                background: var(--bg-ocean-light, #eff8fe);
                border-color: var(--border-strong, #b3e2fa);
            }
            .tc6-edit-action:disabled {
                opacity: 0.3;
                cursor: not-allowed;
            }
            
            .tc6-edit-divider {
                width: 2px;
                height: 24px;
                background: var(--border, #e0f0ff);
                border-radius: 1px;
                margin: 0 6px;
                flex-shrink: 0;
            }
            
            .tc6-edit-hint {
                font-size: 11px;
                color: var(--text-muted, #8abac5);
                font-weight: 600;
            }
            
            /* Active state - Element selected (inline) */
            .tc6-edit-element {
                display: flex;
                align-items: center;
                gap: 10px;
                flex: 1;
                animation: tc6-edit-expand 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            
            @keyframes tc6-edit-expand {
                from {
                    opacity: 0;
                    transform: translateX(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            .tc6-edit-element-info {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 6px 12px;
                background: var(--bg-ocean-light, #eff8fe);
                border: 2px solid var(--border, #e0f0ff);
                border-radius: 12px 14px 13px 15px;
            }
            
            .tc6-edit-color-preview {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                border: 3px solid var(--border-strong, #b3e2fa);
                cursor: pointer;
                box-shadow: 2px 2px 0 rgba(136, 201, 234, 0.15);
                transition: transform 0.2s ease;
            }
            .tc6-edit-color-preview:hover {
                transform: scale(1.1);
            }
            
            .tc6-edit-element-name {
                font-size: 13px;
                font-weight: 700;
                color: var(--text-primary, #2a5a75);
                font-family: 'Fredoka', sans-serif;
            }
            
            .tc6-edit-properties {
                display: flex;
                gap: 6px;
            }
            
            .tc6-edit-prop-btn {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                border: 2px solid var(--border, #e0f0ff);
                background: transparent;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                color: var(--text-secondary, #7eb8c5);
                font-size: 14px;
                font-weight: 700;
            }
            .tc6-edit-prop-btn:hover {
                background: var(--bg-ocean-light, #eff8fe);
                border-color: var(--border-strong, #b3e2fa);
            }
            .tc6-edit-prop-btn.active {
                background: var(--bg-ocean-medium, #bce2f5);
                border-color: var(--bg-ocean-deep, #88c9ea);
            }
            
            /* Expanded slider (inline) */
            .tc6-edit-slider-expanded {
                flex: 1;
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 0 12px;
                animation: tc6-slider-expand 0.3s ease;
            }
            
            @keyframes tc6-slider-expand {
                from {
                    opacity: 0;
                    max-width: 0;
                }
                to {
                    opacity: 1;
                    max-width: 400px;
                }
            }
            
            .tc6-edit-slider-expanded input[type="range"] {
                flex: 1;
                -webkit-appearance: none;
                appearance: none;
                background: var(--bg-panel, #e8f4fc);
                height: 10px;
                border-radius: 5px;
                border: 2px solid var(--border, #e0f0ff);
            }
            .tc6-edit-slider-expanded input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 20px;
                height: 20px;
                background: var(--accent, #88c9ea);
                border-radius: 50%;
                border: 3px solid var(--bg-input, #ffffff);
                box-shadow: 2px 2px 0 rgba(136, 201, 234, 0.15);
                cursor: pointer;
            }
            
            .tc6-edit-slider-value {
                min-width: 50px;
                text-align: right;
                font-size: 12px;
                font-weight: 700;
                color: var(--text-secondary, #7eb8c5);
                font-family: 'Fredoka', sans-serif;
            }
            
            .tc6-edit-close {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                border: 2px solid var(--border, #e0f0ff);
                background: transparent;
                cursor: pointer;
                margin-left: auto;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-muted, #8abac5);
            }
            .tc6-edit-close:hover {
                background: var(--bg-ocean-light, #eff8fe);
                border-color: var(--error, #ff8fab);
                color: var(--error, #ff8fab);
            }
            
            /* ===== PREVIEW AREA ===== */
            .tc6-preview {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                background: var(--bg-ocean-dark, #3a7ca5);
                border: 3px solid var(--border, #e0f0ff);
                border-radius: 30px 35px 32px 38px;
                position: relative;
            }
            
            .tc6-preview-wrapper {
                flex: 1;
                margin: 12px;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                position: relative;
                transform-origin: center;
                transition: transform 0.3s ease;
            }
            
            /* Live IDE Preview */
            .tc6-ide {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                position: relative;
                background: var(--editor-bg, #1e1e1e);
            }
            
            .tc6-ide-bg {
                position: absolute;
                inset: 0;
                background-size: cover;
                background-position: center;
                pointer-events: none;
                z-index: 0;
            }
            
            .tc6-ide-content {
                position: relative;
                z-index: 1;
                flex: 1;
                display: flex;
                flex-direction: column;
                transition: opacity 0.2s ease;
            }
            
            /* Drag mode - Show UI at 80% opacity so user can see how bg looks */
            .tc6-ide-content.tc6-dimmed {
                opacity: 0.8;
                pointer-events: none;
            }
            
            /* Clickable elements */
            .tc6-clickable {
                cursor: pointer;
                position: relative;
                transition: outline 0.15s ease;
            }
            .tc6-clickable:hover {
                outline: 2px dashed var(--accent, #88c9ea);
                outline-offset: 2px;
                z-index: 100;
            }
            .tc6-clickable:hover::after {
                content: attr(data-label);
                position: absolute;
                top: -26px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--accent, #88c9ea);
                color: #fff;
                padding: 4px 10px;
                border-radius: 6px;
                font-size: 10px;
                font-weight: 600;
                white-space: nowrap;
                z-index: 1000;
                pointer-events: none;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            }
            
            .tc6-color-active {
                outline: 2px solid #ffcc00 !important;
                outline-offset: 2px !important;
                box-shadow: 0 0 12px rgba(255, 204, 0, 0.5) !important;
            }
            
            /* Editor wrapper */
            .tc6-editor-wrapper {
                position: relative;
            }
            .tc6-editor-bg {
                position: absolute;
                inset: 0;
                background-size: cover;
                background-position: center;
                pointer-events: none;
            }
            
            /* ===== FOOTER - KAWAII STYLE ===== */
            .tc6-footer {
                padding: 16px 24px;
                background: var(--bg-panel, #e8f4fc);
                border-top: 3px dashed var(--border, #e0f0ff);
                display: flex;
                justify-content: flex-end;
                align-items: center;
                gap: 12px;
                flex-shrink: 0;
            }
            
            .tc6-btn-reset {
                background: var(--bg-input, #ffffff);
                color: var(--text-muted, #8abac5);
                border: 3px solid var(--border, #e0f0ff);
                padding: 12px 24px;
                border-radius: 18px 22px 20px 24px;
                cursor: pointer;
                font-weight: 700;
                font-size: 14px;
                font-family: 'Fredoka', sans-serif;
                transition: all 0.2s ease;
            }
            .tc6-btn-reset:hover {
                background: var(--bg-ocean-light, #eff8fe);
                color: var(--error, #ff8fab);
                border-color: var(--error, #ff8fab);
            }
            
            .tc6-btn-delete {
                background: transparent;
                color: var(--error, #ff8fab);
                border: 3px solid var(--error, #ff8fab);
                padding: 12px 24px;
                border-radius: 18px 22px 20px 24px;
                cursor: pointer;
                font-weight: 700;
                font-size: 14px;
                font-family: 'Fredoka', sans-serif;
                transition: all 0.2s ease;
            }
            .tc6-btn-delete:hover {
                background: var(--error, #ff8fab);
                color: #fff;
            }
            
            .tc6-btn-save {
                background: var(--bg-ocean-medium, #bce2f5);
                border: 3px solid var(--bg-ocean-deep, #88c9ea);
                color: var(--text-primary, #2a5a75);
                padding: 12px 32px;
                border-radius: 22px 18px 20px 16px;
                font-weight: 700;
                font-size: 14px;
                font-family: 'Fredoka', sans-serif;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 4px 4px 0 rgba(136, 201, 234, 0.15);
            }
            .tc6-btn-save:hover {
                transform: translate(-2px, -2px);
                box-shadow: 6px 6px 0 rgba(136, 201, 234, 0.25);
            }
            
            .tc6-btn-save-new {
                background: var(--accent, #88c9ea);
                border: 3px solid var(--accent, #88c9ea);
                color: var(--button-text-on-accent, #ffffff);
                padding: 12px 32px;
                border-radius: 25px 20px 22px 18px;
                font-weight: 700;
                font-size: 14px;
                font-family: 'Fredoka', sans-serif;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 4px 4px 0 rgba(136, 201, 234, 0.15);
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
            }
            .tc6-btn-save-new:hover {
                transform: translate(-2px, -2px);
                box-shadow: 6px 6px 0 rgba(136, 201, 234, 0.25);
                filter: brightness(1.1);
            }
            
            /* ===== COLOR PICKER ===== */
            .tc6-color-picker {
                position: fixed;
                z-index: 100001;
                background: var(--bg-input, #ffffff);
                border: 4px solid var(--border-strong, #b3e2fa);
                border-radius: 20px 25px 22px 28px;
                box-shadow: 8px 8px 0 rgba(136, 201, 234, 0.15), 0 15px 40px rgba(136, 201, 234, 0.25);
                padding: 0;
                min-width: 320px;
                max-width: 360px;
                display: none;
                overflow: hidden;
            }
            .tc6-color-picker.visible { display: block; }
            
            .tc6-picker-header {
                padding: 12px 16px;
                background: var(--bg-panel, #e8f4fc);
                border-bottom: 3px dashed var(--border, #e0f0ff);
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .tc6-picker-title {
                font-family: 'Fredoka', sans-serif;
                font-size: 14px;
                font-weight: 700;
                color: var(--text-secondary, #7eb8c5);
            }
            .tc6-picker-close {
                background: none;
                border: none;
                font-size: 20px;
                color: var(--text-muted, #8abac5);
                cursor: pointer;
                transition: all 0.2s ease;
                line-height: 1;
                font-family: Arial, sans-serif;
            }
            .tc6-picker-close:hover {
                color: var(--error, #ff8fab);
                transform: rotate(90deg);
            }
            
            .tc6-picker-tabs {
                display: flex;
                background: var(--bg-panel, #e8f4fc);
                border-bottom: 3px dashed var(--border, #e0f0ff);
            }
            .tc6-picker-tab {
                flex: 1;
                padding: 10px 12px;
                background: transparent;
                border: none;
                color: var(--text-secondary, #7eb8c5);
                font-size: 11px;
                font-weight: 700;
                font-family: 'Fredoka', sans-serif;
                cursor: pointer;
                transition: all 0.2s;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .tc6-picker-tab:hover {
                background: var(--bg-ocean-light, #eff8fe);
            }
            .tc6-picker-tab.active {
                background: var(--bg-input, #ffffff);
                color: var(--accent, #88c9ea);
            }
            
            .tc6-picker-panel {
                display: none;
                padding: 16px;
            }
            .tc6-picker-panel.active {
                display: block;
            }
            
            .tc6-picker-section {
                margin-bottom: 14px;
            }
            .tc6-picker-section:last-child { margin-bottom: 0; }
            
            .tc6-picker-section-title {
                font-size: 10px;
                font-weight: 700;
                color: var(--settings-section-color, #5a9fc8);
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 10px;
            }
            
            .tc6-color-input-native {
                width: 100%;
                height: 50px;
                border: 3px solid var(--border, #e0f0ff);
                border-radius: 12px;
                cursor: pointer;
                margin-bottom: 12px;
            }
            .tc6-color-input-native::-webkit-color-swatch-wrapper {
                padding: 4px;
            }
            .tc6-color-input-native::-webkit-color-swatch {
                border: none;
                border-radius: 8px;
            }
            
            .tc6-hex-input {
                width: 100%;
                padding: 10px 14px;
                border-radius: 12px;
                border: 2px solid var(--border, #e0f0ff);
                background: var(--bg-panel, #e8f4fc);
                color: var(--text-primary, #2a5a75);
                font-size: 14px;
                font-family: 'JetBrains Mono', monospace;
                font-weight: 600;
                text-align: center;
                text-transform: uppercase;
                transition: all 0.2s ease;
            }
            .tc6-hex-input:focus {
                border-color: var(--accent, #88c9ea);
                outline: none;
                box-shadow: 0 0 0 2px rgba(136, 201, 234, 0.15);
            }
            
            .tc6-palette-grid {
                display: grid;
                gap: 14px;
            }
            .tc6-palette {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .tc6-palette-name {
                font-size: 11px;
                font-weight: 700;
                color: var(--text-secondary, #7eb8c5);
                font-family: 'Fredoka', sans-serif;
            }
            .tc6-palette-swatches {
                display: grid;
                grid-template-columns: repeat(8, 1fr);
                gap: 6px;
            }
            .tc6-swatch {
                aspect-ratio: 1;
                border-radius: 8px;
                border: 3px solid var(--border, #e0f0ff);
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 2px 2px 0 rgba(136, 201, 234, 0.1);
            }
            .tc6-swatch:hover {
                transform: scale(1.15) translateY(-2px);
                box-shadow: 4px 4px 0 rgba(136, 201, 234, 0.2);
                border-color: var(--border-strong, #b3e2fa);
            }
            
            .tc6-preset-grid {
                display: grid;
                grid-template-columns: repeat(8, 1fr);
                gap: 6px;
            }
            .tc6-preset-swatch {
                aspect-ratio: 1;
                border-radius: 8px;
                border: 3px solid var(--border, #e0f0ff);
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 2px 2px 0 rgba(136, 201, 234, 0.1);
            }
            .tc6-preset-swatch:hover {
                transform: scale(1.15) translateY(-2px);
                box-shadow: 4px 4px 0 rgba(136, 201, 234, 0.2);
                border-color: var(--border-strong, #b3e2fa);
            }
            
            .tc6-recent-colors {
                display: grid;
                grid-template-columns: repeat(10, 1fr);
                gap: 6px;
            }
            
            .tc6-opacity-row {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-top: 12px;
            }
            .tc6-opacity-row label {
                font-size: 11px;
                font-weight: 700;
                color: var(--text-secondary, #7eb8c5);
                min-width: 60px;
            }
            .tc6-opacity-row input[type="range"] {
                flex: 1;
                -webkit-appearance: none;
                appearance: none;
                background: var(--bg-panel, #e8f4fc);
                height: 10px;
                border-radius: 5px;
                border: 2px solid var(--border, #e0f0ff);
                cursor: pointer;
            }
            .tc6-opacity-row input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 20px;
                height: 20px;
                background: var(--accent, #88c9ea);
                border-radius: 50%;
                border: 3px solid var(--bg-input, #ffffff);
                box-shadow: 2px 2px 0 rgba(136, 201, 234, 0.15);
                cursor: pointer;
            }
            .tc6-opacity-val {
                min-width: 45px;
                text-align: right;
                font-size: 12px;
                color: var(--text-secondary, #7eb8c5);
                font-weight: 700;
                font-family: 'Fredoka', sans-serif;
            }
            
            /* ===== DRAG MODE NOTIFICATION ===== */
            .tc6-drag-confirm-btn {
                padding: 6px 14px;
                background: var(--bg-input, #ffffff);
                border: 2px solid var(--border-strong, #b3e2fa);
                border-radius: 10px 12px 11px 13px;
                color: var(--text-primary, #2a5a75);
                font-size: 12px;
                font-weight: 700;
                font-family: 'Fredoka', sans-serif;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                margin-left: 12px;
                transition: all 0.2s ease;
                box-shadow: 2px 2px 0 rgba(136, 201, 234, 0.15);
            }
            .tc6-drag-confirm-btn:hover {
                background: var(--bg-ocean-light, #eff8fe);
                transform: translateY(-1px);
                box-shadow: 3px 3px 0 rgba(136, 201, 234, 0.25);
            }
            .tc6-drag-confirm-btn svg {
                color: var(--success, #a3d9a5);
                width: 14px;
                height: 14px;
            }
            
            /* ===== COLOR DROPDOWN (FIGMA-STYLE) ===== */
            .tc6-color-dropdown {
                position: fixed;
                z-index: 100001;
                background: var(--bg-input, #ffffff);
                border: 2px solid var(--border, #e0f0ff);
                border-radius: 12px 14px 13px 15px;
                padding: 12px;
                min-width: 240px;
                box-shadow: 0 8px 24px rgba(136, 201, 234, 0.3);
                opacity: 0;
                transform: translateY(-10px) scale(0.95);
                transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .tc6-color-dropdown.visible {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            
            .tc6-dropdown-section {
                margin-bottom: 12px;
            }
            .tc6-dropdown-section:last-child {
                margin-bottom: 0;
            }
            
            .tc6-dropdown-color-native {
                width: 100%;
                height: 50px;
                border: 2px solid var(--border, #e0f0ff);
                border-radius: 10px;
                cursor: pointer;
                margin-bottom: 10px;
            }
            .tc6-dropdown-color-native::-webkit-color-swatch-wrapper {
                padding: 4px;
            }
            .tc6-dropdown-color-native::-webkit-color-swatch {
                border: none;
                border-radius: 6px;
            }
            
            .tc6-dropdown-row {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .tc6-dropdown-label {
                font-size: 11px;
                font-weight: 700;
                color: var(--text-secondary, #7eb8c5);
                min-width: 35px;
            }
            
            .tc6-dropdown-hex {
                flex: 1;
                padding: 8px 10px;
                border: 2px solid var(--border, #e0f0ff);
                border-radius: 8px;
                background: var(--bg-panel, #e8f4fc);
                color: var(--text-primary, #2a5a75);
                font-size: 12px;
                font-family: 'JetBrains Mono', monospace;
                font-weight: 600;
                transition: border-color 0.2s;
            }
            .tc6-dropdown-hex:focus {
                border-color: var(--accent, #88c9ea);
                outline: none;
            }
            
            .tc6-dropdown-section-title {
                font-size: 10px;
                font-weight: 700;
                color: var(--settings-section-color, #5a9fc8);
                text-transform: uppercase;
                letter-spacing: 0.8px;
                margin-bottom: 8px;
            }
            
            .tc6-dropdown-preset-grid {
                display: grid;
                grid-template-columns: repeat(8, 1fr);
                gap: 6px;
            }
            
            .tc6-dropdown-preset {
                width: 100%;
                aspect-ratio: 1;
                border-radius: 6px;
                border: 2px solid var(--border, #e0f0ff);
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 1px 1px 0 rgba(136, 201, 234, 0.1);
            }
            .tc6-dropdown-preset:hover {
                transform: scale(1.15);
                border-color: var(--accent, #88c9ea);
                box-shadow: 2px 2px 0 rgba(136, 201, 234, 0.2);
            }
            
            /* ===== PROPERTY POPOVER (MINI SLIDER) ===== */
            .tc6-property-popover {
                position: fixed;
                z-index: 100001;
                background: var(--bg-input, #ffffff);
                border: 2px solid var(--border, #e0f0ff);
                border-radius: 10px 12px 11px 13px;
                padding: 12px 14px;
                min-width: 200px;
                box-shadow: 0 6px 18px rgba(136, 201, 234, 0.25);
                opacity: 0;
                transform: translateY(-8px) scale(0.9);
                transition: all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .tc6-property-popover.visible {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            
            .tc6-popover-label {
                font-size: 11px;
                font-weight: 700;
                color: var(--text-secondary, #7eb8c5);
                margin-bottom: 10px;
                font-family: 'Fredoka', sans-serif;
            }
            
            .tc6-popover-slider-row {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .tc6-popover-slider {
                flex: 1;
                -webkit-appearance: none;
                appearance: none;
                background: var(--bg-panel, #e8f4fc);
                height: 8px;
                border-radius: 4px;
                border: 2px solid var(--border, #e0f0ff);
                cursor: pointer;
            }
            .tc6-popover-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 18px;
                height: 18px;
                background: var(--accent, #88c9ea);
                border-radius: 50%;
                border: 3px solid var(--bg-input, #ffffff);
                box-shadow: 1px 1px 0 rgba(136, 201, 234, 0.15);
                cursor: pointer;
                transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .tc6-popover-slider::-webkit-slider-thumb:hover {
                transform: scale(1.15);
            }
            
            .tc6-popover-value {
                min-width: 45px;
                text-align: right;
                font-size: 12px;
                font-weight: 700;
                color: var(--text-primary, #2a5a75);
                font-family: 'Fredoka', sans-serif;
            }
            
            /* ===== SAVE NOTIFICATION ===== */
            .tc6-save-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 100002;
                opacity: 0;
                transform: translateY(-20px) scale(0.9);
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                pointer-events: none;
            }
            .tc6-save-notification.visible {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            .tc6-save-notification-content {
                display: flex;
                align-items: center;
                gap: 12px;
                background: var(--bg-input, #ffffff);
                border: 4px solid var(--accent, #88c9ea);
                border-radius: 20px 25px 22px 28px;
                padding: 16px 20px;
                box-shadow: 8px 8px 0 rgba(136, 201, 234, 0.15), 0 15px 40px rgba(136, 201, 234, 0.25);
                min-width: 300px;
            }
            .tc6-save-tick {
                color: var(--success, #a3d9a5);
                flex-shrink: 0;
                animation: tc6-tick-draw 0.4s ease-out;
            }
            @keyframes tc6-tick-draw {
                0% {
                    stroke-dasharray: 0, 20;
                    stroke-dashoffset: 20;
                }
                100% {
                    stroke-dasharray: 20, 0;
                    stroke-dashoffset: 0;
                }
            }
            .tc6-save-message {
                color: var(--text-primary, #2a5a75);
                font-size: 14px;
                font-weight: 700;
                font-family: 'Fredoka', sans-serif;
                flex: 1;
            }
            
            /* ===== FOOTER LAYOUT ===== */
            .tc6-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 24px;
                background: var(--bg-input, #ffffff);
                border-top: 2px solid var(--border, #e0f0ff);
                flex-shrink: 0;
            }
            
            .tc6-footer-left {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .tc6-footer-right {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .tc6-btn-secondary {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 10px 16px;
                background: transparent;
                border: 2px solid var(--border, #e0f0ff);
                border-radius: 12px 14px 13px 15px;
                color: var(--text-secondary, #7eb8c5);
                font-size: 12px;
                font-weight: 700;
                font-family: 'Fredoka', sans-serif;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .tc6-btn-secondary:hover {
                background: var(--bg-ocean-light, #eff8fe);
                border-color: var(--border-strong, #b3e2fa);
            }
            .tc6-btn-secondary svg {
                width: 14px;
                height: 14px;
            }
            
            .tc6-autosave-indicator {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                font-weight: 600;
                color: var(--success, #a3d9a5);
                font-family: 'Fredoka', sans-serif;
                animation: tc6-fade-in 0.3s ease;
            }
            .tc6-autosave-indicator svg {
                color: var(--success, #a3d9a5);
            }
            
            @keyframes tc6-fade-in {
                from { opacity: 0; transform: translateX(-10px); }
                to { opacity: 1; transform: translateX(0); }
            }
        `;
        document.head.appendChild(style);
    },

    /**
     * Render controls panel content with category panels
     */
    _renderControls() {
        const container = this.popup?.querySelector('#tc6-controls-content');
        if (!container) return;

        const themes = ThemeManager.getThemeList();
        const c = this.workingTheme?.colors || {};
        const syn = this._getSyntaxColors();

        container.innerHTML = `
            <!-- UI Colors Panel -->
            <div class="tc6-category-panel active" data-panel="ui">
                <div class="tc6-section">
                    <div class="tc6-section-title">Theme Info</div>
                    <div class="tc6-field">
                        <label class="tc6-field-label">Name</label>
                        <input type="text" class="tc6-input" id="tc6-name" value="${this._escape(this.workingTheme?.name || '')}" placeholder="My Theme">
                    </div>
                </div>
                
                <div class="tc6-section">
                    <div class="tc6-section-title">UI Colors</div>
                    <div class="tc6-color-grid">
                        ${this._renderColorItem('bgHeader', 'Header Background')}
                        ${this._renderColorItem('bgPanel', 'Panel Background')}
                        ${this._renderColorItem('bgInput', 'Input Background')}
                        ${this._renderColorItem('accent', 'Accent Color')}
                        ${this._renderColorItem('textPrimary', 'Primary Text')}
                        ${this._renderColorItem('textSecondary', 'Secondary Text')}
                        ${this._renderColorItem('textMuted', 'Muted Text')}
                        ${this._renderColorItem('success', 'Success Color')}
                        ${this._renderColorItem('error', 'Error Color')}
                        ${this._renderColorItem('border', 'Border Color')}
                    </div>
                </div>
            </div>
            
            <!-- Syntax Colors Panel -->
            <div class="tc6-category-panel" data-panel="syntax">
                <div class="tc6-section">
                    <div class="tc6-section-title">Syntax Highlighting</div>
                    <div class="tc6-color-grid">
                        ${this._renderColorItem('syntaxKeyword', 'Keywords')}
                        ${this._renderColorItem('syntaxString', 'Strings')}
                        ${this._renderColorItem('syntaxFunction', 'Functions')}
                        ${this._renderColorItem('syntaxType', 'Types')}
                        ${this._renderColorItem('syntaxNumber', 'Numbers')}
                        ${this._renderColorItem('syntaxComment', 'Comments')}
                    </div>
                </div>
                <div class="tc6-section">
                    <div class="tc6-section-title">Editor</div>
                    <div class="tc6-color-grid">
                        ${this._renderColorItem('editorBg', 'Editor Background')}
                        ${this._renderColorItem('terminalBg', 'Terminal Background')}
                    </div>
                </div>
            </div>
            
            <!-- Backgrounds Panel -->
            <div class="tc6-category-panel" data-panel="backgrounds">
                <div class="tc6-section">
                    <div class="tc6-section-title">App Background</div>
                    <div class="tc6-field">
                        <label class="tc6-field-label">Image</label>
                        <div class="tc6-upload-row">
                            <input type="text" class="tc6-input" id="tc6-app-bg-url" value="" placeholder="Image URL or upload..." readonly>
                            <button class="tc6-bg-drag-btn" id="tc6-app-bg-drag" data-bg-type="app" title="Drag to reposition background">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3"/>
                                </svg>
                            </button>
                            <button class="tc6-upload-btn" id="tc6-app-bg-btn">Upload</button>
                            <button class="tc6-clear-btn" id="tc6-app-bg-clear">✕</button>
                            <input type="file" id="tc6-app-bg-file" accept="image/*" style="display:none">
                        </div>
                    </div>
                    <div class="tc6-field">
                        <label class="tc6-field-label">Opacity</label>
                        <div class="tc6-slider-row">
                            <input type="range" min="0" max="100" value="${c.bgOpacity ?? 50}" id="tc6-app-opacity">
                            <span class="tc6-slider-val" id="tc6-app-opacity-val">${c.bgOpacity ?? 50}%</span>
                        </div>
                    </div>
                    <div class="tc6-field">
                        <label class="tc6-field-label">Blur</label>
                        <div class="tc6-slider-row">
                            <input type="range" min="0" max="20" value="${c.bgBlur ?? 0}" id="tc6-app-blur">
                            <span class="tc6-slider-val" id="tc6-app-blur-val">${c.bgBlur ?? 0}px</span>
                        </div>
                    </div>
                </div>
                
                <div class="tc6-section">
                    <div class="tc6-section-title">Editor Background</div>
                    <div class="tc6-field">
                        <label class="tc6-field-label">Image</label>
                        <div class="tc6-upload-row">
                            <input type="text" class="tc6-input" id="tc6-editor-bg-url" value="" placeholder="Image URL or upload..." readonly>
                            <button class="tc6-bg-drag-btn" id="tc6-editor-bg-drag" data-bg-type="editor" title="Drag to reposition background">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3"/>
                                </svg>
                            </button>
                            <button class="tc6-upload-btn" id="tc6-editor-bg-btn">Upload</button>
                            <button class="tc6-clear-btn" id="tc6-editor-bg-clear">✕</button>
                            <input type="file" id="tc6-editor-bg-file" accept="image/*" style="display:none">
                        </div>
                    </div>
                    <div class="tc6-field">
                        <label class="tc6-field-label">Opacity</label>
                        <div class="tc6-slider-row">
                            <input type="range" min="0" max="100" value="${c.editorBgOpacity ?? 15}" id="tc6-editor-opacity">
                            <span class="tc6-slider-val" id="tc6-editor-opacity-val">${c.editorBgOpacity ?? 15}%</span>
                        </div>
                    </div>
                    <div class="tc6-field">
                        <label class="tc6-field-label">Blur</label>
                        <div class="tc6-slider-row">
                            <input type="range" min="0" max="30" value="${c.editorBgBlur ?? 0}" id="tc6-editor-blur">
                            <span class="tc6-slider-val" id="tc6-editor-blur-val">${c.editorBgBlur ?? 0}px</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Advanced Panel -->
            <div class="tc6-category-panel" data-panel="advanced">
                <div class="tc6-section">
                    <div class="tc6-section-title">Base Theme</div>
                    <div class="tc6-field">
                        <label class="tc6-field-label">Copy from</label>
                        <select class="tc6-input" id="tc6-base-theme" style="padding: 10px 14px;">
                            ${themes.map(t => `<option value="${t.id}" ${t.id === this.sourceThemeId ? 'selected' : ''}>${t.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                
                <div class="tc6-section">
                    <div class="tc6-section-title">Import / Export</div>
                    <button class="tc6-upload-btn" id="tc6-export-json" style="width: 100%; padding: 12px;">Export as JSON</button>
                    <div class="tc6-field" style="margin-top: 10px;">
                        <button class="tc6-upload-btn" id="tc6-import-json" style="width: 100%; padding: 12px;">Import from JSON</button>
                        <input type="file" id="tc6-import-json-file" accept=".json" style="display:none">
                    </div>
                </div>
            </div>
        `;

        this._bindControlsEvents();
        this._updateBgHints();
    },

    /**
     * Render a single color item
     */
    _renderColorItem(key, label) {
        const color = this._getColor(key);
        return `
            <div class="tc6-color-item" data-key="${key}">
                <label>${label}</label>
                <div class="tc6-color-swatch" style="background: ${color}"></div>
            </div>
        `;
    },

    /**
     * Update background hints
     */
    _updateBgHints() {
        const appBgUrl = this.popup?.querySelector('#tc6-app-bg-url');
        const editorBgUrl = this.popup?.querySelector('#tc6-editor-bg-url');

        const appBg = this.workingTheme?.colors?.appBackground;
        const editorBg = this.workingTheme?.colors?.editorBackground;

        if (appBgUrl) {
            appBgUrl.value = appBg ? (appBg.startsWith('data:') ? 'Image uploaded' : appBg.substring(0, 40)) : '';
        }
        if (editorBgUrl) {
            editorBgUrl.value = editorBg ? (editorBg.startsWith('data:') ? 'Image uploaded' : editorBg.substring(0, 40)) : '';
        }
    },

    /**
     * Bind all events
     */
    _bindEvents() {
        if (!this.popup) return;

        // Header buttons
        this.popup.querySelector('#tc6-close')?.addEventListener('click', () => this.close());
        this.popup.querySelector('#tc6-reset')?.addEventListener('click', () => this._reset());
        this.popup.querySelector('#tc6-save')?.addEventListener('click', () => this._saveOverwrite());
        this.popup.querySelector('#tc6-save-new')?.addEventListener('click', () => this._saveAsNew());
        this.popup.querySelector('#tc6-delete')?.addEventListener('click', () => this._deleteTheme());

        // Undo/Redo buttons
        this.popup.querySelector('#tc6-undo')?.addEventListener('click', () => this._undo());
        this.popup.querySelector('#tc6-redo')?.addEventListener('click', () => this._redo());

        // NOTE: Backdrop click to close removed per user request
        // User found it frustrating when dragging backgrounds
        // this.popup.addEventListener('click', (e) => {
        //     if (e.target === this.popup) this.close();
        // });

        // ESC key + Undo/Redo shortcuts
        this._escHandler = (e) => {
            if (e.key === 'Escape') {
                if (this.currentColorPicker) {
                    this._hideColorPicker();
                } else {
                    this.close();
                }
            }
            // Undo/Redo keyboard shortcuts
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this._undo();
            }
            if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                this._redo();
            }
        };
        document.addEventListener('keydown', this._escHandler);

        // Toolbar switching
        this.popup.querySelectorAll('.tc6-toolbar-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.dataset.category;
                this._switchToCategory(category);
            });
        });

        // Sidebar collapse toggle
        const toggleBtn = this.popup.querySelector('#tc6-controls-toggle');
        const controlsPanel = this.popup.querySelector('#tc6-controls');
        if (toggleBtn && controlsPanel) {
            toggleBtn.addEventListener('click', () => {
                controlsPanel.classList.toggle('collapsed');
            });
        }
    },

    /**
     * Switch to a category
     */
    _switchToCategory(category) {
        // Switch active toolbar button
        this.popup.querySelectorAll('.tc6-toolbar-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });

        // Switch active panel
        this.popup.querySelectorAll('.tc6-category-panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === category);
        });
    },

    /**
     * Bind controls panel events
     */
    _bindControlsEvents() {
        const container = this.popup?.querySelector('#tc6-controls-content');
        if (!container) return;

        // Color item clicks
        container.querySelectorAll('.tc6-color-item').forEach(item => {
            item.addEventListener('click', () => {
                const key = item.dataset.key;
                const label = item.querySelector('label')?.textContent || key;
                // Activate edit bar instead of showing old modal picker
                this._updateEditBar(key, label);
            });
        });

        // Name input
        container.querySelector('#tc6-name')?.addEventListener('input', (e) => {
            this.workingTheme.name = e.target.value;
        });

        // Base theme change
        container.querySelector('#tc6-base-theme')?.addEventListener('change', (e) => {
            const newId = e.target.value;
            if (ThemeManager.themes.has(newId)) {
                const currentName = this.workingTheme?.name;
                // Preserve editor background settings when changing base theme
                const preservedEditorBg = this.workingTheme?.colors?.editorBackground;
                const preservedEditorBgOpacity = this.workingTheme?.colors?.editorBgOpacity;
                const preservedEditorBgBlur = this.workingTheme?.colors?.editorBgBlur;
                const preservedEditorBgPosition = this.workingTheme?.colors?.editorBgPosition;

                this.sourceThemeId = newId;
                this.workingTheme = this._deepClone(ThemeManager.themes.get(newId));
                if (currentName && currentName !== this.workingTheme.name) {
                    this.workingTheme.name = currentName;
                }

                // Restore preserved editor background settings
                if (preservedEditorBg) {
                    if (!this.workingTheme.colors) this.workingTheme.colors = {};
                    this.workingTheme.colors.editorBackground = preservedEditorBg;
                    if (preservedEditorBgOpacity !== undefined) this.workingTheme.colors.editorBgOpacity = preservedEditorBgOpacity;
                    if (preservedEditorBgBlur !== undefined) this.workingTheme.colors.editorBgBlur = preservedEditorBgBlur;
                    if (preservedEditorBgPosition) this.workingTheme.colors.editorBgPosition = preservedEditorBgPosition;
                }

                this._renderControls();
                this._renderPreview();
            }
        });

        // App background upload
        const appBgBtn = container.querySelector('#tc6-app-bg-btn');
        const appBgFile = container.querySelector('#tc6-app-bg-file');
        const appBgClear = container.querySelector('#tc6-app-bg-clear');

        appBgBtn?.addEventListener('click', () => appBgFile?.click());
        appBgFile?.addEventListener('change', (e) => {
            this._handleFileUpload(e, 'appBackground');
        });
        appBgClear?.addEventListener('click', () => {
            delete this.workingTheme.colors.appBackground;
            this._updateBgHints();
            this._renderPreview();
        });

        // App background drag button
        const appBgDrag = container.querySelector('#tc6-app-bg-drag');
        appBgDrag?.addEventListener('click', () => {
            if (!this.workingTheme?.colors?.appBackground) {
                alert('Please upload an app background first!');
                return;
            }
            // Enter drag mode for app background
            this.bgDragMode = true;
            this._isDraggingEditor = false;
            this._updateDragModeHint();

            // Update UI
            const wrapper = this.popup?.querySelector('#tc6-preview-wrapper');
            if (wrapper) wrapper.style.cursor = 'grab';
            const ide = this.popup?.querySelector('.tc6-ide');
            const content = this.popup?.querySelector('.tc6-ide-content');
            if (ide) ide.classList.add('tc6-drag-mode');
            if (content) content.classList.add('tc6-dimmed');
        });

        // Editor background upload
        const editorBgBtn = container.querySelector('#tc6-editor-bg-btn');
        const editorBgFile = container.querySelector('#tc6-editor-bg-file');
        const editorBgClear = container.querySelector('#tc6-editor-bg-clear');

        editorBgBtn?.addEventListener('click', () => editorBgFile?.click());
        editorBgFile?.addEventListener('change', (e) => {
            this._handleFileUpload(e, 'editorBackground');
        });
        editorBgClear?.addEventListener('click', () => {
            delete this.workingTheme.colors.editorBackground;
            this._updateBgHints();
            this._renderPreview();
        });

        // Editor background drag button
        const editorBgDrag = container.querySelector('#tc6-editor-bg-drag');
        editorBgDrag?.addEventListener('click', () => {
            if (!this.workingTheme?.colors?.editorBackground) {
                alert('Please upload an editor background first!');
                return;
            }
            // Enter drag mode for editor background
            this.bgDragMode = true;
            this._isDraggingEditor = true;
            this._updateDragModeHint();

            // Update UI
            const wrapper = this.popup?.querySelector('#tc6-preview-wrapper');
            if (wrapper) wrapper.style.cursor = 'grab';
            const ide = this.popup?.querySelector('.tc6-ide');
            const content = this.popup?.querySelector('.tc6-ide-content');
            if (ide) ide.classList.add('tc6-drag-mode');
            if (content) content.classList.add('tc6-dimmed');
        });

        // Sliders
        this._bindSlider('#tc6-app-opacity', 'bgOpacity', '%', '#tc6-app-opacity-val');
        this._bindSlider('#tc6-app-blur', 'bgBlur', 'px', '#tc6-app-blur-val');
        this._bindSlider('#tc6-editor-opacity', 'editorBgOpacity', '%', '#tc6-editor-opacity-val');
        this._bindSlider('#tc6-editor-blur', 'editorBgBlur', 'px', '#tc6-editor-blur-val');
    },

    /**
     * Bind slider
     */
    _bindSlider(inputSel, key, suffix, valSel) {
        const input = this.popup?.querySelector(inputSel);
        const valEl = this.popup?.querySelector(valSel);

        input?.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (valEl) valEl.textContent = val + suffix;
            if (!this.workingTheme.colors) this.workingTheme.colors = {};
            this.workingTheme.colors[key] = val;
            this._updateBgStyles();
        });
    },

    /**
     * Handle file upload
     */
    _handleFileUpload(e, key) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            if (!this.workingTheme.colors) this.workingTheme.colors = {};
            this.workingTheme.colors[key] = ev.target.result;
            this._updateBgHints();
            this._renderPreview();
        };
        reader.readAsDataURL(file);
    },

    /**
     * Setup background drag
     */
    _setupBgDrag() {
        const wrapper = this.popup?.querySelector('#tc6-preview-wrapper');
        if (!wrapper) return;

        // Cleanup old handlers if exist
        if (wrapper._dragHandlers) {
            this._cleanupBgDrag();
        }

        let isDragging = false;
        let isDraggingEditor = false;
        let startX = 0, startY = 0;
        let startPosX = 50, startPosY = 50;

        // Double-click handler
        const dblClickHandler = (e) => {
            const editorBg = wrapper.querySelector('.tc6-editor-bg');
            const appBg = wrapper.querySelector('.tc6-ide-bg');
            const clickedEditor = editorBg && e.target.closest('.tc6-editor-wrapper');

            // If already in drag mode, toggle it off
            if (this.bgDragMode) {
                this._exitDragMode();
                return;
            }

            if (clickedEditor && this.workingTheme?.colors?.editorBackground) {
                // Drag editor background
                this.bgDragMode = true;
                isDraggingEditor = true;
            } else if (appBg && this.workingTheme?.colors?.appBackground) {
                // Drag app background
                this.bgDragMode = true;
                isDraggingEditor = false;
            } else {
                return;
            }

            wrapper.style.cursor = this.bgDragMode ? 'grab' : 'default';

            // Update UI to show drag mode state - dim other elements
            const ide = wrapper.querySelector('.tc6-ide');
            const content = wrapper.querySelector('.tc6-ide-content');
            if (ide) ide.classList.toggle('tc6-drag-mode', this.bgDragMode);
            if (content) content.classList.toggle('tc6-dimmed', this.bgDragMode);

            // Show/hide drag mode indicator
            this._updateDragModeHint();
        };

        // Mouse down handler
        const mouseDownHandler = (e) => {
            if (!this.bgDragMode) return;

            const editorBg = wrapper.querySelector('.tc6-editor-bg');
            const appBg = wrapper.querySelector('.tc6-ide-bg');
            const clickedEditor = editorBg && e.target.closest('.tc6-editor-wrapper');

            if (clickedEditor && this.workingTheme?.colors?.editorBackground) {
                isDraggingEditor = true;
                e.preventDefault();
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;

                const pos = this.workingTheme.colors.editorBgPosition || 'center center';
                const [h, v] = pos.split(' ').map(p => {
                    if (p === 'center') return 50;
                    if (p === 'left' || p === 'top') return 0;
                    if (p === 'right' || p === 'bottom') return 100;
                    return parseInt(p) || 50;
                });
                startPosX = h;
                startPosY = v || 50;
            } else if (appBg && this.workingTheme?.colors?.appBackground) {
                isDraggingEditor = false;
                e.preventDefault();
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;

                const pos = this.workingTheme.colors.bgPosition || 'center center';
                const [h, v] = pos.split(' ').map(p => {
                    if (p === 'center') return 50;
                    if (p === 'left' || p === 'top') return 0;
                    if (p === 'right' || p === 'bottom') return 100;
                    return parseInt(p) || 50;
                });
                startPosX = h;
                startPosY = v || 50;
            } else {
                return;
            }

            wrapper.style.cursor = 'grabbing';
        };

        // Mouse move handler
        const mouseMoveHandler = (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const rect = wrapper.getBoundingClientRect();

            // Calculate position even if mouse is outside wrapper
            const newX = Math.max(0, Math.min(100, startPosX - (dx / rect.width) * 100));
            const newY = Math.max(0, Math.min(100, startPosY - (dy / rect.height) * 100));

            if (isDraggingEditor) {
                this.workingTheme.colors.editorBgPosition = `${Math.round(newX)}% ${Math.round(newY)}%`;
            } else {
                this.workingTheme.colors.bgPosition = `${Math.round(newX)}% ${Math.round(newY)}%`;
            }
            this._updateBgStyles();
        };

        // Mouse up handler
        const mouseUpHandler = () => {
            if (isDragging) {
                isDragging = false;
                // Don't exit drag mode automatically - user must click confirm button
                if (wrapper) wrapper.style.cursor = this.bgDragMode ? 'grab' : 'default';
            }
        };

        // Store handlers for cleanup
        wrapper._dragHandlers = {
            dblclick: dblClickHandler,
            mousedown: mouseDownHandler,
            mousemove: mouseMoveHandler,
            mouseup: mouseUpHandler
        };

        wrapper.addEventListener('dblclick', dblClickHandler);
        wrapper.addEventListener('mousedown', mouseDownHandler);
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    },

    /**
     * Cleanup drag handlers
     */
    _cleanupBgDrag() {
        const wrapper = this.popup?.querySelector('#tc6-preview-wrapper');
        if (!wrapper || !wrapper._dragHandlers) return;

        const handlers = wrapper._dragHandlers;
        wrapper.removeEventListener('dblclick', handlers.dblclick);
        wrapper.removeEventListener('mousedown', handlers.mousedown);
        document.removeEventListener('mousemove', handlers.mousemove);
        document.removeEventListener('mouseup', handlers.mouseup);

        wrapper._dragHandlers = null;
    },

    /**
     * Update drag mode hint
     */
    _updateDragModeHint() {
        const editBar = this.popup?.querySelector('#tc6-edit-bar');
        if (!editBar) return;

        if (this.bgDragMode) {
            const editorBg = this.popup?.querySelector('.tc6-editor-bg');
            const isEditor = editorBg && this.workingTheme?.colors?.editorBackground;

            // Replace edit bar content with drag mode notification
            editBar.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 4px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>
                        </svg>
                        <span style="font-weight: 700; color: #2a5a75; font-size: 13px; font-family: 'Fredoka', sans-serif;">Drag Mode Active</span>
                        <span style="color: #5a8a95; font-size: 12px;">Drag to reposition ${isEditor ? 'editor' : 'app'} background</span>
                    </div>
                    <button class="tc6-drag-confirm-btn" id="tc6-drag-confirm">
                        <svg viewBox="0 0 24 24" width="14" height="14">
                            <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="3" fill="none"/>
                        </svg>
                        Done
                    </button>
                </div>
            `;

            // Apply kawaii gradient styling
            editBar.style.background = 'linear-gradient(135deg, #FFD93D 0%, #FFA96C 100%)';
            editBar.style.border = '3px solid #FFB84D';
            editBar.style.boxShadow = '4px 4px 0 rgba(255, 184, 77, 0.3)';

            // Bind confirm button
            const confirmBtn = editBar.querySelector('#tc6-drag-confirm');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => {
                    this._exitDragMode();
                });
            }
        } else {
            // Restore original edit bar (new structure with always visible undo/redo)
            editBar.innerHTML = `
                <!-- Undo/Redo - Always visible -->
                <div class="tc6-edit-actions">
                    <button class="tc6-edit-action" id="tc6-undo" disabled title="Undo (Ctrl+Z)">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                        </svg>
                    </button>
                    <button class="tc6-edit-action" id="tc6-redo" disabled title="Redo (Ctrl+Y)">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
                        </svg>
                    </button>
                </div>
                
                <!-- Divider -->
                <div class="tc6-edit-divider"></div>
                
                <!-- Idle hint -->
                <span class="tc6-edit-hint" id="tc6-edit-hint">Click any element to edit • Double-click background to drag</span>
                
                <!-- Active element info (hidden initially) -->
                <div class="tc6-edit-element" id="tc6-edit-element" style="display: none;">
                    <div class="tc6-edit-element-info">
                        <span class="tc6-edit-element-name" id="tc6-edit-name">Element Name</span>
                        <div class="tc6-edit-color-preview" id="tc6-edit-color"></div>
                    </div>
                    
                    <div class="tc6-edit-properties" id="tc6-edit-properties"></div>
                    
                    <button class="tc6-edit-close" id="tc6-edit-close" title="Deselect">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            `;

            // Reset styles
            editBar.style.background = '';
            editBar.style.border = '';
            editBar.style.boxShadow = '';

            // Re-bind undo/redo handlers
            this.popup.querySelector('#tc6-undo')?.addEventListener('click', () => this._undo());
            this.popup.querySelector('#tc6-redo')?.addEventListener('click', () => this._redo());
            this._updateHistoryButtons();
        }
    },

    /**
     * Exit drag mode
     */
    _exitDragMode() {
        this.bgDragMode = false;
        const wrapper = this.popup?.querySelector('#tc6-preview-wrapper');
        if (wrapper) {
            wrapper.style.cursor = 'default';
        }

        const ide = this.popup?.querySelector('.tc6-ide');
        const content = this.popup?.querySelector('.tc6-ide-content');
        if (ide) ide.classList.remove('tc6-drag-mode');
        if (content) content.classList.remove('tc6-dimmed');

        this._updateDragModeHint();
    },

    /**
     * Lightweight update for background styles only
     */
    _updateBgStyles() {
        const bgEl = this.popup?.querySelector('.tc6-ide-bg');
        const editorBgEl = this.popup?.querySelector('.tc6-editor-bg');

        const c = this.workingTheme?.colors || {};

        if (bgEl && c.appBackground) {
            // Use double quotes for data URLs to avoid escaping issues
            const bgUrl = c.appBackground.startsWith('data:')
                ? `url("${c.appBackground}")`
                : `url('${c.appBackground.replace(/'/g, "\\'")}')`;
            bgEl.style.backgroundImage = bgUrl;
            bgEl.style.backgroundPosition = c.bgPosition || 'center center';
            bgEl.style.opacity = (c.bgOpacity ?? 50) / 100;
            const appBlur = c.bgBlur ?? 0;
            bgEl.style.filter = appBlur > 0 ? `blur(${appBlur}px)` : 'none';
        }

        if (editorBgEl && c.editorBackground) {
            // Use double quotes for data URLs to avoid escaping issues
            const bgUrl = c.editorBackground.startsWith('data:')
                ? `url("${c.editorBackground}")`
                : `url('${c.editorBackground.replace(/'/g, "\\'")}')`;
            editorBgEl.style.backgroundImage = bgUrl;
            editorBgEl.style.backgroundPosition = c.editorBgPosition || 'center center';
            const blur = c.editorBgBlur ?? 0;
            editorBgEl.style.opacity = (c.editorBgOpacity ?? 15) / 100;
            editorBgEl.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
            // Extend inset to prevent blur edge artifacts
            editorBgEl.style.inset = blur > 0 ? `-${blur}px` : '0';
        }
    },

    /**
     * Render live preview
     */
    _renderPreview() {
        const wrapper = this.popup?.querySelector('#tc6-preview-wrapper');
        if (!wrapper) return;

        const c = this.workingTheme?.colors || {};
        const syn = this._getSyntaxColors();

        const appBg = c.appBackground || '';
        const editorBg = c.editorBackground || '';
        const bgOpacity = (c.bgOpacity ?? 50) / 100;
        const bgBlur = c.bgBlur ?? 0;
        const bgPos = c.bgPosition || 'center center';
        const editorOpacity = (c.editorBgOpacity ?? 15) / 100;
        const editorBlur = c.editorBgBlur ?? 0;

        // Get editor background position
        const editorBgPos = c.editorBgPosition || 'center center';

        wrapper.innerHTML = `
            <div class="tc6-ide ${this.bgDragMode ? 'tc6-drag-mode' : ''}">
                ${appBg ? `<div class="tc6-ide-bg" style="background-image: ${appBg.startsWith('data:') ? `url("${appBg}")` : `url('${appBg.replace(/'/g, "\\'")}')`}; background-position: ${bgPos}; opacity: ${bgOpacity}; filter: ${bgBlur > 0 ? 'blur(' + bgBlur + 'px)' : 'none'};"></div>` : ''}
                
                <div class="tc6-ide-content ${this.bgDragMode ? 'tc6-dimmed' : ''}">
                    <!-- Header -->
                    <div class="tc6-clickable tc6-ui-element" data-key="bgHeader-main" data-label="Header Background" style="height: 32px; display: flex; align-items: center; padding: 0 10px; gap: 8px; background: ${c.bgHeader || '#1a1e2e'}; border-bottom: 1px solid ${c.border || '#333'};">
                        <div class="tc6-clickable" data-key="accent" data-label="Accent Color" style="font-weight: 700; font-size: 10px; padding: 3px 6px; border-radius: 3px; background: ${c.accent || '#88c9ea'}; color: #fff;">C++</div>
                        <div style="display: flex; gap: 8px; font-size: 9px; color: ${c.textPrimary || '#fff'};">
                            <span class="tc6-clickable" data-key="textPrimary" data-label="Primary Text">File</span>
                            <span>Edit</span>
                            <span>View</span>
                        </div>
                        <div style="margin-left: auto; display: flex; gap: 5px;">
                            <div class="tc6-clickable" data-key="success" data-label="Success" style="width: 8px; height: 8px; border-radius: 50%; background: ${c.success || '#7dcea0'};"></div>
                            <div class="tc6-clickable" data-key="error" data-label="Error" style="width: 8px; height: 8px; border-radius: 50%; background: ${c.error || '#ff6b6b'};"></div>
                        </div>
                    </div>
                    
                    <!-- Main Area -->
                    <div style="display: flex; flex: 1; overflow: hidden; padding: 8px; gap: 8px;">
                        <!-- Editor Column -->
                        <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
                            <!-- Editor -->
                            <div class="tc6-clickable tc6-ui-element tc6-editor-wrapper" data-key="editorBg" data-label="Editor Background" style="flex: 1; min-height: 180px; border-radius: 8px; background: ${c.editorBg || '#1e1e1e'}; border: 1px solid ${c.border || '#333'}; position: relative; overflow: hidden;">
                                ${editorBg ? `<div class="tc6-editor-bg" style="position: absolute; inset: ${editorBlur > 0 ? -editorBlur + 'px' : '0'}; background-image: ${editorBg.startsWith('data:') ? `url("${editorBg}")` : `url('${editorBg.replace(/'/g, "\\'")}')`}; background-size: cover; background-position: ${editorBgPos}; opacity: ${editorOpacity}; filter: ${editorBlur > 0 ? 'blur(' + editorBlur + 'px)' : 'none'}; pointer-events: none;"></div>` : ''}
                                <div style="position: relative; z-index: 1; padding: 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.7;">
                                    <div><span class="tc6-clickable" data-key="textMuted" data-label="Line Numbers" style="color: ${c.textMuted || '#666'}; margin-right: 12px; user-select: none;">1</span><span class="tc6-clickable" data-key="syntaxKeyword" data-label="Keywords" style="color: ${syn.keyword}">#include</span><span class="tc6-clickable" data-key="syntaxString" data-label="Strings" style="color: ${syn.string}">&lt;bits/stdc++.h&gt;</span></div>
                                    <div><span style="color: ${c.textMuted || '#666'}; margin-right: 12px; user-select: none;">2</span><span style="color: ${syn.keyword}">using namespace</span> <span style="color: ${c.textPrimary || '#d4d4d4'}">std;</span></div>
                                    <div><span style="color: ${c.textMuted || '#666'}; margin-right: 12px; user-select: none;">3</span></div>
                                    <div><span style="color: ${c.textMuted || '#666'}; margin-right: 12px; user-select: none;">4</span><span class="tc6-clickable" data-key="syntaxType" data-label="Types" style="color: ${syn.type}">int</span> <span class="tc6-clickable" data-key="syntaxFunction" data-label="Functions" style="color: ${syn.function}">main</span>() {</div>
                                    <div><span style="color: ${c.textMuted || '#666'}; margin-right: 12px; user-select: none;">5</span>    cout << <span style="color: ${syn.string}">"hello"</span>;</div>
                                    <div><span style="color: ${c.textMuted || '#666'}; margin-right: 12px; user-select: none;">6</span>    <span style="color: ${syn.keyword}">return</span> <span class="tc6-clickable" data-key="syntaxNumber" data-label="Numbers" style="color: ${syn.number}">0</span>;</div>
                                    <div><span style="color: ${c.textMuted || '#666'}; margin-right: 12px; user-select: none;">7</span>}</div>
                                </div>
                            </div>
                            
                            <!-- Problem Panel -->
                            <div class="tc6-clickable tc6-ui-element" data-key="bgPanel-problems" data-label="Problem Panel" style="height: 60px; border-radius: 6px; background: ${c.bgPanel || '#1a1e2e'}; border: 1px solid ${c.border || '#333'}; overflow: hidden; display: flex; flex-direction: column;">
                                <div style="padding: 4px 8px; font-size: 9px; font-weight: 700; color: ${c.textPrimary || '#fff'}; border-bottom: 1px solid ${c.border || '#333'}; display: flex; align-items: center; gap: 8px; background: ${c.bgHeader || '#1a1e2e'};">
                                    <span>PROBLEMS</span>
                                    <span style="background: ${c.error || '#ff6b6b'}; color: #fff; padding: 1px 6px; border-radius: 8px; font-size: 8px;">0</span>
                                    <span style="color: ${c.textMuted || '#888'};">TESTS</span>
                                </div>
                                <div style="flex: 1; padding: 8px; font-size: 9px; color: ${c.textMuted || '#888'}; display: flex; align-items: center; justify-content: center;">
                                    No problems detected
                                </div>
                            </div>
                        </div>
                        
                        <!-- Right Sidebar -->
                        <div style="width: 140px; display: flex; flex-direction: column; gap: 6px;">
                            <!-- INPUT Panel -->
                            <div class="tc6-clickable tc6-ui-element" data-key="bgPanel-input" data-label="Input Panel" style="flex: 1; background: ${c.bgPanel || '#1a1e2e'}; border: 1px solid ${c.border || '#333'}; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column;">
                                <div style="padding: 5px 8px; font-size: 9px; font-weight: 700; color: ${c.accent || '#88c9ea'}; border-bottom: 1px solid ${c.border || '#333'};">INPUT</div>
                                <div class="tc6-clickable" data-key="bgInput" data-label="Input Background" style="flex: 1; padding: 8px; font-size: 10px; color: ${c.textMuted || '#888'}; background: ${c.bgInput || '#222'}; margin: 4px; border-radius: 4px;">Nhập dữ liệu test...</div>
                            </div>
                            
                            <!-- EXPECTED Panel -->
                            <div class="tc6-clickable tc6-ui-element" data-key="bgPanel-expected" data-label="Expected Panel" style="flex: 1; background: ${c.bgPanel || '#1a1e2e'}; border: 1px solid ${c.border || '#333'}; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column;">
                                <div style="padding: 5px 8px; font-size: 9px; font-weight: 700; color: ${c.accent || '#88c9ea'}; border-bottom: 1px solid ${c.border || '#333'};">EXPECTED</div>
                                <div style="flex: 1; padding: 8px; font-size: 10px; color: ${c.textMuted || '#888'};">Kết quả mong đợi...</div>
                            </div>
                        </div>
                        
                        <!-- Terminal -->
                        <div class="tc6-clickable tc6-ui-element" data-key="terminalBg" data-label="Terminal" style="width: 160px; background: ${c.terminalBg || '#0d1520'}; border: 1px solid ${c.border || '#333'}; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column;">
                            <div style="padding: 5px 8px; font-size: 9px; font-weight: 700; color: ${c.accent || '#88c9ea'}; border-bottom: 1px solid ${c.border || '#333'};">TERMINAL</div>
                            <div style="flex: 1; padding: 8px; font-size: 10px; overflow: hidden;">
                                <div style="color: ${c.success || '#7dcea0'};">Settings saved</div>
                            </div>
                            <div style="padding: 4px 8px; border-top: 1px solid ${c.border || '#333'}; display: flex; align-items: center; gap: 4px;">
                                <span style="color: ${c.textMuted || '#888'}; font-size: 9px;">Input ...</span>
                                <div style="margin-left: auto; width: 20px; height: 20px; border-radius: 50%; background: ${c.accent || '#88c9ea'}; display: flex; align-items: center; justify-content: center;">
                                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" stroke-width="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Status Bar -->
                    <div class="tc6-clickable tc6-ui-element" data-key="bgHeader-statusbar" data-label="Status Bar" style="height: 20px; display: flex; align-items: center; padding: 0 8px; gap: 6px; background: ${c.bgHeader || '#1a1e2e'}; border-top: 1px solid ${c.border || '#333'}; font-size: 9px;">
                        <div style="width: 5px; height: 5px; border-radius: 50%; background: ${c.success || '#7dcea0'};"></div>
                        <span style="color: ${c.textPrimary || '#fff'};">Ready</span>
                        <span style="margin-left: auto; color: ${c.textMuted || '#888'};">Ln 1, Col 1</span>
                    </div>
                </div>
            </div>
        `;

        // Cleanup old drag handlers before re-render
        this._cleanupBgDrag();

        // Re-setup drag handlers after re-render (important!)
        this._setupBgDrag();

        // Bind click handlers for color editing
        wrapper.querySelectorAll('.tc6-clickable[data-key]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.bgDragMode) return; // Don't activate edit bar in drag mode
                const key = el.dataset.key;
                const label = el.dataset.label || key;
                // Activate edit bar (Canva-style floating toolbar)
                this._updateEditBar(key, label);
            });
        });
    },

    /**
     * Color presets for quick selection
     */
    _getColorPresets() {
        return {
            material: ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'],
            tailwind: ['#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899'],
            pastel: ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#D4BAFF', '#FFBAF3', '#FFC9BA', '#FFEEBA', '#C9FFD4', '#BAF3FF', '#E1BAFF', '#FFB3E6', '#FFD4BA', '#FFFABA', '#B3FFD9'],
            kawaii: ['#FFB6D9', '#FFC9E5', '#FFD4F0', '#E5CCFF', '#D9B3FF', '#C9BAFF', '#B3E5FF', '#BAF3FF', '#B3FFF0', '#C9FFE5', '#FFFABA', '#FFEEBA', '#FFDFBA', '#FFC9D9', '#FFB3CC', '#FFE5F0']
        };
    },

    /**
     * Show advanced color picker with customization options
     */
    _showColorPicker(key, label, targetEl) {
        this._hideColorPicker();
        this._activeColorKey = key;

        const currentColor = this._getColor(key);
        const hexColor = this._toHex(currentColor);
        const c = this.workingTheme?.colors || {};

        // Get current values
        const currentOpacity = this._getOpacity(key) ?? 100;
        const currentBorder = c.border || '#333';

        // Highlight the selected element
        targetEl.classList.add('tc6-color-active');

        // Get presets
        const presets = this._getColorPresets();

        const picker = document.createElement('div');
        picker.className = 'tc6-color-picker';
        picker.innerHTML = `
            <div class="tc6-color-picker-header" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--border, #444);">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="tc6-color-swatch" style="background: ${hexColor};"></div>
                    <span class="tc6-color-label" style="font-size: 11px; font-weight: 600; color: var(--text-primary, #fff);">${label}</span>
                </div>
                <button class="tc6-color-picker-close">✕</button>
            </div>
            
            <div class="tc6-picker-tabs">
                <button class="tc6-picker-tab active" data-tab="color">Color</button>
                <button class="tc6-picker-tab" data-tab="presets">Presets</button>
                <button class="tc6-picker-tab" data-tab="advanced">Advanced</button>
            </div>
            
            <div class="tc6-picker-content">
                <!-- Color Tab -->
                <div class="tc6-picker-tab-panel" data-panel="color" style="display: block;">
                    <div class="tc6-picker-section">
                        <input type="color" class="tc6-color-input-native" value="${hexColor}" style="width: 100%; height: 40px; border: none; border-radius: 6px; cursor: pointer; margin-bottom: 8px;">
                        <div class="tc6-picker-row">
                            <span class="tc6-picker-label">Hex:</span>
                            <input type="text" class="tc6-input" id="tc6-hex-input" value="${hexColor.toUpperCase()}" style="flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 11px; padding: 6px 8px;">
                        </div>
                    </div>
                </div>
                
                <!-- Presets Tab -->
                <div class="tc6-picker-tab-panel" data-panel="presets" style="display: none;">
                    <div class="tc6-picker-section">
                        <div class="tc6-picker-section-title">Material Design</div>
                        <div class="tc6-preset-grid">
                            ${presets.material.map(color => `<div class="tc6-preset-swatch" data-color="${color}" style="background: ${color};" title="${color}"></div>`).join('')}
                        </div>
                    </div>
                    <div class="tc6-picker-section">
                        <div class="tc6-picker-section-title">Tailwind CSS</div>
                        <div class="tc6-preset-grid">
                            ${presets.tailwind.map(color => `<div class="tc6-preset-swatch" data-color="${color}" style="background: ${color};" title="${color}"></div>`).join('')}
                        </div>
                    </div>
                    <div class="tc6-picker-section">
                        <div class="tc6-picker-section-title">Pastel</div>
                        <div class="tc6-preset-grid">
                            ${presets.pastel.map(color => `<div class="tc6-preset-swatch" data-color="${color}" style="background: ${color};" title="${color}"></div>`).join('')}
                        </div>
                    </div>
                    <div class="tc6-picker-section">
                        <div class="tc6-picker-section-title">Kawaii</div>
                        <div class="tc6-preset-grid">
                            ${presets.kawaii.map(color => `<div class="tc6-preset-swatch" data-color="${color}" style="background: ${color};" title="${color}"></div>`).join('')}
                        </div>
                    </div>
                </div>
                
                <!-- Advanced Tab -->
                <div class="tc6-picker-tab-panel" data-panel="advanced" style="display: none;">
                    <div class="tc6-picker-section">
                        <div class="tc6-picker-section-title">Opacity</div>
                        <div class="tc6-picker-row">
                            <span class="tc6-picker-label">Alpha:</span>
                            <div class="tc6-picker-control">
                                <input type="range" min="0" max="100" value="${currentOpacity}" id="tc6-opacity-slider" style="flex: 1;">
                                <span class="tc6-picker-value" id="tc6-opacity-value">${currentOpacity}%</span>
                            </div>
                        </div>
                    </div>
                    ${this._supportsBorder(key) ? `
                    <div class="tc6-picker-section">
                        <div class="tc6-picker-section-title">Border</div>
                        <div class="tc6-picker-row">
                            <span class="tc6-picker-label">Color:</span>
                            <input type="color" id="tc6-border-color" value="${this._toHex(currentBorder)}" style="width: 40px; height: 28px; border: none; border-radius: 4px; cursor: pointer;">
                            <input type="text" class="tc6-input" id="tc6-border-hex" value="${this._toHex(currentBorder).toUpperCase()}" style="flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 4px 6px;">
                        </div>
                        <div class="tc6-picker-row">
                            <span class="tc6-picker-label">Width:</span>
                            <div class="tc6-picker-control">
                                <input type="range" min="0" max="5" value="${c.borderWidth || 1}" id="tc6-border-width" style="flex: 1;">
                                <span class="tc6-picker-value" id="tc6-border-width-value">${c.borderWidth || 1}px</span>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(picker);
        this.currentColorPicker = picker;
        this._activeTargetEl = targetEl;

        // Position near target element
        const rect = targetEl.getBoundingClientRect();
        let left = rect.left + rect.width / 2 - 140;
        let top = rect.bottom + 8;

        if (left < 10) left = 10;
        if (left + 280 > window.innerWidth) left = window.innerWidth - 290;
        if (top + 200 > window.innerHeight) top = rect.top - 210;

        picker.style.left = left + 'px';
        picker.style.top = top + 'px';

        requestAnimationFrame(() => picker.classList.add('visible'));

        // Tab switching
        picker.querySelectorAll('.tc6-picker-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                picker.querySelectorAll('.tc6-picker-tab').forEach(t => t.classList.remove('active'));
                picker.querySelectorAll('.tc6-picker-tab-panel').forEach(p => p.style.display = 'none');
                tab.classList.add('active');
                picker.querySelector(`[data-panel="${tabName}"]`).style.display = 'block';
            });
        });

        // Color input - live update
        const colorInput = picker.querySelector('input[type="color"]');
        const hexInput = picker.querySelector('#tc6-hex-input');
        const swatch = picker.querySelector('.tc6-color-swatch');

        const updateColor = (newColor) => {
            swatch.style.background = newColor;
            hexInput.value = newColor.toUpperCase();
            this._setColor(key, newColor);
            this._updatePreviewWithoutRerender(key);
        };

        colorInput.addEventListener('input', (e) => {
            updateColor(e.target.value);
        });

        hexInput.addEventListener('input', (e) => {
            const val = e.target.value.replace(/[^0-9A-Fa-f]/g, '');
            if (val.length === 6) {
                const color = '#' + val;
                colorInput.value = color;
                updateColor(color);
            }
        });

        // Opacity slider
        const opacitySlider = picker.querySelector('#tc6-opacity-slider');
        const opacityValue = picker.querySelector('#tc6-opacity-value');
        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                opacityValue.textContent = val + '%';
                this._setOpacity(key, val);
                this._updatePreviewWithoutRerender(key);
            });
        }

        // Border controls
        if (this._supportsBorder(key)) {
            const borderColorInput = picker.querySelector('#tc6-border-color');
            const borderHexInput = picker.querySelector('#tc6-border-hex');
            const borderWidthSlider = picker.querySelector('#tc6-border-width');
            const borderWidthValue = picker.querySelector('#tc6-border-width-value');

            if (borderColorInput) {
                borderColorInput.addEventListener('input', (e) => {
                    const color = e.target.value;
                    borderHexInput.value = color.toUpperCase();
                    if (!this.workingTheme.colors) this.workingTheme.colors = {};
                    this.workingTheme.colors.border = color;
                    this._updatePreviewWithoutRerender(key);
                });
            }

            if (borderHexInput) {
                borderHexInput.addEventListener('input', (e) => {
                    const val = e.target.value.replace(/[^0-9A-Fa-f]/g, '');
                    if (val.length === 6) {
                        const color = '#' + val;
                        borderColorInput.value = color;
                        if (!this.workingTheme.colors) this.workingTheme.colors = {};
                        this.workingTheme.colors.border = color;
                        this._updatePreviewWithoutRerender(key);
                    }
                });
            }

            if (borderWidthSlider) {
                borderWidthSlider.addEventListener('input', (e) => {
                    const val = parseInt(e.target.value);
                    borderWidthValue.textContent = val + 'px';
                    if (!this.workingTheme.colors) this.workingTheme.colors = {};
                    this.workingTheme.colors.borderWidth = val;
                    this._updatePreviewWithoutRerender(key);
                });
            }
        }

        // Preset swatch clicks
        picker.querySelectorAll('.tc6-preset-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                const color = swatch.dataset.color;
                colorInput.value = color;
                updateColor(color);
            });
        });

        picker.querySelector('.tc6-color-picker-close').addEventListener('click', () => this._hideColorPicker());

        // Close on outside click
        this._pickerClickHandler = (e) => {
            if (!picker.contains(e.target) && !targetEl.contains(e.target)) {
                this._hideColorPicker();
            }
        };
        setTimeout(() => {
            document.addEventListener('click', this._pickerClickHandler);
        }, 100);
    },

    /**
     * Check if element supports border customization
     */
    _supportsBorder(key) {
        // Elements that can have borders (including variants)
        const borderableKeys = [
            'bgPanel', 'bgPanel-problems', 'bgPanel-input', 'bgPanel-expected',
            'bgInput',
            'editorBg',
            'bgHeader', 'bgHeader-main', 'bgHeader-statusbar'
        ];
        return borderableKeys.includes(key);
    },

    /**
     * Get opacity for a color key
     */
    _getOpacity(key) {
        // Some colors might have opacity stored separately
        const c = this.workingTheme?.colors || {};
        const baseKey = this._getBaseKey(key);
        const opacityKey = baseKey + 'Opacity';
        return c[opacityKey];
    },

    /**
     * Set opacity for a color key
     */
    _setOpacity(key, value) {
        if (!this.workingTheme.colors) this.workingTheme.colors = {};
        const baseKey = this._getBaseKey(key);
        const opacityKey = baseKey + 'Opacity';
        this.workingTheme.colors[opacityKey] = value;
    },

    /**
     * Update preview without full re-render (preserves editor background)
     */
    _updatePreviewWithoutRerender(key) {
        // Map base keys to all their variants
        const keyVariants = this._getKeyVariants(key);

        // Find all elements matching this key or its variants
        let elements = [];
        keyVariants.forEach(variantKey => {
            const found = this.popup?.querySelectorAll(`[data-key="${variantKey}"]`);
            if (found && found.length > 0) {
                elements.push(...Array.from(found));
            }
        });

        if (elements.length === 0) {
            // Fallback to full render if element not found
            this._renderPreview();
            return;
        }

        const c = this.workingTheme?.colors || {};
        const color = this._getColor(key);

        elements.forEach(el => {
            // Update background color
            if (el.style.background || el.style.backgroundColor) {
                const opacity = this._getOpacity(key);
                if (opacity !== undefined && opacity < 100) {
                    const rgb = this._hexToRgb(color);
                    if (rgb) {
                        el.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity / 100})`;
                    }
                } else {
                    el.style.backgroundColor = color;
                }
            }

            // Update border if supported
            if (this._supportsBorder(key) && c.border) {
                el.style.borderColor = c.border;
                if (c.borderWidth) {
                    el.style.borderWidth = c.borderWidth + 'px';
                }
            }
        });

        // Update background styles separately to preserve editor background
        this._updateBgStyles();
    },

    /**
     * Get all key variants for a given key
     * Maps base keys like 'bgHeader' to all their variants like ['bgHeader-main', 'bgHeader-statusbar']
     */
    _getKeyVariants(key) {
        const keyMap = {
            'bgHeader': ['bgHeader-main', 'bgHeader-statusbar'],
            'bgHeader-main': ['bgHeader-main'],
            'bgHeader-statusbar': ['bgHeader-statusbar'],
            'bgPanel': ['bgPanel-problems', 'bgPanel-input', 'bgPanel-expected'],
            'bgPanel-problems': ['bgPanel-problems'],
            'bgPanel-input': ['bgPanel-input'],
            'bgPanel-expected': ['bgPanel-expected']
        };

        // Return mapped variants or just the key itself if no mapping exists
        return keyMap[key] || [key];
    },

    /**
     * Convert hex to RGB
     */
    _hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },

    /**
     * Hide color picker
     */
    _hideColorPicker() {
        if (this.currentColorPicker) {
            this.currentColorPicker.remove();
            this.currentColorPicker = null;
        }
        if (this._activeTargetEl) {
            this._activeTargetEl.classList.remove('tc6-color-active');
            this._activeTargetEl = null;
        }
        if (this._pickerClickHandler) {
            document.removeEventListener('click', this._pickerClickHandler);
            this._pickerClickHandler = null;
        }
        this._activeColorKey = null;
    },

    /**
     * Update edit bar - Switch between idle and active states
     * @param {string|null} elementKey - Color key (null = idle state)
     * @param {string} elementLabel - Display label for element
     */
    _updateEditBar(elementKey, elementLabel) {
        const editBar = this.popup?.querySelector('#tc6-edit-bar');
        if (!editBar) return;

        const hintEl = editBar.querySelector('#tc6-edit-hint');
        const elementEl = editBar.querySelector('#tc6-edit-element');

        if (!elementKey) {
            // Switch to idle state - show hint, hide element
            if (hintEl) hintEl.style.display = 'inline';
            if (elementEl) elementEl.style.display = 'none';
            this._activeColorKey = null;
            return;
        }

        // Switch to active state - hide hint, show element
        this._activeColorKey = elementKey;

        if (hintEl) hintEl.style.display = 'none';
        if (elementEl) {
            elementEl.style.display = 'flex';

            // Update element name
            const nameEl = elementEl.querySelector('#tc6-edit-name');
            if (nameEl) nameEl.textContent = elementLabel;

            // Update color preview
            const colorPreview = elementEl.querySelector('#tc6-edit-color');
            if (colorPreview) {
                const color = this._getColor(elementKey);
                colorPreview.style.background = color;

                // Click handler for color dropdown
                colorPreview.onclick = (e) => {
                    e.stopPropagation();
                    this._showColorDropdown(elementKey, elementLabel, colorPreview);
                };
            }

            // Render property icons
            const propertiesContainer = elementEl.querySelector('#tc6-edit-properties');
            if (propertiesContainer) {
                propertiesContainer.innerHTML = '';
                const properties = this._renderPropertyIcons(elementKey);
                properties.forEach(prop => {
                    const btn = document.createElement('button');
                    btn.className = 'tc6-edit-prop-btn';
                    btn.title = prop.label;
                    btn.innerHTML = prop.icon;
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        this._showPropertyPopover(prop.property, prop.getValue(), btn);
                    };
                    propertiesContainer.appendChild(btn);
                });
            }

            // Close button handler
            const closeBtn = elementEl.querySelector('#tc6-edit-close');
            if (closeBtn) {
                closeBtn.onclick = () => this._updateEditBar(null);
            }
        }
    },

    /**
     * Render property icons based on element type
     * @param {string} elementKey - Color key
     * @returns {Array} Array of property objects
     */
    _renderPropertyIcons(elementKey) {
        const properties = [];

        // Opacity control (for all elements)
        properties.push({
            icon: '<span style="font-size: 16px; font-weight: 700;">α</span>',
            property: 'opacity',
            label: 'Opacity',
            getValue: () => this._getOpacity(elementKey) ?? 100
        });

        // Blur control (for backgrounds and terminal - acrylic effect)
        if (elementKey === 'appBackground' || elementKey === 'editorBackground' || elementKey === 'terminalBg') {
            properties.push({
                icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" opacity="0.3"/>
                </svg>`,
                property: 'blur',
                label: 'Blur (Acrylic)',
                getValue: () => {
                    const c = this.workingTheme?.colors || {};
                    if (elementKey === 'appBackground') return c.bgBlur ?? 0;
                    if (elementKey === 'editorBackground') return c.editorBgBlur ?? 0;
                    if (elementKey === 'terminalBg') return c.terminalBgBlur ?? 0;
                    return 0;
                }
            });
        }

        // Border control (for supported elements)
        if (this._supportsBorder(elementKey)) {
            properties.push({
                icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                    <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>`,
                property: 'border',
                label: 'Border Width',
                getValue: () => this.workingTheme?.colors?.borderWidth ?? 1
            });
        }

        return properties;
    },

    /**
     * Show color dropdown (Figma-style)
     * @param {string} key - Color key
     * @param {string} label - Element label
     * @param {HTMLElement} targetEl - Target element to position dropdown
     */
    _showColorDropdown(key, label, targetEl) {
        // Remove existing dropdown
        document.querySelectorAll('.tc6-color-dropdown').forEach(el => el.remove());

        const currentColor = this._getColor(key);
        const hexColor = this._toHex(currentColor);
        const presets = this._getColorPresets();

        const dropdown = document.createElement('div');
        dropdown.className = 'tc6-color-dropdown';
        dropdown.innerHTML = `
            <div class="tc6-dropdown-section">
                <input type="color" class="tc6-dropdown-color-native" value="${hexColor}">
                <div class="tc6-dropdown-row">
                    <span class="tc6-dropdown-label">Hex:</span>
                    <input type="text" class="tc6-dropdown-hex" value="${hexColor.toUpperCase()}" maxlength="7">
                </div>
            </div>
            <div class="tc6-dropdown-section">
                <div class="tc6-dropdown-section-title">Presets</div>
                <div class="tc6-dropdown-preset-grid">
                    ${presets.kawaii.map(color => `
                        <div class="tc6-dropdown-preset" style="background: ${color};" data-color="${color}" title="${color}"></div>
                    `).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(dropdown);

        // Position dropdown below color preview
        const rect = targetEl.getBoundingClientRect();
        dropdown.style.left = rect.left + 'px';
        dropdown.style.top = (rect.bottom + 8) + 'px';

        // Show with animation
        requestAnimationFrame(() => dropdown.classList.add('visible'));

        // Bind events
        const colorInput = dropdown.querySelector('.tc6-dropdown-color-native');
        const hexInput = dropdown.querySelector('.tc6-dropdown-hex');

        const updateColor = (newColor) => {
            this._saveHistorySnapshot();
            this._setColor(key, newColor);
            this._updatePreviewWithoutRerender(key);
            targetEl.style.background = newColor;
            hexInput.value = newColor.toUpperCase();
            this._triggerAutoSave();
        };

        colorInput.addEventListener('input', (e) => updateColor(e.target.value));
        hexInput.addEventListener('input', (e) => {
            const val = e.target.value.replace(/[^#0-9A-Fa-f]/g, '');
            if (val.length === 7 && val.startsWith('#')) {
                colorInput.value = val;
                updateColor(val);
            }
        });

        dropdown.querySelectorAll('.tc6-dropdown-preset').forEach(preset => {
            preset.addEventListener('click', () => {
                const color = preset.dataset.color;
                colorInput.value = color;
                updateColor(color);
            });
        });

        // Close on outside click
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!dropdown.contains(e.target) && !targetEl.contains(e.target)) {
                    dropdown.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    },

    /**
     * Show property popover (mini slider)
     * @param {string} property - Property name (opacity, blur, border)
     * @param {number} value - Current value
     * @param {HTMLElement} targetEl - Target button element
     */
    _showPropertyPopover(property, value, targetEl) {
        // Remove existing popovers
        document.querySelectorAll('.tc6-property-popover').forEach(el => el.remove());

        const config = {
            opacity: { min: 0, max: 100, suffix: '%', step: 1 },
            blur: { min: 0, max: 20, suffix: 'px', step: 1 },
            border: { min: 0, max: 5, suffix: 'px', step: 1 }
        }[property];

        if (!config) return;

        const popover = document.createElement('div');
        popover.className = 'tc6-property-popover';
        popover.innerHTML = `
            <div class="tc6-popover-label">${targetEl.title}</div>
            <div class="tc6-popover-slider-row">
                <input type="range" min="${config.min}" max="${config.max}" step="${config.step}" value="${value}" class="tc6-popover-slider">
                <span class="tc6-popover-value">${value}${config.suffix}</span>
            </div>
        `;

        document.body.appendChild(popover);

        // Position below button
        const rect = targetEl.getBoundingClientRect();
        popover.style.left = (rect.left + rect.width / 2 - 100) + 'px';
        popover.style.top = (rect.bottom + 8) + 'px';

        // Show with animation
        requestAnimationFrame(() => popover.classList.add('visible'));

        // Bind slider
        const slider = popover.querySelector('.tc6-popover-slider');
        const valueDisplay = popover.querySelector('.tc6-popover-value');

        slider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            valueDisplay.textContent = val + config.suffix;

            this._saveHistorySnapshot();

            // Update based on property type
            const key = this._activeColorKey;
            if (property === 'opacity') {
                this._setOpacity(key, val);
            } else if (property === 'blur') {
                const c = this.workingTheme.colors;
                if (key === 'appBackground') c.bgBlur = val;
                else if (key === 'editorBackground') c.editorBgBlur = val;
                else if (key === 'terminalBg') c.terminalBgBlur = val;
            } else if (property === 'border') {
                this.workingTheme.colors.borderWidth = val;
            }

            this._updatePreviewWithoutRerender(key);
            this._updateHistoryButtons();
            this._triggerAutoSave();
        });

        // Mark button as active
        targetEl.classList.add('active');

        // Close on outside click
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!popover.contains(e.target) && !targetEl.contains(e.target)) {
                    popover.remove();
                    targetEl.classList.remove('active');
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    },

    /**
     * Reset theme
     */
    _reset() {
        if (!confirm('Reset all changes?')) return;

        if (this.sourceThemeId && ThemeManager.themes.has(this.sourceThemeId)) {
            this.workingTheme = this._deepClone(ThemeManager.themes.get(this.sourceThemeId));
            this._renderSettings();
            this._renderPreview();
        }
    },

    /**
     * Save as new theme
     */
    _saveAsNew() {
        const name = this.popup?.querySelector('#tc6-name')?.value?.trim();
        if (!name) {
            alert('Please enter a theme name');
            return;
        }

        this.workingTheme.name = name;
        this.workingTheme.author = 'User';

        // Generate unique ID
        const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        let id = baseId;
        let counter = 1;
        while (ThemeManager.themes.has(id) || ThemeManager.builtinThemeIds.includes(id)) {
            id = `${baseId}-${counter++}`;
        }

        // Deep clone all colors including bgPosition and other settings
        const colorsClone = this._deepClone(this.workingTheme.colors || {});
        const editorClone = this._deepClone(this.workingTheme.editor || {});
        const terminalClone = this._deepClone(this.workingTheme.terminal || {});

        const themeData = {
            meta: {
                id: id,
                name: name,
                author: 'User',
                version: '1.0.0',
                type: this.workingTheme.type || 'dark',
                tags: ['custom']
            },
            colors: colorsClone,
            editor: editorClone,
            terminal: terminalClone
        };

        if (ThemeManager.registerTheme(themeData)) {
            ThemeManager._saveUserThemes();
            ThemeManager.setTheme(id);

            if (typeof App !== 'undefined') {
                App.settings.appearance.theme = id;
                if (typeof saveSettings === 'function') saveSettings();
            }

            if (typeof ThemeMarketplace !== 'undefined') {
                ThemeMarketplace.renderCarousel();
            }

            console.log(`[Customizer] Created: ${name} (${id})`);

            // Dispatch custom event for IDE integration
            this._dispatchThemeSaveEvent(themeData);

            // Show success notification
            this._showSaveNotification(`Theme "${name}" đã được lưu thành công!`);

            // Update sourceThemeId to the new theme and refresh header buttons
            this.sourceThemeId = id;
            this._refreshHeaderButtons();
        } else {
            alert('Failed to save theme');
        }
    },

    /**
     * Overwrite existing custom theme
     */
    _saveOverwrite() {
        if (!this.sourceThemeId || ThemeManager.builtinThemeIds.includes(this.sourceThemeId)) {
            alert('Cannot overwrite built-in themes');
            return;
        }

        const name = this.popup?.querySelector('#tc6-name')?.value?.trim() || this.workingTheme.name;
        this.workingTheme.name = name;

        // Deep clone all colors including bgPosition and other settings
        const colorsClone = this._deepClone(this.workingTheme.colors || {});
        const editorClone = this._deepClone(this.workingTheme.editor || {});
        const terminalClone = this._deepClone(this.workingTheme.terminal || {});

        const themeData = {
            meta: {
                id: this.sourceThemeId,
                name: name,
                author: this.workingTheme.author || 'User',
                version: '1.0.0',
                type: this.workingTheme.type || 'dark',
                tags: ['custom']
            },
            colors: colorsClone,
            editor: editorClone,
            terminal: terminalClone
        };

        if (ThemeManager.registerTheme(themeData)) {
            ThemeManager._saveUserThemes();
            ThemeManager.setTheme(this.sourceThemeId);

            if (typeof App !== 'undefined') {
                App.settings.appearance.theme = this.sourceThemeId;
                if (typeof saveSettings === 'function') saveSettings();
            }

            if (typeof ThemeMarketplace !== 'undefined') {
                ThemeMarketplace.renderCarousel();
            }

            console.log(`[Customizer] Updated: ${name}`);

            // Dispatch custom event for IDE integration
            this._dispatchThemeSaveEvent(themeData);

            // Show success notification
            this._showSaveNotification(`Theme "${name}" đã được cập nhật thành công!`);

            // Close customizer after save (Save & Close behavior)
            this.close();
        } else {
            alert('Failed to save theme');
        }
    },

    /**
     * Dispatch theme save event for IDE integration
     */
    _dispatchThemeSaveEvent(themeData) {
        const event = new CustomEvent('themeCustomizerSave', {
            detail: {
                theme: themeData,
                timestamp: Date.now()
            }
        });
        window.dispatchEvent(event);
        console.log('[Customizer] Dispatched themeCustomizerSave event', themeData.meta);
    },

    /**
     * Refresh header buttons (after save as new to show Save/Delete)
     */
    _refreshHeaderButtons() {
        const actionsContainer = this.popup?.querySelector('.tc6-actions');
        if (!actionsContainer) return;

        const isCustomTheme = this.sourceThemeId &&
            !ThemeManager.builtinThemeIds.includes(this.sourceThemeId);

        // Rebuild actions HTML
        actionsContainer.innerHTML = `
            <button class="tc6-btn" id="tc6-reset" title="Reset changes">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                </svg>
                Reset
            </button>
            ${isCustomTheme ? `
            <button class="tc6-btn tc6-btn-danger" id="tc6-delete" title="Delete this theme">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Delete
            </button>
            <button class="tc6-btn tc6-btn-accent" id="tc6-save" title="Save changes">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                </svg>
                Save
            </button>
            ` : ''}
            <button class="tc6-btn tc6-btn-primary" id="tc6-save-new" title="Save as new theme">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Save as New
            </button>
            <button class="tc6-btn tc6-btn-close" id="tc6-close">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        // Rebind button events
        actionsContainer.querySelector('#tc6-close')?.addEventListener('click', () => this.close());
        actionsContainer.querySelector('#tc6-reset')?.addEventListener('click', () => this._reset());
        actionsContainer.querySelector('#tc6-save')?.addEventListener('click', () => this._saveOverwrite());
        actionsContainer.querySelector('#tc6-save-new')?.addEventListener('click', () => this._saveAsNew());
        actionsContainer.querySelector('#tc6-delete')?.addEventListener('click', () => this._deleteTheme());
    },

    /**
     * Delete current custom theme
     */
    _deleteTheme() {
        if (!this.sourceThemeId || ThemeManager.builtinThemeIds.includes(this.sourceThemeId)) {
            alert('Cannot delete built-in themes');
            return;
        }

        const themeName = this.workingTheme?.name || this.sourceThemeId;
        if (!confirm(`Delete theme "${themeName}"? This cannot be undone.`)) {
            return;
        }

        const result = ThemeManager.deleteTheme(this.sourceThemeId);
        if (result.success) {
            console.log(`[Customizer] Deleted: ${themeName}`);

            if (typeof ThemeMarketplace !== 'undefined') {
                ThemeMarketplace.renderCarousel();
            }

            this.close();
        } else {
            alert(result.message || 'Failed to delete theme');
        }
    },

    // ========== HELPER METHODS ==========

    /**
     * Get base key from a unique key variant
     * e.g., 'bgHeader-main' -> 'bgHeader', 'bgPanel-input' -> 'bgPanel'
     */
    _getBaseKey(key) {
        // Map unique keys back to their base keys
        const baseKeyMap = {
            'bgHeader-main': 'bgHeader',
            'bgHeader-statusbar': 'bgHeader',
            'bgPanel-problems': 'bgPanel',
            'bgPanel-input': 'bgPanel',
            'bgPanel-expected': 'bgPanel'
        };

        return baseKeyMap[key] || key;
    },

    _getColor(key) {
        const c = this.workingTheme?.colors || {};

        // Normalize unique keys to base keys
        const baseKey = this._getBaseKey(key);

        if (c[baseKey]) return c[baseKey];

        if (baseKey.startsWith('syntax')) {
            const syntaxKey = baseKey.replace('syntax', '').toLowerCase();
            const color = this.workingTheme?.editor?.syntax?.[syntaxKey]?.color;
            return color ? (color.startsWith('#') ? color : '#' + color) : '#888888';
        }

        if (baseKey === 'editorBg') {
            return this.workingTheme?.editor?.background || c.editorBg || '#1e1e1e';
        }

        return '#888888';
    },

    _setColor(key, value) {
        if (!this.workingTheme) return;
        if (!this.workingTheme.colors) this.workingTheme.colors = {};

        // Normalize unique keys back to base keys for storage
        const baseKey = this._getBaseKey(key);

        if (baseKey.startsWith('syntax')) {
            const syntaxKey = baseKey.replace('syntax', '').toLowerCase();
            if (!this.workingTheme.editor) this.workingTheme.editor = { syntax: {} };
            if (!this.workingTheme.editor.syntax) this.workingTheme.editor.syntax = {};
            if (!this.workingTheme.editor.syntax[syntaxKey]) this.workingTheme.editor.syntax[syntaxKey] = {};
            this.workingTheme.editor.syntax[syntaxKey].color = value.replace('#', '');
        } else if (baseKey === 'editorBg') {
            if (!this.workingTheme.editor) this.workingTheme.editor = {};
            this.workingTheme.editor.background = value;
            this.workingTheme.colors.editorBg = value;
        } else {
            this.workingTheme.colors[baseKey] = value;
        }
    },


    _getSyntaxColors() {
        const syn = this.workingTheme?.editor?.syntax || {};
        const format = (c) => c ? (c.startsWith('#') ? c : '#' + c) : '#888888';

        return {
            keyword: format(syn.keyword?.color),
            string: format(syn.string?.color),
            number: format(syn.number?.color),
            type: format(syn.type?.color),
            function: format(syn.function?.color),
            comment: format(syn.comment?.color)
        };
    },

    _toHex(color) {
        if (!color) return '#888888';
        if (typeof color !== 'string') return '#888888';

        if (color.startsWith('#')) {
            return color.length > 7 ? color.slice(0, 7) : color;
        }

        if (color.startsWith('rgb')) {
            const match = color.match(/\d+/g);
            if (match && match.length >= 3) {
                const r = parseInt(match[0]);
                const g = parseInt(match[1]);
                const b = parseInt(match[2]);
                return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
            }
        }

        return '#888888';
    },

    _deepClone(obj) {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch {
            return {};
        }
    },

    /**
     * Save current state to history stack
     */
    _saveHistorySnapshot() {
        // Remove any states after current index (when user made changes after undo)
        this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);

        // Add new snapshot
        this.historyStack.push(this._deepClone(this.workingTheme));
        this.historyIndex++;

        // Limit history size
        if (this.historyStack.length > this.maxHistorySize) {
            this.historyStack.shift();
            this.historyIndex--;
        }

        this._updateHistoryButtons();
    },

    /**
     * Undo to previous state
     */
    _undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.workingTheme = this._deepClone(this.historyStack[this.historyIndex]);
            this._renderControls();
            this._renderPreview();
            this._updateHistoryButtons();
            console.log(`[Customizer] Undo to step ${this.historyIndex}`);
        }
    },

    /**
     * Redo to next state
     */
    _redo() {
        if (this.historyIndex < this.historyStack.length - 1) {
            this.historyIndex++;
            this.workingTheme = this._deepClone(this.historyStack[this.historyIndex]);
            this._renderControls();
            this._renderPreview();
            this._updateHistoryButtons();
            console.log(`[Customizer] Redo to step ${this.historyIndex}`);
        }
    },

    /**
     * Update undo/redo button states
     */
    _updateHistoryButtons() {
        const undoBtn = this.popup?.querySelector('#tc6-undo');
        const redoBtn = this.popup?.querySelector('#tc6-redo');

        if (undoBtn) {
            undoBtn.disabled = this.historyIndex <= 0;
        }
        if (redoBtn) {
            redoBtn.disabled = this.historyIndex >= this.historyStack.length - 1;
        }
    },

    _escape(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    },

    /**
     * Show save success notification with tick icon
     */
    _showSaveNotification(message) {
        // Remove existing notification if any
        const existing = document.querySelector('.tc6-save-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = 'tc6-save-notification';
        notification.innerHTML = `
            <div class="tc6-save-notification-content">
                <svg class="tc6-save-tick" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span class="tc6-save-message">${this._escape(message)}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // Trigger animation
        requestAnimationFrame(() => {
            notification.classList.add('visible');
        });

        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('visible');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    /**
     * Trigger auto-save (debounced)
     */
    _triggerAutoSave() {
        // Only auto-save if it's a custom theme
        if (!this.sourceThemeId || ThemeManager.builtinThemeIds.includes(this.sourceThemeId)) {
            return;
        }

        // Clear previous timeout
        if (this._autoSaveTimeout) {
            clearTimeout(this._autoSaveTimeout);
        }

        // Debounce auto-save by 2 seconds
        this._autoSaveTimeout = setTimeout(() => {
            this._performAutoSave();
        }, 2000);
    },

    /**
     * Perform the actual auto-save
     */
    _performAutoSave() {
        if (!this.sourceThemeId || ThemeManager.builtinThemeIds.includes(this.sourceThemeId)) {
            return;
        }

        const name = this.popup?.querySelector('#tc6-name')?.value?.trim() || this.workingTheme.name;
        this.workingTheme.name = name;

        const colorsClone = this._deepClone(this.workingTheme.colors || {});
        const editorClone = this._deepClone(this.workingTheme.editor || {});
        const terminalClone = this._deepClone(this.workingTheme.terminal || {});

        const themeData = {
            meta: {
                id: this.sourceThemeId,
                name: name,
                author: this.workingTheme.author || 'User',
                version: '1.0.0',
                type: this.workingTheme.type || 'dark',
                tags: ['custom']
            },
            colors: colorsClone,
            editor: editorClone,
            terminal: terminalClone
        };

        if (ThemeManager.registerTheme(themeData)) {
            ThemeManager._saveUserThemes();

            // Show auto-save indicator
            this._showAutoSaveIndicator();

            console.log(`[Customizer] Auto-saved: ${name}`);
        }
    },

    /**
     * Show auto-save indicator
     */
    _showAutoSaveIndicator() {
        const indicator = this.popup?.querySelector('#tc6-autosave');
        if (!indicator) return;

        indicator.style.display = 'flex';

        // Hide after 2 seconds
        setTimeout(() => {
            if (indicator) indicator.style.display = 'none';
        }, 2000);
    }
};

window.ThemeCustomizer = ThemeCustomizer;
