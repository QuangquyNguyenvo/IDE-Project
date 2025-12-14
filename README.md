# C++ IDE

<p align="center">
  <img src="src/assets/sameko_mascot.png" alt="C++ IDE Mascot" width="200">
</p>

<p align="center">
  <b>A fast, modern, and beautiful C++ IDE built with Electron</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-28.0.0-blue?logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/Monaco%20Editor-0.45.0-purple" alt="Monaco">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-green" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

---

## ✨ Features

- 🎨 **Beautiful Kawaii Ocean Theme** - Modern glassmorphism design with pastel colors
- ⚡ **Fast Compilation** - Precompiled headers support for lightning-fast builds
- 📝 **Monaco Editor** - Same powerful editor as VS Code with C++ syntax highlighting
- 🔀 **Split Editor** - Code side by side
- 📁 **Multi-tab Support** - Work on multiple files simultaneously  
- 🖥️ **Integrated Terminal** - Interactive input/output terminal
- 📊 **I/O Panels** - Test with custom input and expected output
- ⚠️ **Problems Panel** - View compilation errors and warnings
- ⚙️ **Customizable Settings** - Font, theme, compiler options, background image
- ⌨️ **Keyboard Shortcuts** - Familiar shortcuts for productivity

## 📸 Screenshots

> Add your screenshots here

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [G++ Compiler](https://winlibs.com/) (MinGW-w64 for Windows)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/QuangquyNguyenvo/IDE-Project.git
   cd IDE-Project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the application**
   ```bash
   npm start
   ```

### Build for Production

```bash
npm run build
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New File |
| `Ctrl+O` | Open File |
| `Ctrl+S` | Save File |
| `Ctrl+W` | Close Tab |
| `F9` | Compile |
| `F10` | Run |
| `F11` | Build & Run |
| `Ctrl+J` | Toggle Problems Panel |
| `Ctrl+\` | Split Editor |
| `Ctrl+,` | Settings |

## 📁 Project Structure

```
IDE-Project/
├── src/
│   ├── index.html      # Main HTML
│   ├── js/
│   │   └── app.js      # Renderer process logic
│   ├── styles/
│   │   ├── theme.css   # Main theme styles
│   │   └── base.css    # Base styles
│   └── assets/         # Images, icons, backgrounds
├── main.js             # Electron main process
├── preload.js          # IPC bridge (secure)
├── package.json
└── README.md
```

## 🛠️ Tech Stack

- **[Electron](https://www.electronjs.org/)** - Cross-platform desktop framework
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)** - Powerful code editor
- **[G++](https://gcc.gnu.org/)** - GNU C++ Compiler

## 🎨 Themes

Currently includes:
- **Kawaii Ocean** (Light) - Soft pastel blue theme
- **Kawaii Dark** - Dark mode variant
- **Dracula** - Classic dark theme

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👏 Acknowledgements

- [Monaco Editor](https://microsoft.github.io/monaco-editor/) for the amazing code editor
- [Electron](https://www.electronjs.org/) for the cross-platform framework
- Font families: [Fredoka](https://fonts.google.com/specimen/Fredoka), [Nunito](https://fonts.google.com/specimen/Nunito), [JetBrains Mono](https://www.jetbrains.com/lp/mono/)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/QuangquyNguyenvo">QuangquyNguyenvo</a>
</p>
