// ============================================================================
// C++ & C INTELLISENSE & SNIPPETS (COMPACT CP STYLE)
// ============================================================================

window.registerCppIntellisense = function (monaco) {
    console.log('[Intellisense] Registering C/C++ CP provider (Compact & Context Aware)...');

    // ------------------------------------------------------------------------
    // 1. DATA: HEAVY TEMPLATES (Các mẫu code dài)
    // ------------------------------------------------------------------------
    const CP_TEMPLATES = [
        {
            label: 'cp',
            documentation: 'Full Competitive Programming Template',
            insertText: [
                '#include<bits/stdc++.h>',
                'using namespace std;',
                '',
                'using ll = long long;',
                '',
                'void solve(){',
                '    ${1:// Your code here}',
                '}',
                '',
                'int main(){',
                '    ios_base::sync_with_stdio(false);',
                '    cin.tie(NULL);',
                '    int t=1;',
                '    // cin>>t;',
                '    while(t--){',
                '        solve();',
                '    }',
                '    return 0;',
                '}'
            ].join('\n')
        },
        {
            label: 'main',
            documentation: 'Standard Main Function',
            insertText: 'int main(){\n    ${1}\n    return 0;\n}'
        }
    ];

    // ------------------------------------------------------------------------
    // 2. DATA: UTILITY SNIPPETS (Tối ưu khoảng trắng - Compact Style)
    // ------------------------------------------------------------------------
    const UTIL_SNIPPETS = [
        // Control Flow (Compact)
        { label: 'for', doc: 'Loop: for(int i=0; i<n; i++)', text: 'for(int ${1:i}=0; ${1:i}<${2:n}; ${1:i}++){\n    ${3}\n}' },
        { label: 'ford', doc: 'Loop: for(int i=n-1; i>=0; i--)', text: 'for(int ${1:i}=${2:n}-1; ${1:i}>=0; ${1:i}--){\n    ${3}\n}' },
        { label: 'while', doc: 'Loop: while(cond)', text: 'while(${1:condition}){\n    ${2}\n}' },
        { label: 'if', doc: 'Condition: if(cond)', text: 'if(${1:condition}){\n    ${2}\n}' },
        { label: 'ifelse', doc: 'Condition: if(cond) else', text: 'if(${1:condition}){\n    ${2}\n}else{\n    ${3}\n}' },
        
        // I/O (Compact)
        { label: 'cout', doc: 'Output: cout<<...<<\'\\n\'', text: 'cout<<${1}<<\'\\n\';' },
        { label: 'cin', doc: 'Input: cin>>...', text: 'cin>>${1};' },
        { label: 'test', doc: 'Input: Test case loop', text: 'int t; cin>>t; while(t--){\n    ${1}\n}' },

        // CP Utilities (Compact)
        { label: 'all', doc: 'Iterator: v.begin(),v.end()', text: '${1:v}.begin(),${1:v}.end()' },
        { label: 'sort', doc: 'Algorithm: sort(all(v))', text: 'sort(${1:v}.begin(),${1:v}.end());' },
        { label: 'pb', doc: 'Vector: push_back', text: 'push_back(${1})' },
        { label: 'mp', doc: 'Pair: make_pair', text: 'make_pair(${1},${2})' }
    ];

    // ------------------------------------------------------------------------
    // 3. LOGIC: PROVIDER GENERATOR
    // ------------------------------------------------------------------------
    const createDependencyProposals = (range, languageId, textUntilPosition) => {
        const suggestions = [];
        
        // Settings Access
        const settings = (typeof App !== 'undefined' && App.settings && App.settings.editor) ? App.settings.editor : {};
        const userSnippetsConfig = (typeof App !== 'undefined' && App.settings && App.settings.snippets) ? App.settings.snippets : [];

        // Flags Check
        const isEnabled = settings.intellisense !== false;
        const enableKeywords = isEnabled && (settings.keywords !== false);
        const enableBuiltinSnippets = isEnabled && (settings.builtinSnippets !== false);
        const enableCustomSnippets = isEnabled && (settings.snippets !== false);

        if (!isEnabled) return { suggestions: [] };

        // --- CONTEXT CHECK ---
        // Kiểm tra xem con trỏ có đang nằm trong #include không (ví dụ: #include <... hoặc #include "...)
        // Regex: Tìm chuỗi bắt đầu bằng #include, theo sau là khoảng trắng tùy ý, rồi đến dấu < hoặc ", rồi đến các ký tự tên file
        const insideInclude = /#include\s*[<"]\s*[a-zA-Z0-9_\/.\-]*$/.test(textUntilPosition);

        // A. KEYWORDS & HEADERS & MACROS
        if (enableKeywords) {
            const cKeywords = ['auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while'];
            const cppKeywords = ['alignas', 'alignof', 'and', 'and_eq', 'asm', 'bitand', 'bitor', 'bool', 'catch', 'char16_t', 'char32_t', 'class', 'compl', 'constexpr', 'const_cast', 'delete', 'dynamic_cast', 'explicit', 'export', 'false', 'friend', 'inline', 'mutable', 'namespace', 'new', 'noexcept', 'not', 'not_eq', 'nullptr', 'operator', 'or', 'or_eq', 'private', 'protected', 'public', 'reinterpret_cast', 'static_assert', 'static_cast', 'template', 'this', 'thread_local', 'throw', 'true', 'try', 'typeid', 'typename', 'using', 'virtual', 'wchar_t', 'xor', 'xor_eq'];
            const cpShortcuts = ['ll', 'ull', 'pb', 'mp', 'fi', 'se', 'vi', 'vll', 'pii', 'pll'];
            const cpFunctions = ['sort', 'reverse', 'min', 'max', 'abs', 'sqrt', 'pow', 'lower_bound', 'upper_bound', 'binary_search', 'memset', 'memcpy', 'push_back', 'emplace_back', 'pop_back', 'front', 'back', 'top', 'empty', 'size', 'begin', 'end', 'rbegin', 'rend', 'clear', 'insert', 'erase', 'find', 'count', '__gcd', '__builtin_popcount', '__builtin_popcountll', '__builtin_clz', '__builtin_ctz'];
            
            // HEADERS LIST
            const headers = ['stdio.h', 'stdlib.h', 'string.h', 'math.h'];
            const cppHeaders = ['bits/stdc++.h', 'iostream', 'vector', 'string', 'algorithm', 'map', 'set', 'queue', 'stack', 'deque', 'cmath', 'cstdio', 'climits', 'cstring', 'iomanip'];

            if (insideInclude) {
                // 1. Đang trong #include <...>: Chỉ gợi ý tên thư viện
                headers.forEach(h => suggestions.push({ 
                    label: h, 
                    kind: monaco.languages.CompletionItemKind.File, 
                    insertText: h, 
                    range: range 
                }));
                if (languageId === 'cpp') {
                    cppHeaders.forEach(h => suggestions.push({ 
                        label: h, 
                        kind: monaco.languages.CompletionItemKind.File, 
                        insertText: h, 
                        range: range 
                    }));
                }
            } else {
                // 2. Code bình thường: Gợi ý Keywords, CP Shortcuts, Full #include
                
                // Keywords
                cKeywords.forEach(k => suggestions.push({ label: k, kind: monaco.languages.CompletionItemKind.Keyword, insertText: k, range: range }));
                if (languageId === 'cpp') {
                    cppKeywords.forEach(k => suggestions.push({ label: k, kind: monaco.languages.CompletionItemKind.Keyword, insertText: k, range: range }));
                    cpShortcuts.forEach(k => suggestions.push({ label: k, kind: monaco.languages.CompletionItemKind.Constant, insertText: k, detail: 'CP Type', range: range }));
                    cpFunctions.forEach(f => suggestions.push({ label: f, kind: monaco.languages.CompletionItemKind.Function, insertText: f, range: range }));
                }

                // Full Includes (cho lúc mới gõ #in...)
                headers.forEach(h => suggestions.push({ label: `#include<${h}>`, kind: monaco.languages.CompletionItemKind.Module, insertText: `#include<${h}>`, range: range }));
                if (languageId === 'cpp') {
                    cppHeaders.forEach(h => suggestions.push({ label: `#include<${h}>`, kind: monaco.languages.CompletionItemKind.Module, insertText: `#include<${h}>`, range: range }));
                }
            }
        }

        // B. BUILT-IN SNIPPETS (Chỉ hiện khi KHÔNG ở trong #include)
        if (enableBuiltinSnippets && !insideInclude) {
            if (languageId === 'cpp') {
                CP_TEMPLATES.forEach(s => {
                    suggestions.push({
                        label: s.label, kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: s.insertText, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: s.documentation, detail: 'Template', range: range
                    });
                });
                UTIL_SNIPPETS.forEach(s => {
                    suggestions.push({
                        label: s.label, kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: s.text, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: s.doc, detail: 'Snippet', range: range
                    });
                });
            } else {
                 // C Snippets
                 [{ label: 'main', text: 'int main(){\n    ${1}\n    return 0;\n}' }, { label: 'printf', text: 'printf("${1:%d}\\n",${2});' }]
                 .forEach(s => suggestions.push({
                    label: s.label, kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: s.text, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    range: range
                 }));
            }
        }

        // C. CUSTOM SNIPPETS (Chỉ hiện khi KHÔNG ở trong #include)
        if (enableCustomSnippets && !insideInclude) {
            userSnippetsConfig.forEach(s => {
                if (s.trigger && s.content) {
                    suggestions.push({
                        label: s.trigger, kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: s.content, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: s.name || 'User Snippet', detail: 'Custom', range: range
                    });
                }
            });
        }

        return { suggestions: suggestions };
    };

    // ------------------------------------------------------------------------
    // 4. REGISTRATION
    // ------------------------------------------------------------------------
    monaco.languages.registerCompletionItemProvider('cpp', {
        triggerCharacters: ['<', '/', '"', '#', '.'], // QUAN TRỌNG: Kích hoạt khi gõ các ký tự này
        provideCompletionItems: (model, position) => {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
                startColumn: word.startColumn, endColumn: word.endColumn
            };
            
            // Lấy nội dung từ đầu dòng đến con trỏ để check ngữ cảnh (#include hay không)
            const textUntilPosition = model.getValueInRange({
                startLineNumber: position.lineNumber, 
                startColumn: 1, 
                endLineNumber: position.lineNumber, 
                endColumn: position.column
            });

            return createDependencyProposals(range, 'cpp', textUntilPosition);
        }
    });

    monaco.languages.registerCompletionItemProvider('c', {
        triggerCharacters: ['<', '/', '"', '#', '.'],
        provideCompletionItems: (model, position) => {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
                startColumn: word.startColumn, endColumn: word.endColumn
            };
            const textUntilPosition = model.getValueInRange({
                startLineNumber: position.lineNumber, startColumn: 1, 
                endLineNumber: position.lineNumber, endColumn: position.column
            });
            return createDependencyProposals(range, 'c', textUntilPosition);
        }
    });
};