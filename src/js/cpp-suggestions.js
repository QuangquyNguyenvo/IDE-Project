
// ============================================================================
// C++ INTELLISENSE & SNIPPETS
// Respects App.settings.editor.keywords and App.settings.editor.snippets
// ============================================================================
window.registerCppIntellisense = function (monaco) {
    console.log('[Intellisense] Registering C++ provider...');

    monaco.languages.registerCompletionItemProvider('cpp', {
        provideCompletionItems: (model, position) => {
            const suggestions = [];

            // Check settings dynamically
            const isIntellisenseEnabled = typeof App !== 'undefined' && App.settings && App.settings.editor ? App.settings.editor.intellisense !== false : true;
            const enableKeywords = isIntellisenseEnabled && (typeof App !== 'undefined' && App.settings && App.settings.editor ? App.settings.editor.keywords !== false : true);
            const enableSnippets = typeof App !== 'undefined' && App.settings && App.settings.editor ? App.settings.editor.snippets !== false : true;

            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            // 1. Keywords (only if enabled)
            if (enableKeywords) {
                const keywords = [
                    'alignas', 'alignof', 'and', 'and_eq', 'asm', 'atomic_cancel', 'atomic_commit', 'atomic_noexcept',
                    'auto', 'bitand', 'bitor', 'bool', 'break', 'case', 'catch', 'char', 'char16_t', 'char32_t',
                    'class', 'compl', 'concept', 'const', 'constexpr', 'const_cast', 'continue', 'decltype', 'default',
                    'delete', 'do', 'double', 'dynamic_cast', 'else', 'enum', 'explicit', 'export', 'extern', 'false',
                    'float', 'for', 'friend', 'goto', 'if', 'import', 'inline', 'int', 'long', 'module', 'mutable',
                    'namespace', 'new', 'noexcept', 'not', 'not_eq', 'nullptr', 'operator', 'or', 'or_eq', 'private',
                    'protected', 'public', 'register', 'reinterpret_cast', 'requires', 'return', 'short', 'signed',
                    'sizeof', 'static', 'static_assert', 'static_cast', 'struct', 'switch', 'synchronized', 'template',
                    'this', 'thread_local', 'throw', 'true', 'try', 'typedef', 'typeid', 'typename', 'union', 'unsigned',
                    'using', 'virtual', 'void', 'volatile', 'wchar_t', 'while', 'xor', 'xor_eq'
                ];
                keywords.forEach(k => {
                    suggestions.push({
                        label: k,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: k,
                        range: range
                    });
                });

                // STL Containers & Common Classes
                const classes = [
                    'vector', 'string', 'map', 'set', 'unordered_map', 'unordered_set', 'queue', 'stack', 'deque',
                    'priority_queue', 'pair', 'tuple', 'list', 'bitset', 'complex', 'array', 'ios_base', 'cin', 'cout', 'cerr'
                ];
                classes.forEach(c => {
                    suggestions.push({
                        label: c,
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: c,
                        range: range
                    });
                });

                // Common Functions / Algorithms
                const funcs = [
                    'sort', 'reverse', 'min', 'max', 'abs', 'sqrt', 'pow', 'lower_bound', 'upper_bound', 'binary_search',
                    'memset', 'memcpy', 'push_back', 'emplace_back', 'pop_back', 'front', 'back', 'top', 'empty', 'size',
                    'begin', 'end', 'rbegin', 'rend', 'clear', 'insert', 'erase', 'find', 'count'
                ];
                funcs.forEach(f => {
                    suggestions.push({
                        label: f,
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: f,
                        range: range
                    });
                });
            }

            // 2. Snippets (only if enabled)
            if (enableSnippets) {
                // Load from user settings if available
                const userSnippets = (typeof App !== 'undefined' && App.settings && App.settings.snippets) ? App.settings.snippets : [];

                userSnippets.forEach(s => {
                    if (s.trigger && s.content) {
                        suggestions.push({
                            label: s.trigger,
                            kind: monaco.languages.CompletionItemKind.Snippet,
                            insertText: s.content,
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: s.name || 'Custom Snippet',
                            range: range
                        });
                    }
                });
            }

            return { suggestions: suggestions };
        }
    });

    // Register for C language too
    monaco.languages.registerCompletionItemProvider('c', {
        provideCompletionItems: (model, position) => {
            // Same logic, reuse
            return monaco.languages.getCompletionItemProvider('cpp')[0].provideCompletionItems(model, position);
        }
    });
};
