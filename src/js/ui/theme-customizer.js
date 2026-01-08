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

    // Performance
    _renderTimeout: null,

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

        this._createUI();
        this._bindEvents();
        this._renderPreview();

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
                    <div class="tc6-title">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                        </svg>
                        <span>Theme Customizer</span>
                    </div>
                    <div class="tc6-actions">
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
                    </div>
                </div>
                
                <div class="tc6-body">
                    <!-- Settings Panel (collapsible) -->
                    <div class="tc6-settings" id="tc6-settings">
                        <div class="tc6-settings-toggle" id="tc6-settings-toggle">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                            </svg>
                            Settings
                        </div>
                        <div class="tc6-settings-content" id="tc6-settings-content"></div>
                    </div>
                    
                    <!-- Live Preview -->
                    <div class="tc6-preview" id="tc6-preview">
                        <div class="tc6-preview-hint">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                            </svg>
                            Click any element to change its color • Double-click background to drag
                        </div>
                        <div class="tc6-preview-wrapper" id="tc6-preview-wrapper"></div>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        this._injectStyles();
        document.body.appendChild(this.popup);

        // Render settings content
        this._renderSettings();
    },

    /**
     * Inject CSS styles
     */
    _injectStyles() {
        if (document.getElementById('tc6-styles')) return;

        const style = document.createElement('style');
        style.id = 'tc6-styles';
        style.textContent = `
            .tc6-overlay {
                position: fixed;
                inset: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(8px);
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            .tc6-overlay.visible { opacity: 1; }
            
            .tc6-container {
                width: min(95vw, 1100px);
                height: min(90vh, 700px);
                background: var(--bg-panel, #1a1e2e);
                border: 1px solid var(--border, #333);
                border-radius: 16px;
                box-shadow: 0 30px 100px rgba(0, 0, 0, 0.6);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                transform: scale(0.95) translateY(20px);
                transition: transform 0.3s ease;
            }
            .tc6-overlay.visible .tc6-container {
                transform: scale(1) translateY(0);
            }
            
            .tc6-header {
                height: 54px;
                background: #151929;
                border-bottom: 1px solid #333;
                display: flex;
                align-items: center;
                padding: 0 16px;
                gap: 12px;
                flex-shrink: 0;
            }
            
            .tc6-title {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 15px;
                font-weight: 700;
                color: var(--text-primary, #fff);
            }
            .tc6-title svg { color: var(--accent, #88c9ea); }
            
            .tc6-actions {
                margin-left: auto;
                display: flex;
                gap: 8px;
            }
            
            .tc6-btn {
                padding: 8px 14px;
                border-radius: 8px;
                border: 1px solid var(--border, #444);
                background: var(--bg-button, #2a2e3e);
                color: var(--text-primary, #fff);
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.2s;
            }
            .tc6-btn:hover { background: var(--bg-button-hover, #3a3e4e); transform: translateY(-1px); }
            
            .tc6-btn-accent {
                background: var(--bg-button-hover, #3a3e4e);
                border-color: var(--accent, #88c9ea);
            }
            
            .tc6-btn-primary {
                background: var(--accent, #88c9ea);
                border-color: transparent;
                color: var(--button-text-on-accent, #fff);
            }
            .tc6-btn-primary:hover { filter: brightness(1.15); }
            
            .tc6-btn-danger {
                background: transparent;
                border-color: var(--error, #ff6b6b);
                color: var(--error, #ff6b6b);
            }
            .tc6-btn-danger:hover { 
                background: var(--error, #ff6b6b); 
                color: #fff;
            }
            
            .tc6-btn-close {
                background: transparent;
                border: none;
                padding: 8px;
                color: var(--text-muted, #666);
            }
            .tc6-btn-close:hover { color: var(--error, #ff6b6b); }
            
            .tc6-body {
                display: flex;
                flex: 1;
                overflow: hidden;
            }
            
            /* Settings Panel */
            .tc6-settings {
                width: 280px;
                background: var(--bg-panel, #1a1e2e);
                border-right: 1px solid var(--border, #333);
                display: flex;
                flex-direction: column;
                flex-shrink: 0;
                transition: width 0.3s ease, margin 0.3s ease;
            }
            .tc6-settings.collapsed {
                width: 44px;
            }
            .tc6-settings.collapsed .tc6-settings-content { display: none; }
            .tc6-settings.collapsed .tc6-settings-toggle span { display: none; }
            
            .tc6-settings-toggle {
                height: 44px;
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 0 14px;
                background: #151929;
                border-bottom: 1px solid #333;
                color: #aaa;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.2s;
            }
            .tc6-settings-toggle:hover { background: #2a2e3e; }
            
            .tc6-settings-content {
                flex: 1;
                overflow-y: auto;
                padding: 12px;
            }
            
            .tc6-section {
                margin-bottom: 16px;
            }
            
            .tc6-section-title {
                font-size: 10px;
                font-weight: 700;
                color: var(--accent, #88c9ea);
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 10px;
                padding-bottom: 6px;
                border-bottom: 1px dashed var(--border, #333);
            }
            
            .tc6-field {
                margin-bottom: 12px;
            }
            
            .tc6-field-label {
                font-size: 11px;
                font-weight: 600;
                color: var(--text-secondary, #aaa);
                margin-bottom: 5px;
            }
            
            .tc6-input {
                width: 100%;
                padding: 8px 10px;
                border-radius: 6px;
                border: 1px solid var(--border, #444);
                background: var(--bg-input, #222);
                color: var(--text-primary, #fff);
                font-size: 12px;
            }
            .tc6-input:focus { border-color: var(--accent, #88c9ea); outline: none; }
            
            .tc6-select {
                width: 100%;
                padding: 8px 10px;
                border-radius: 6px;
                border: 1px solid var(--border, #444);
                background: var(--bg-input, #222);
                color: var(--text-primary, #fff);
                font-size: 12px;
            }
            
            .tc6-upload-row {
                display: flex;
                gap: 6px;
                align-items: center;
            }
            .tc6-upload-row .tc6-input { 
                flex: 1; 
                font-size: 10px; 
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .tc6-upload-btn {
                padding: 8px 12px;
                border-radius: 6px;
                background: var(--accent, #88c9ea);
                color: var(--button-text-on-accent, #fff);
                border: none;
                cursor: pointer;
                font-size: 11px;
                font-weight: 600;
                white-space: nowrap;
            }
            .tc6-upload-btn:hover { filter: brightness(1.1); }
            
            .tc6-clear-btn {
                padding: 8px;
                border-radius: 6px;
                background: var(--bg-button, #2a2e3e);
                color: var(--text-muted, #888);
                border: 1px solid var(--border, #444);
                cursor: pointer;
                font-size: 10px;
            }
            .tc6-clear-btn:hover { color: var(--error, #ff6b6b); border-color: var(--error, #ff6b6b); }
            
            .tc6-slider-row {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .tc6-slider-row input[type="range"] { flex: 1; cursor: pointer; }
            .tc6-slider-val {
                min-width: 40px;
                text-align: right;
                font-size: 11px;
                color: var(--text-muted, #888);
                font-weight: 600;
            }
            
            /* Preview Area */
            .tc6-preview {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                position: relative;
                background: var(--bg-ocean-dark, #0d1520);
            }
            
            .tc6-preview-hint {
                position: absolute;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.75);
                color: #fff;
                padding: 6px 14px;
                border-radius: 20px;
                font-size: 11px;
                z-index: 10;
                display: flex;
                align-items: center;
                gap: 6px;
                pointer-events: none;
            }
            .tc6-preview-hint.drag-mode {
                pointer-events: auto;
            }
            .tc6-drag-confirm-btn {
                margin-left: 8px;
                padding: 4px 12px;
                background: #4caf50;
                color: #fff;
                border: none;
                border-radius: 12px;
                font-size: 10px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                pointer-events: auto;
            }
            .tc6-drag-confirm-btn:hover {
                background: #45a049;
                transform: scale(1.05);
            }
            
            .tc6-preview-wrapper {
                flex: 1;
                margin: 16px;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.4);
                position: relative;
            }
            
            /* Live IDE Preview */
            .tc6-ide {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                position: relative;
                border-radius: 12px;
                overflow: hidden;
            }
            
            .tc6-ide-bg {
                position: absolute;
                inset: 0;
                background-size: cover;
                background-position: center;
                pointer-events: none;
                z-index: 0;
                will-change: opacity, filter;
            }
            
            .tc6-ide-content {
                position: relative;
                z-index: 1;
                flex: 1;
                display: flex;
                flex-direction: column;
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
                top: -24px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--accent, #88c9ea);
                color: #fff;
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 9px;
                font-weight: 600;
                white-space: nowrap;
                z-index: 1000;
                pointer-events: none;
            }
            
            /* Color Picker Popup - Advanced Customization */
            .tc6-color-picker {
                position: fixed;
                z-index: 100001;
                background: var(--bg-panel, #1a1e2e);
                border: 1px solid var(--border, #444);
                border-radius: 12px;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
                padding: 0;
                min-width: 280px;
                max-width: 320px;
                display: none;
                overflow: hidden;
            }
            .tc6-color-picker.visible { display: block; }
            
            .tc6-picker-tabs {
                display: flex;
                border-bottom: 1px solid var(--border, #444);
                background: var(--bg-header, #151929);
            }
            .tc6-picker-tab {
                flex: 1;
                padding: 8px 12px;
                background: transparent;
                border: none;
                color: var(--text-secondary, #aaa);
                font-size: 10px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .tc6-picker-tab:hover {
                background: var(--bg-button, #2a2e3e);
                color: var(--text-primary, #fff);
            }
            .tc6-picker-tab.active {
                background: var(--bg-panel, #1a1e2e);
                color: var(--accent, #88c9ea);
                border-bottom: 2px solid var(--accent, #88c9ea);
            }
            
            .tc6-picker-content {
                padding: 12px;
            }
            
            .tc6-picker-section {
                margin-bottom: 12px;
            }
            .tc6-picker-section:last-child {
                margin-bottom: 0;
            }
            
            .tc6-picker-section-title {
                font-size: 9px;
                font-weight: 700;
                color: var(--accent, #88c9ea);
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 8px;
            }
            
            .tc6-picker-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }
            .tc6-picker-row:last-child {
                margin-bottom: 0;
            }
            
            .tc6-picker-label {
                font-size: 10px;
                color: var(--text-secondary, #aaa);
                min-width: 60px;
                font-weight: 600;
            }
            
            .tc6-picker-control {
                flex: 1;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .tc6-picker-value {
                min-width: 45px;
                font-size: 10px;
                color: var(--text-muted, #888);
                text-align: right;
                font-weight: 600;
                font-family: 'JetBrains Mono', monospace;
            }
            
            .tc6-color-picker-inline .tc6-color-picker-header {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 11px;
                font-weight: 600;
                color: var(--text-primary, #fff);
            }
            
            .tc6-color-swatch {
                width: 20px;
                height: 20px;
                border-radius: 4px;
                border: 2px solid var(--border, #555);
                flex-shrink: 0;
            }
            
            .tc6-color-label {
                flex: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .tc6-color-picker-close {
                background: none;
                border: none;
                color: var(--text-muted, #888);
                cursor: pointer;
                padding: 2px 4px;
                font-size: 12px;
                line-height: 1;
            }
            .tc6-color-picker-close:hover { color: var(--error, #ff6b6b); }
            
            .tc6-color-input-native {
                width: 100%;
                height: 32px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 6px;
                background: transparent;
            }
            .tc6-color-input-native::-webkit-color-swatch-wrapper {
                padding: 0;
            }
            .tc6-color-input-native::-webkit-color-swatch {
                border: 1px solid var(--border, #444);
                border-radius: 4px;
            }
            
            /* Active color target highlight */
            .tc6-color-active {
                outline: 2px solid #ffcc00 !important;
                outline-offset: 2px !important;
                box-shadow: 0 0 12px rgba(255, 204, 0, 0.5) !important;
            }
            
            /* Drag mode - dim UI elements */
            .tc6-ide.tc6-drag-mode {
                cursor: grab;
            }
            .tc6-ide.tc6-drag-mode .tc6-ide-content.tc6-dimmed {
                opacity: 0.3;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }
            .tc6-ide.tc6-drag-mode .tc6-ide-bg {
                z-index: 5;
            }
            
            /* UI element styling for better visibility in drag mode */
            .tc6-ui-element {
                transition: opacity 0.2s ease, transform 0.2s ease;
            }
            
            /* Editor wrapper for background image support */
            .tc6-editor-wrapper {
                position: relative;
            }
            .tc6-editor-bg {
                will-change: opacity, filter;
            }
            
            /* Responsive */
            @media (max-width: 800px) {
                .tc6-settings { width: 220px; }
                .tc6-settings.collapsed { width: 40px; }
            }
            
            /* Save Notification */
            .tc6-save-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 100001;
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
                background: var(--bg-panel, #1a1e2e);
                border: 1px solid var(--accent, #88c9ea);
                border-radius: 12px;
                padding: 14px 18px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(136, 201, 234, 0.2);
                min-width: 280px;
            }
            
            .tc6-save-tick {
                color: var(--success, #7dcea0);
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
                color: var(--text-primary, #fff);
                font-size: 13px;
                font-weight: 600;
                flex: 1;
            }
        `;
        document.head.appendChild(style);
    },

    /**
     * Render settings panel content
     */
    _renderSettings() {
        const container = this.popup?.querySelector('#tc6-settings-content');
        if (!container) return;

        const themes = ThemeManager.getThemeList();
        const c = this.workingTheme?.colors || {};

        container.innerHTML = `
            <!-- Theme Info -->
            <div class="tc6-section">
                <div class="tc6-section-title">Theme</div>
                <div class="tc6-field">
                    <div class="tc6-field-label">Base Theme</div>
                    <select class="tc6-select" id="tc6-base-theme">
                        ${themes.map(t => `<option value="${t.id}" ${t.id === this.sourceThemeId ? 'selected' : ''}>${t.name}</option>`).join('')}
                    </select>
                </div>
                <div class="tc6-field">
                    <div class="tc6-field-label">Name</div>
                    <input type="text" class="tc6-input" id="tc6-name" value="${this._escape(this.workingTheme?.name || '')}" placeholder="My Theme">
                </div>
            </div>
            
            <!-- App Background -->
            <div class="tc6-section">
                <div class="tc6-section-title">App Background</div>
                <div class="tc6-field">
                    <div class="tc6-upload-row">
                        <input type="text" class="tc6-input" id="tc6-app-bg-url" value="" placeholder="Image URL or upload..." readonly>
                        <button class="tc6-upload-btn" id="tc6-app-bg-btn">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                        </button>
                        <button class="tc6-clear-btn" id="tc6-app-bg-clear">✕</button>
                        <input type="file" id="tc6-app-bg-file" accept="image/*" style="display:none">
                    </div>
                </div>
                <div class="tc6-field">
                    <div class="tc6-field-label">Opacity</div>
                    <div class="tc6-slider-row">
                        <input type="range" min="0" max="100" value="${c.bgOpacity ?? 50}" id="tc6-app-opacity">
                        <span class="tc6-slider-val" id="tc6-app-opacity-val">${c.bgOpacity ?? 50}%</span>
                    </div>
                </div>
                <div class="tc6-field">
                    <div class="tc6-field-label">Blur</div>
                    <div class="tc6-slider-row">
                        <input type="range" min="0" max="20" value="${c.bgBlur ?? 0}" id="tc6-app-blur">
                        <span class="tc6-slider-val" id="tc6-app-blur-val">${c.bgBlur ?? 0}px</span>
                    </div>
                </div>
            </div>
            
            <!-- Editor Background -->
            <div class="tc6-section">
                <div class="tc6-section-title">Editor Background</div>
                <div class="tc6-field">
                    <div class="tc6-upload-row">
                        <input type="text" class="tc6-input" id="tc6-editor-bg-url" value="" placeholder="Image URL or upload..." readonly>
                        <button class="tc6-upload-btn" id="tc6-editor-bg-btn">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                        </button>
                        <button class="tc6-clear-btn" id="tc6-editor-bg-clear">✕</button>
                        <input type="file" id="tc6-editor-bg-file" accept="image/*" style="display:none">
                    </div>
                </div>
                <div class="tc6-field">
                    <div class="tc6-field-label">Opacity</div>
                    <div class="tc6-slider-row">
                        <input type="range" min="0" max="100" value="${c.editorBgOpacity ?? 15}" id="tc6-editor-opacity">
                        <span class="tc6-slider-val" id="tc6-editor-opacity-val">${c.editorBgOpacity ?? 15}%</span>
                    </div>
                </div>
                <div class="tc6-field">
                    <div class="tc6-field-label">Blur</div>
                    <div class="tc6-slider-row">
                        <input type="range" min="0" max="30" value="${c.editorBgBlur ?? 0}" id="tc6-editor-blur">
                        <span class="tc6-slider-val" id="tc6-editor-blur-val">${c.editorBgBlur ?? 0}px</span>
                    </div>
                </div>
            </div>
        `;

        this._bindSettingsEvents();
        this._updateBgHints();
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

        // Backdrop click
        this.popup.addEventListener('click', (e) => {
            if (e.target === this.popup) this.close();
        });

        // ESC key
        this._escHandler = (e) => {
            if (e.key === 'Escape') {
                if (this.currentColorPicker) {
                    this._hideColorPicker();
                } else {
                    this.close();
                }
            }
        };
        document.addEventListener('keydown', this._escHandler);

        // Settings toggle
        this.popup.querySelector('#tc6-settings-toggle')?.addEventListener('click', () => {
            const settings = this.popup.querySelector('#tc6-settings');
            settings?.classList.toggle('collapsed');
        });

        // Background drag mode
        this._setupBgDrag();
    },

    /**
     * Bind settings panel events
     */
    _bindSettingsEvents() {
        const container = this.popup?.querySelector('#tc6-settings-content');
        if (!container) return;

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

                this._renderSettings();
                this._renderPreview();
            }
        });

        // Name input
        container.querySelector('#tc6-name')?.addEventListener('input', (e) => {
            this.workingTheme.name = e.target.value;
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
        const hint = this.popup?.querySelector('.tc6-preview-hint');
        if (!hint) return;

        if (this.bgDragMode) {
            const editorBg = this.popup?.querySelector('.tc6-editor-bg');
            const isEditor = editorBg && this.workingTheme?.colors?.editorBackground;
            hint.classList.add('drag-mode');
            hint.innerHTML = `
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>
                </svg>
                <span style="color: #ffcc00;">Drag Mode Active</span> - Drag to reposition ${isEditor ? 'editor' : 'app'} background
                <button class="tc6-drag-confirm-btn" id="tc6-drag-confirm">✓ Done</button>
            `;
            hint.style.background = 'rgba(255, 180, 0, 0.9)';
            hint.style.color = '#000';

            // Bind confirm button
            const confirmBtn = hint.querySelector('#tc6-drag-confirm');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => {
                    this._exitDragMode();
                });
            }
        } else {
            hint.classList.remove('drag-mode');
            hint.innerHTML = `
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                </svg>
                Click any element to change its color • Double-click background to drag
            `;
            hint.style.background = 'rgba(0, 0, 0, 0.75)';
            hint.style.color = '#fff';
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
                    <div class="tc6-clickable tc6-ui-element" data-key="bgHeader" data-label="Header Background" style="height: 32px; display: flex; align-items: center; padding: 0 10px; gap: 8px; background: ${c.bgHeader || '#1a1e2e'}; border-bottom: 1px solid ${c.border || '#333'};">
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
                            <div class="tc6-clickable tc6-ui-element" data-key="bgPanel" data-label="Problem Panel" style="height: 60px; border-radius: 6px; background: ${c.bgPanel || '#1a1e2e'}; border: 1px solid ${c.border || '#333'}; overflow: hidden; display: flex; flex-direction: column;">
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
                            <div class="tc6-clickable tc6-ui-element" data-key="bgPanel" data-label="Input Panel" style="flex: 1; background: ${c.bgPanel || '#1a1e2e'}; border: 1px solid ${c.border || '#333'}; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column;">
                                <div style="padding: 5px 8px; font-size: 9px; font-weight: 700; color: ${c.accent || '#88c9ea'}; border-bottom: 1px solid ${c.border || '#333'};">INPUT</div>
                                <div class="tc6-clickable" data-key="bgInput" data-label="Input Background" style="flex: 1; padding: 8px; font-size: 10px; color: ${c.textMuted || '#888'}; background: ${c.bgInput || '#222'}; margin: 4px; border-radius: 4px;">Nhập dữ liệu test...</div>
                            </div>
                            
                            <!-- EXPECTED Panel -->
                            <div class="tc6-clickable tc6-ui-element" data-key="bgPanel" data-label="Expected Panel" style="flex: 1; background: ${c.bgPanel || '#1a1e2e'}; border: 1px solid ${c.border || '#333'}; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column;">
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
                    <div class="tc6-clickable tc6-ui-element" data-key="bgHeader" data-label="Status Bar" style="height: 20px; display: flex; align-items: center; padding: 0 8px; gap: 6px; background: ${c.bgHeader || '#1a1e2e'}; border-top: 1px solid ${c.border || '#333'}; font-size: 9px;">
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
                if (this.bgDragMode) return; // Don't open color picker in drag mode
                const key = el.dataset.key;
                const label = el.dataset.label || key;
                this._showColorPicker(key, label, el);
            });
        });
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
        // Elements that can have borders
        const borderableKeys = ['bgPanel', 'bgInput', 'editorBg', 'bgHeader'];
        return borderableKeys.includes(key);
    },

    /**
     * Get opacity for a color key
     */
    _getOpacity(key) {
        // Some colors might have opacity stored separately
        const c = this.workingTheme?.colors || {};
        const opacityKey = key + 'Opacity';
        return c[opacityKey];
    },

    /**
     * Set opacity for a color key
     */
    _setOpacity(key, value) {
        if (!this.workingTheme.colors) this.workingTheme.colors = {};
        const opacityKey = key + 'Opacity';
        this.workingTheme.colors[opacityKey] = value;
    },

    /**
     * Update preview without full re-render (preserves editor background)
     */
    _updatePreviewWithoutRerender(key) {
        // Update only the specific element instead of full re-render
        const elements = this.popup?.querySelectorAll(`[data-key="${key}"]`);
        if (!elements || elements.length === 0) {
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

            // Show success notification
            this._showSaveNotification(`Theme "${name}" đã được cập nhật thành công!`);

            // Don't close - keep customizer open for further edits
        } else {
            alert('Failed to save theme');
        }
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

    _getColor(key) {
        const c = this.workingTheme?.colors || {};

        if (c[key]) return c[key];

        if (key.startsWith('syntax')) {
            const syntaxKey = key.replace('syntax', '').toLowerCase();
            const color = this.workingTheme?.editor?.syntax?.[syntaxKey]?.color;
            return color ? (color.startsWith('#') ? color : '#' + color) : '#888888';
        }

        if (key === 'editorBg') {
            return this.workingTheme?.editor?.background || c.editorBg || '#1e1e1e';
        }

        return '#888888';
    },

    _setColor(key, value) {
        if (!this.workingTheme) return;
        if (!this.workingTheme.colors) this.workingTheme.colors = {};

        if (key.startsWith('syntax')) {
            const syntaxKey = key.replace('syntax', '').toLowerCase();
            if (!this.workingTheme.editor) this.workingTheme.editor = { syntax: {} };
            if (!this.workingTheme.editor.syntax) this.workingTheme.editor.syntax = {};
            if (!this.workingTheme.editor.syntax[syntaxKey]) this.workingTheme.editor.syntax[syntaxKey] = {};
            this.workingTheme.editor.syntax[syntaxKey].color = value.replace('#', '');
        } else if (key === 'editorBg') {
            if (!this.workingTheme.editor) this.workingTheme.editor = {};
            this.workingTheme.editor.background = value;
            this.workingTheme.colors.editorBg = value;
        } else {
            this.workingTheme.colors[key] = value;
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
    }
};

window.ThemeCustomizer = ThemeCustomizer;
