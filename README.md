# MarkUp

A minimal, fast **Markdown editor with live visualizer** for macOS and Windows. Edit on the left, watch the rendered document on the right — local files, no cloud, no accounts, no bloat.

Built with [Tauri 2](https://tauri.app), [CodeMirror 6](https://codemirror.net), and [remarkable](https://github.com/jonschlinkert/remarkable).

<table>
  <tr>
    <td width="50%" align="center"><img src="docs/screenshots/light.png" alt="MarkUp in light mode" /></td>
    <td width="50%" align="center"><img src="docs/screenshots/dark.png" alt="MarkUp in dark mode" /></td>
  </tr>
</table>

> **Why?** Importing Markdown into Apple Notes is cumbersome, and many existing macOS editors (e.g. MacDown) are Intel-only and require Rosetta on Apple Silicon. MarkUp compiles natively for Apple Silicon and cross-builds for Windows x64 via GitHub Actions.

## Features

- **Split view** — source editor and rendered preview side by side, with a draggable divider
- **Live preview** — the rendered document updates as you type (100 ms debounce)
- **Full GFM Markdown** — tables, strikethrough, task lists, autolinks, and nested lists via remarkable
- **Code highlighting** — fenced code blocks in the preview highlighted by [highlight.js](https://highlightjs.org) (~190 languages); the editor itself has Markdown syntax highlighting with a GitHub-style palette
- **File handling** — open/save dialogs (`.md`, `.markdown`, `.mdown`, `.txt`), plus drag & drop a file onto the window to open it
- **Unsaved-changes guard** — dirty indicator dot and confirmation before discarding edits
- **Light/dark themes** — follows the system appearance on launch, with a manual toggle in the toolbar
- **Status bar** — live word count, character count, and cursor position (`Ln / Col`)
- **Small and native-feeling** — transparent title bar, native traffic lights, no web UI chrome

## Specifications

### Architecture

| Layer | Technology |
| --- | --- |
| Desktop shell | [Tauri 2](https://tauri.app) (Rust) — system WebView only, no bundled Chromium |
| Frontend | Vanilla JavaScript (ES modules), no framework, bundled by [Vite 6](https://vitejs.dev) |
| Editor | [CodeMirror 6](https://codemirror.net) with `@codemirror/lang-markdown` |
| Markdown engine | [remarkable](https://github.com/jonschlinkert/remarkable) 2.x |
| Code highlighting | [highlight.js](https://highlightjs.org) 11.x |
| System integration | `tauri-plugin-fs` + `tauri-plugin-dialog` (v2) |
| CI (Windows) | GitHub Actions (`windows-latest`, MSVC x64), manual dispatch |

### Markdown engine configuration

| Option | Value | Notes |
| --- | --- | --- |
| `html` | `true` | Raw inline HTML passes through |
| `gfm` | `true` | GitHub Flavored Markdown: tables, strikethrough, task lists, autolinks |
| `breaks` | `false` | Standard CommonMark line-break rules |
| `langPrefix` | `hljs language-` | Feeds fenced code to highlight.js |
| `highlight` | highlight.js callback | Silently skips unknown languages |

### Editor (CodeMirror 6)

- Markdown language mode with syntax highlighting (custom light/dark `HighlightStyle`s)
- Line numbers, active-line highlight, soft line wrapping
- Autocompletion, bracket matching, undo/redo history, code folding

### UI & window

| Element | Behavior |
| --- | --- |
| Title bar | `titleBarStyle: Transparent` — native traffic lights, toolbar acts as the drag region |
| Window | 1180 × 760 default, 760 × 480 minimum |
| Panes | Resizable via pointer-drag divider, clamped to 20–80 % editor width |
| Toolbar | New / Open… / Save / theme toggle buttons; shows current file name |
| Theme | `prefers-color-scheme` on launch; `◐` button toggles light/dark live |
| Window title | Mirrors the open file's name |

### Status bar

| Field | Detail |
| --- | --- |
| Word count | Whitespace-delimited token count of the document |
| Character count | Raw UTF-16 length of the document |
| Cursor | `Ln <line>, Col <column>` of the main selection head |
| Dirty dot | Bullet next to the file name while unsaved changes exist |

### File I/O

- **Open dialog filters:** `md`, `markdown`, `mdown`, `txt` (+ all files)
- **Save dialog:** defaults to `untitled.md`, `md` filter
- **Drag & drop:** opens dropped files in place (path-based on macOS/Windows; text fallback in the webview)
- **Guards:** dirty state blocks New/Open via confirm dialog and blocks window unload

### Keyboard shortcuts

| Action | macOS | Windows |
| --- | --- | --- |
| New document | `⌘N` | `Ctrl+N` |
| Open file | `⌘O` | `Ctrl+O` |
| Save file | `⌘S` | `Ctrl+S` |

### Platform support

| Platform | Requirement | Notes |
| --- | --- | --- |
| macOS | 10.15+ | Native Apple Silicon build; x86_64 build also possible via `--target x86_64-apple-darwin` |
| Windows | 10 / 11 x64 | Requires WebView2 runtime (preinstalled on Win 11); NSIS + MSI installers |

### Release profile (Rust)

`opt-level = "s"` (small binaries), `lto = true`, `codegen-units = 1`, `panic = "abort"`, `strip = true`.

### Security model

- Access is declared up front through the [Tauri v2 capability system](https://tauri.app/develop/capabilities/) in `src-tauri/capabilities/default.json` — no runtime permission prompts.
- Granted: `core:default`, `dialog:default`, and fs text/binary read + write with full-disk scope. The native file dialogs are the user-facing gate; the app has **no network commands**.
- CSP is `null` while in development; tighten before shipping a public build.

## Repository structure

```
MarkUp/
├── .github/
│   └── workflows/
│       └── build-windows.yml      # CI: Windows x64 build (manual dispatch)
├── docs/
│   └── screenshots/               # README screenshots (light & dark mode)
├── icon-source.png                # Master 1024×1024 app icon
├── scripts/
│   └── gen-icon.mjs               # Generates all platform icons from the master
├── index.html                     # App shell: toolbar, panes, status bar
├── src/
│   ├── main.js                    # Editor setup, remarkable rendering, file I/O, UI wiring
│   └── styles.css                 # Light/dark themes, layout
├── src-tauri/
│   ├── src/
│   │   └── main.rs                # Tauri builder + fs/dialog plugins
│   ├── capabilities/
│   │   └── default.json           # ACL: core, dialog, fs scope
│   ├── gen/                       # ACL schemas generated at build time
│   ├── icons/                     # Platform icons (.icns, .ico, .png)
│   ├── build.rs
│   ├── Cargo.toml
│   └── tauri.conf.json            # Window, bundling, build config
├── vite.config.js
├── package.json
└── LICENSE                        # MIT
```

## Development

### Prerequisites

- **Node.js** 18+ and npm
- **Rust** (stable, via [rustup](https://rustup.rs))
- Platform prerequisites per Tauri:
  - macOS: Xcode command line tools (`xcode-select --install`)
  - Windows: Microsoft C++ Build Tools and the WebView2 runtime

### Run in development

```sh
git clone https://github.com/DexterLagan/MarkUp.git
cd MarkUp
npm install
npm run tauri dev
```

### Build release binaries

**macOS (local, Apple Silicon by default):**

```sh
npm run tauri build
# -> src-tauri/target/release/bundle/dmg/MarkUp_<ver>_aarch64.dmg
# -> src-tauri/target/release/bundle/macos/MarkUp.app
```

**Windows x64 (via GitHub Actions):**

1. Push changes to `main`.
2. In the repository's **Actions** tab, run the **Build Windows** workflow (manual dispatch).
3. Download the `MarkUp-windows-x64` artifact from the run — it contains the NSIS installer (`.exe`) and MSI under `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/`.

### Cutting a release

1. Bump the version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
2. Build macOS locally and Windows via the Actions workflow.
3. Publish with `gh release create vX.Y.Z <artifacts> --notes-file RELEASE_NOTES.md`.

Current release: [v0.1.0](https://github.com/DexterLagan/MarkUp/releases/tag/v0.1.0).

## Roadmap ideas

- Autosave and multiple open tabs
- Export to HTML/PDF
- Code signing for macOS (Developer ID) and Windows (EV/Code Sign cert) to silence Gatekeeper/SmartScreen

## License

MarkUp is licensed under the **MIT License** — see [LICENSE](LICENSE).

Copyright (c) 2026 Dexter Santucci
