/**
 * Sameko Dev C++ IDE - Tree-sitter Syntax Parser
 * Fast syntax checking using Tree-sitter C++ parser
 * @module app/services/syntax/tree-sitter
 */

'use strict';

// ============================================================================
// STATE
// ============================================================================

/** @type {Object|null} */
let parser = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize Tree-sitter parser
 * @returns {boolean} Whether initialization succeeded
 */
function initTreeSitter() {
    if (parser) return true;

    try {
        const Parser = require('tree-sitter');
        const Cpp = require('tree-sitter-cpp');
        parser = new Parser();
        parser.setLanguage(Cpp);
        console.log('[TreeSitter] Initialized successfully');
        return true;
    } catch (e) {
        console.log('[TreeSitter] Not available:', e.message);
        return false;
    }
}

/**
 * Get parser instance
 * @returns {Object|null}
 */
function getParser() {
    return parser;
}

/**
 * Check if Tree-sitter is available
 * @returns {boolean}
 */
function isAvailable() {
    return parser !== null;
}

// ============================================================================
// PARSING
// ============================================================================

/**
 * Parse C++ code and find syntax errors
 * @param {string} content - Source code
 * @returns {import('../../../shared/types').SyntaxError[]}
 */
function checkSyntax(content) {
    if (!parser) {
        initTreeSitter();
    }

    if (!parser) {
        return [];
    }

    const diagnostics = [];

    try {
        const tree = parser.parse(content);

        /**
         * Traverse AST to find errors
         * @param {Object} node
         */
        const traverse = (node) => {
            // node.hasError is a property in native bindings
            if (node.hasError || node.type === 'ERROR') {
                if (node.type === 'ERROR') {
                    // Check if it has meaningful text
                    if (node.text && node.text.trim()) {
                        diagnostics.push({
                            line: node.startPosition.row + 1,
                            column: node.startPosition.column + 1,
                            severity: 'error',
                            message: `Unexpected '${node.text.substring(0, 30)}${node.text.length > 30 ? '...' : ''}'`,
                            source: 'treesitter'
                        });
                    }
                } else if (node.isMissing) {
                    // Missing token
                    diagnostics.push({
                        line: node.startPosition.row + 1,
                        column: node.startPosition.column + 1,
                        severity: 'error',
                        message: `Missing ${node.type}`,
                        source: 'treesitter'
                    });
                }

                // Continue traversing children
                for (let i = 0; i < node.childCount; i++) {
                    traverse(node.child(i));
                }
            }
        };

        traverse(tree.rootNode);
    } catch (e) {
        console.log('[TreeSitter] Parse error:', e.message);
    }

    return diagnostics;
}

/**
 * Parse and return AST (for advanced usage)
 * @param {string} content
 * @returns {Object|null}
 */
function parse(content) {
    if (!parser) {
        initTreeSitter();
    }

    if (!parser) {
        return null;
    }

    try {
        return parser.parse(content);
    } catch (e) {
        console.log('[TreeSitter] Parse error:', e.message);
        return null;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    initTreeSitter,
    getParser,
    isAvailable,
    checkSyntax,
    parse,
};
