# Bundling MinGW/GCC into the IDE

How to bundle the compiler so users don't need to install anything — just download, extract, and run!

---

## Overview

Sameko IDE uses **Sameko-GCC** — a GCC 16 build optimized for competitive programming:
- Pre-configured `bits/stdc++.h`  
- Supports C++98/11/14/17/20/23/26
- Optimized for Windows 10/11


---

## Step 1: Download the Compiler

### Option A: From GitHub Releases (Recommended)
1. Go to [Releases Page](https://github.com/QuangquyNguyenvo/Sameko-Dev-CPP/releases)
2. Download `Sameko-GCC-16.x.x.zip` or the full portable package

### Option B: Build from WinLibs
1. Visit https://winlibs.com/
2. Download **GCC 16.x + MinGW-w64 (UCRT) - Win64**
3. Choose the version **without LLVM** for smaller size

---

## Step 2: Place in Project Directory

Copy the compiler folder into the project:

```
Sameko-Dev-CPP/
├── Sameko-GCC/           ← PUT HERE
│   ├── bin/
│   │   ├── g++.exe
│   │   ├── gcc.exe
│   │   └── ...
│   ├── include/
│   └── lib/
├── main.js
└── src/
```

Supported folder names:

| Folder name  | Notes          |
| :----------- | :------------- |
| `Sameko-GCC` | Recommended    |
| `mingw64`    | Standard MinGW |
| `compiler`   | Generic name   |

---

## Step 3: Verify

1. Run the IDE: `npm start`
2. Check the terminal output:

```
[System] Compiler: Bundled Sameko-GCC 16.x.x
[System] PCH Status: CACHED (Instant) or FIRST BUILD (Optimizing...)
```

---

## Minimal Structure

To reduce size, you only need:

```
Sameko-GCC/
├── bin/
│   ├── g++.exe, gcc.exe, as.exe, ld.exe
│   └── required DLLs
├── include/
│   └── c++/16.x.x/  (C++ headers + bits/stdc++.h)
├── lib/
│   └── gcc/
└── libexec/
```


---

## Troubleshooting

### ❌ "bits/stdc++.h not found"
Check that this file exists: `Sameko-GCC/include/c++/16.x.x/bits/stdc++.h`

### ❌ "g++.exe not found"
Check that this file exists: `Sameko-GCC/bin/g++.exe`

### ⏳ IDE slow to start on first run
PCH is being built for the first time (~5-10 seconds). Subsequent runs will be instant.

### ❌ Compilation doesn't work
- Path should not contain special characters or spaces
- Antivirus is not blocking gcc.exe
- File is saved with `.cpp` extension

---

## Need Help?

Open an issue on [GitHub](https://github.com/QuangquyNguyenvo/Sameko-Dev-CPP/issues) with details! 🐟
