window.registerCppIntellisense = function (monaco) {
    console.log('[Intellisense] Registering C/C++ Provider (Full STL Support)...');

    // ========================================================================
    // 1. DATA: SNIPPETS & TEMPLATES
    // ========================================================================
    const SNIPPETS = {
        cpp: [
            { 
                label: 'cp', doc: 'CP Template', 
                text: '#include <bits/stdc++.h>\nusing namespace std;\n\nusing ll = long long;\n\nvoid solve(){\n    ${0}\n}\n\nint main(){\n    ios_base::sync_with_stdio(false); cin.tie(NULL);\n    int t=1; cin >> t;\n    while(t--) solve();\n    return 0;\n}' 
            },
            { label: 'cout', doc: 'Output', text: 'cout << ${1} << "\\n";' },
            { label: 'cin', doc: 'Input', text: 'cin >> ${1};' },
            { label: 'all', doc: 'Range', text: '${1:v}.begin(), ${1:v}.end()' },
            { label: 'rall', doc: 'Reverse Range', text: '${1:v}.rbegin(), ${1:v}.rend()' }, // Thêm cái này tiện sort ngược
            { label: 'sz', doc: 'Size', text: '${1:v}.size()' }
        ],
        c: [
            { label: 'main', doc: 'Main C', text: 'int main(){\n    ${0}\n    return 0;\n}' },
            { label: 'printf', doc: 'Print', text: 'printf("${1:%d}\\n", ${2});' },
            { label: 'scanf', doc: 'Scan', text: 'scanf("${1:%d}", &${2});' }
        ],
        common: [
            // Loop xuôi (0 -> n-1)
            { label: 'for', doc: 'Loop 0 -> n-1', text: 'for(int ${1:i}=0; ${1:i}<${2:n}; ${1:i}++){\n    ${0}\n}' },
            // Loop xuôi (1 -> n)
            { label: 'for1', doc: 'Loop 1 -> n', text: 'for(int ${1:i}=1; ${1:i}<=${2:n}; ${1:i}++){\n    ${0}\n}' },
            // Loop ngược (n-1 -> 0) -> ĐÃ BỔ SUNG
            { label: 'ford', doc: 'Loop n-1 -> 0', text: 'for(int ${1:i}=${2:n}-1; ${1:i}>=0; ${1:i}--){\n    ${0}\n}' },
            
            { label: 'while', doc: 'While', text: 'while(${1:cond}){\n    ${0}\n}' },
            { label: 'if', doc: 'If', text: 'if(${1:cond}){\n    ${0}\n}' },
            { label: 'ifelse', doc: 'If-Else', text: 'if(${1:cond}){\n    ${2}\n}else{\n    ${0}\n}' }
        ]
    };

    // ========================================================================
    // 2. DATA: STL METHODS & DOCUMENTATION (Phần bạn cần nhất)
    // ========================================================================
    // List này dùng để gợi ý khi gõ code và hiển thị document/signature
    const STL_DOCS = {
        // --- Vector / String / Deque Modifications ---
        'push_back': { type: 'Method', detail: 'void push_back(val)', doc: 'Add element to the end.' },
        'emplace_back': { type: 'Method', detail: 'void emplace_back(args...)', doc: 'Construct and add element to the end.' },
        'pop_back': { type: 'Method', detail: 'void pop_back()', doc: 'Remove the last element.' },
        'resize': { type: 'Method', detail: 'void resize(n, val)', doc: 'Resize container to contain n elements.' },
        'assign': { type: 'Method', detail: 'void assign(n, val)', doc: 'Assign new content to container.' },
        'clear': { type: 'Method', detail: 'void clear()', doc: 'Remove all elements.' },
        
        // --- Insert / Erase (Quan trọng) ---
        'erase': { type: 'Method', detail: 'iterator erase(pos)', doc: 'Remove element at position/range.\nEx: v.erase(v.begin() + 1);' },
        'insert': { type: 'Method', detail: 'iterator insert(pos, val)', doc: 'Insert element before pos.' },
        
        // --- Access ---
        'front': { type: 'Method', detail: 'T& front()', doc: 'Access first element.' },
        'back': { type: 'Method', detail: 'T& back()', doc: 'Access last element.' },
        'at': { type: 'Method', detail: 'T& at(idx)', doc: 'Access element with bounds checking.' },
        
        // --- String Specific ---
        'substr': { type: 'Method', detail: 'string substr(pos, len)', doc: 'Generate substring.' },
        'length': { type: 'Method', detail: 'size_t length()', doc: 'Return string length.' },
        'c_str': { type: 'Method', detail: 'const char* c_str()', doc: 'Return C-style string array.' },
        'append': { type: 'Method', detail: 'string& append(str)', doc: 'Append to string.' },
        
        // --- Map / Set / Finders ---
        'find': { type: 'Method', detail: 'iterator find(key)', doc: 'Search for an element.' },
        'count': { type: 'Method', detail: 'size_t count(key)', doc: 'Count elements with key (1 or 0 for set).' },
        'lower_bound': { type: 'Method', detail: 'iterator lower_bound(key)', doc: 'First element NOT less than key (>=).' },
        'upper_bound': { type: 'Method', detail: 'iterator upper_bound(key)', doc: 'First element greater than key (>).' },
        
        // --- Stack / Queue / PQ ---
        'push': { type: 'Method', detail: 'void push(val)', doc: 'Insert element.' },
        'pop': { type: 'Method', detail: 'void pop()', doc: 'Remove top element.' },
        'top': { type: 'Method', detail: 'T& top()', doc: 'Access top element.' },
        'empty': { type: 'Method', detail: 'bool empty()', doc: 'Check if container is empty.' },
        
        // --- Algorithms & Utils ---
        'sort': { type: 'Func', detail: 'sort(begin, end)', doc: 'Sort range.' },
        'reverse': { type: 'Func', detail: 'reverse(begin, end)', doc: 'Reverse range.' },
        'memset': { type: 'Func', detail: 'memset(ptr, val, size)', doc: 'Fill memory.' },
        'memcpy': { type: 'Func', detail: 'memcpy(dest, src, size)', doc: 'Copy memory.' },
        '__gcd': { type: 'Func', detail: '__gcd(a, b)', doc: 'Greatest Common Divisor.' },
        'min': { type: 'Func', detail: 'min(a, b)', doc: 'Return smaller value.' },
        'max': { type: 'Func', detail: 'max(a, b)', doc: 'Return larger value.' },
        'swap': { type: 'Func', detail: 'swap(a, b)', doc: 'Swap two values.' }
    };

    // Tạo danh sách keys từ STL_DOCS để dùng cho suggestion loop
    const STL_KEYWORDS = Object.keys(STL_DOCS);

    // Headers
    const HEADERS = {
        c: ['stdio.h', 'stdlib.h', 'string.h', 'math.h', 'windows.h', 'conio.h'],
        cpp: ['bits/stdc++.h', 'iostream', 'vector', 'algorithm', 'map', 'set', 'string', 'queue', 'stack', 'iomanip']
    };

    // ========================================================================
    // 3. LOGIC PROVIDER
    // ========================================================================
    const createProposals = (range, languageId, textUntilPosition) => {
        const suggestions = [];
        const insideInclude = /#include\s*[<"]\s*$/.test(textUntilPosition);
        const insideParentheses = /\([^\)]*$/.test(textUntilPosition);

        // --- 1. HEADERS ---
        if (insideInclude) {
            let hList = [...HEADERS.c];
            if (languageId === 'cpp') hList = [...hList, ...HEADERS.cpp];
            hList.forEach(h => suggestions.push({ 
                label: h, kind: monaco.languages.CompletionItemKind.File, insertText: h, range: range 
            }));
            return { suggestions };
        }

        // --- 2. SNIPPETS (Bị chặn nếu ở trong ngoặc) ---
        if (!insideParentheses) {
            // Common (for, ford, while...)
            SNIPPETS.common.forEach(s => suggestions.push({
                label: s.label, kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: s.text, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: s.doc, range: range
            }));
            // Lang specific
            const langSnippets = (languageId === 'cpp') ? SNIPPETS.cpp : SNIPPETS.c;
            langSnippets.forEach(s => suggestions.push({
                label: s.label, kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: s.text, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: s.doc, range: range
            }));
        }

        // --- 3. KEYWORDS & STL METHODS (Luôn hiện) ---
        // Các từ khóa cơ bản
        ['int', 'long', 'void', 'char', 'bool', 'return', 'break', 'continue', 'struct', 'const'].forEach(k => {
             suggestions.push({ label: k, kind: monaco.languages.CompletionItemKind.Keyword, insertText: k, range: range });
        });

        if (languageId === 'cpp') {
            // CP Shortcuts
            ['ll', 'pb', 'mp', 'fi', 'se', 'vi', 'pii'].forEach(k => {
                suggestions.push({ label: k, kind: monaco.languages.CompletionItemKind.Constant, insertText: k, range: range });
            });
            // STL Methods (erase, find, insert, substr...) -> Gợi ý dưới dạng Method
            STL_KEYWORDS.forEach(k => {
                const info = STL_DOCS[k];
                // Nếu là Function (như sort) thì dùng Function, Method (như erase) dùng Method
                const kind = (info.type === 'Func') 
                    ? monaco.languages.CompletionItemKind.Function 
                    : monaco.languages.CompletionItemKind.Method;
                
                suggestions.push({
                    label: k,
                    kind: kind,
                    insertText: k,
                    documentation: info.doc, // Hiện doc luôn ở suggestion
                    detail: info.detail,     // Hiện signature ở suggestion
                    range: range
                });
            });
        }

        return { suggestions };
    };

    // ========================================================================
    // 4. REGISTRATION (HOVER & SIGNATURE)
    // ========================================================================
    const registerFeatures = (lang) => {
        // Completion
        monaco.languages.registerCompletionItemProvider(lang, {
            triggerCharacters: ['<', '/', '"', '#', '.', '>'], // Thêm dấu . và > để kích hoạt khi gõ v. hoặc ->
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
                const textUntilPosition = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column });
                return createProposals(range, lang, textUntilPosition);
            }
        });

        // Hover
        monaco.languages.registerHoverProvider(lang, {
            provideHover: (model, position) => {
                const word = model.getWordAtPosition(position);
                if (!word) return null;
                const item = STL_DOCS[word.word];
                if (item) {
                    return {
                        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                        contents: [{ value: `**${item.type}:** \`${item.detail}\`` }, { value: item.doc }]
                    };
                }
                return null;
            }
        });

        // Signature Help
        monaco.languages.registerSignatureHelpProvider(lang, {
            signatureHelpTriggerCharacters: ['(', ','],
            provideSignatureHelp: (model, position) => {
                const textUntilPosition = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column });
                // Regex bắt tên hàm: erase(..), insert(..), sort(..)
                const match = textUntilPosition.match(/([a-zA-Z0-9_]+)\s*\($|([a-zA-Z0-9_]+)\s*\([^)]*,/);
                if (!match) return null;
                const funcName = match[1] || match[2];
                const info = STL_DOCS[funcName];
                if (info) {
                    return {
                        value: {
                            signatures: [{ label: info.detail, documentation: info.doc, parameters: [] }],
                            activeSignature: 0, activeParameter: 0
                        },
                        dispose: () => {}
                    };
                }
                return null;
            }
        });
    }

    registerFeatures('cpp');
    registerFeatures('c');
};