# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta.9] - 2026-01-18

### Added
- **Documentation Overhaul**: Rewrote README, CONTRIBUTING with wiki-style format
- **Visual Badges**: New Wiki, Download, Website buttons in Sameko ocean style
- **Batch Testing UI**: Enhanced competitive programming test runner

### Changed
- **Modular Architecture**: Refactored main.js into app/ directory structure
- **PCH Logging**: Clearer precompiled header build status messages

### Fixed
- Various UI stability improvements and theme consistency fixes

## [1.0.0-beta.8] - 2026-01-01

### Added
- Maintenance release for stability improvements.
- Updated dependencies and internal optimizations.

## [1.0.0-beta.7] - 2025-12-29

### Added
- **AStyle Integration**: Professional C++ code formatting with `Ctrl + Shift + A`.
- **Auto-Save**: Customizable auto-save functionality with configurable intervals.
- **Template Manager**: Create and manage code templates for new files.
- **Custom Keybindings**: Ability to redefine shortcuts for various IDE actions.

## [1.0.0-beta.6] - 2025-12-28

### Added
- **Snippet Editor**: Built-in tool to create and manage custom IntelliSense code snippets.
- **IntelliSense Enhancements**: Improved keyword and snippet suggestions.
- **UI Glitches Fixes**: Improved modal backgrounds and theme consistency.

## [1.0.0-beta.5] - 2025-12-22

### Added
- **Smart Header Linking**: Automatically detects and links corresponding `.cpp` files when using `#include "header.h"`.
- **File Watcher**: Real-time detection of external file changes with prompt to reload.
- **Multi-file Compilation**: Improved handling of projects with multiple source files.

## [1.0.0] - 2025-12-14

### Added
- Initial release
- Monaco Editor integration with C++ syntax highlighting
- Multi-tab file management
- Split editor support
- Integrated terminal with interactive I/O
- Input/Expected output panels for testing
- Problems panel for compilation errors
- Kawaii Ocean theme (light and dark variants)
- Dracula theme
- Precompiled headers (PCH) support for faster compilation
- Customizable settings:
  - Font size and family
  - Tab size
  - Minimap toggle
  - Word wrap
  - C++ standard selection (C++11/14/17/20)
  - Optimization level
  - Time limit for execution
  - Custom background image
  - Accent color
- Keyboard shortcuts for all major actions
- Custom frameless window with native controls
