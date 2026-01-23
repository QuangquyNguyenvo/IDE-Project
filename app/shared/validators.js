/**
 * Sameko Dev C++ IDE - Input Validators
 * Shared validation functions for both Main and Renderer processes
 * @module shared/validators
 */

'use strict';

const { LIMITS, COMPILER } = require('./constants');

/**
 * Validate file path
 * @param {string} filePath - Path to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        return { valid: false, error: 'File path is required' };
    }

    if (filePath.length > 260) {
        return { valid: false, error: 'File path too long (max 260 characters)' };
    }

    // Check for invalid characters (Windows)
    const invalidChars = /[<>"|?*]/;
    if (invalidChars.test(filePath)) {
        return { valid: false, error: 'File path contains invalid characters' };
    }

    return { valid: true };
}

/**
 * Validate file extension is a C++ source file
 * @param {string} filePath - Path to check
 * @returns {boolean}
 */
function isCppFile(filePath) {
    if (!filePath) return false;
    const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
    return COMPILER.FILE_EXTENSIONS.includes(ext);
}

/**
 * Validate compiler flags
 * @param {string} flags - Compiler flags string
 * @returns {{ valid: boolean, error?: string, sanitized: string }}
 */
function validateCompilerFlags(flags) {
    if (!flags || typeof flags !== 'string') {
        return { valid: true, sanitized: COMPILER.DEFAULT_FLAGS };
    }

    // Remove potentially dangerous flags
    const dangerousPatterns = [
        /-B/,           // Change compiler search path
        /-plugin/,      // Load plugins
        /@/,            // Response files (could load arbitrary files)
        /--specs=/,     // Override specs
    ];

    let sanitized = flags;
    for (const pattern of dangerousPatterns) {
        if (pattern.test(flags)) {
            return {
                valid: false,
                error: 'Compiler flags contain potentially unsafe options',
                sanitized: COMPILER.DEFAULT_FLAGS
            };
        }
    }

    // Limit length
    if (sanitized.length > 500) {
        sanitized = sanitized.substring(0, 500);
    }

    return { valid: true, sanitized: sanitized.trim() };
}

/**
 * Validate file content size
 * @param {string} content - File content
 * @returns {{ valid: boolean, error?: string }}
 */
function validateFileSize(content) {
    if (!content) {
        return { valid: true };
    }

    const sizeKB = Buffer.byteLength(content, 'utf8') / 1024;
    if (sizeKB > LIMITS.MAX_FILE_SIZE_KB) {
        return {
            valid: false,
            error: `File too large (${sizeKB.toFixed(1)}KB). Maximum: ${LIMITS.MAX_FILE_SIZE_KB}KB`
        };
    }

    return { valid: true };
}

/**
 * Validate theme ID
 * @param {string} themeId - Theme identifier
 * @returns {{ valid: boolean, error?: string }}
 */
function validateThemeId(themeId) {
    if (!themeId || typeof themeId !== 'string') {
        return { valid: false, error: 'Theme ID is required' };
    }

    // Theme IDs should be alphanumeric with hyphens/underscores
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(themeId)) {
        return { valid: false, error: 'Invalid theme ID format' };
    }

    if (themeId.length > 50) {
        return { valid: false, error: 'Theme ID too long (max 50 characters)' };
    }

    return { valid: true };
}

/**
 * Validate snippet data
 * @param {Object} snippet - Snippet object
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSnippet(snippet) {
    if (!snippet || typeof snippet !== 'object') {
        return { valid: false, error: 'Snippet data is required' };
    }

    if (!snippet.name || typeof snippet.name !== 'string' || snippet.name.length > 100) {
        return { valid: false, error: 'Invalid snippet name' };
    }

    if (!snippet.prefix || typeof snippet.prefix !== 'string' || snippet.prefix.length > 50) {
        return { valid: false, error: 'Invalid snippet prefix' };
    }

    if (!snippet.body || typeof snippet.body !== 'string') {
        return { valid: false, error: 'Snippet body is required' };
    }

    // Body size limit (10KB)
    if (snippet.body.length > 10240) {
        return { valid: false, error: 'Snippet body too large (max 10KB)' };
    }

    return { valid: true };
}

/**
 * Validate test case data
 * @param {Object} testCase - Test case object
 * @returns {{ valid: boolean, error?: string }}
 */
function validateTestCase(testCase) {
    if (!testCase || typeof testCase !== 'object') {
        return { valid: false, error: 'Test case data is required' };
    }

    if (typeof testCase.input !== 'string') {
        return { valid: false, error: 'Test input is required' };
    }

    if (typeof testCase.expectedOutput !== 'string') {
        return { valid: false, error: 'Expected output is required' };
    }

    // Size limits
    const maxSizeKB = 64;
    if (testCase.input.length > maxSizeKB * 1024) {
        return { valid: false, error: `Test input too large (max ${maxSizeKB}KB)` };
    }

    if (testCase.expectedOutput.length > maxSizeKB * 1024) {
        return { valid: false, error: `Expected output too large (max ${maxSizeKB}KB)` };
    }

    return { valid: true };
}

/**
 * Sanitize user input for display (prevent XSS in renderer)
 * @param {string} input - User input
 * @returns {string} Sanitized string
 */
function sanitizeForDisplay(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }

    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Export for Node.js
module.exports = {
    validateFilePath,
    isCppFile,
    validateCompilerFlags,
    validateFileSize,
    validateThemeId,
    validateSnippet,
    validateTestCase,
    sanitizeForDisplay,
};
