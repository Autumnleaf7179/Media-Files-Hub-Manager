# Building MediaVault Installers

This guide walks you through packaging MediaVault into native desktop installers
for Windows (.exe), macOS (.dmg), and Linux (.AppImage / .deb / .rpm).

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20 + | https://nodejs.org |
| pnpm | 9 + | `npm i -g pnpm` |
| PostgreSQL | 14 + | Only for *development*; production uses embedded Postgres |
| Git | any | |

**Platform extras**

| Platform | Extra requirement |
|----------|------------------|
| Windows | Nothing extra |
| macOS | Xcode Command Line Tools (`xcode-select --install`) |
| Linux | `rpm` for RPM target (`sudo apt install rpm`) |

> **Cross-compilation note**: electron-builder can cross-compile some targets
> (e.g. macOS DMG on Linux with `--mac`) but native builds on each OS are
> most reliable. For CI, use the official electron-builder GitHub Action.

---

## Setup (once)

```bash
# From the repo root
git clone <your-repo-url> mediavault
cd mediavault
pnpm install          # installs all workspace packages including electron
```

---

## Building an installer

All commands run from **`artifacts/mediavault-electron/`** unless noted.

### Build for the current platform

```bash
cd artifacts/mediavault-electron
node build.mjs --package
```

This runs the full pipeline:

1. **API server** — `pnpm --filter @workspace/api-server run build`
2. **Frontend** — `vite build --config vite.electron.config.ts`
3. **Electron main process** — esbuild bundles `src/main.ts` + `src/preload.ts`
4. **electron-builder** — produces installer(s) in `dist-installer/`

### Build for a specific platform

```bash
node build.mjs --package --win    # → dist-installer/MediaVault Setup 1.0.0.exe
node build.mjs --package --mac    # → dist-installer/MediaVault-1.0.0.dmg
node build.mjs --package --linux  # → dist-installer/MediaVault-1.0.0.AppImage
                                  #   dist-installer/mediavault_1.0.0_amd64.deb
                                  #   dist-installer/mediavault-1.0.0.x86_64.rpm
```

---

## Output files

| OS | File | Description |
|----|------|-------------|
| Windows | `MediaVault Setup 1.0.0.exe` | NSIS installer with optional install path |
| macOS | `MediaVault-1.0.0.dmg` | Drag-to-Applications disk image |
| Linux | `MediaVault-1.0.0.AppImage` | Portable, no install needed |
| Linux | `mediavault_1.0.0_amd64.deb` | Debian/Ubuntu package |
| Linux | `mediavault-1.0.0.x86_64.rpm` | Red Hat/Fedora package |

---

## What gets bundled inside the installer

```
MediaVault.app (or install dir)
├── resources/
│   ├── app.asar              ← Electron main process (compiled)
│   ├── app.asar.unpacked/
│   │   └── node_modules/
│   │       └── embedded-postgres/  ← PostgreSQL binaries (kept unpacked so they're executable)
│   ├── frontend/             ← Built React app (static HTML/JS/CSS)
│   └── server/               ← Built Express API server (single .mjs bundle)
└── MediaVault (or MediaVault.exe)
```

**Database**: MediaVault ships a fully embedded PostgreSQL (via the
`embedded-postgres` npm package). It starts and stops automatically with the
app. Data is stored in the OS user-data folder:

| OS | Data location |
|----|--------------|
| Windows | `%APPDATA%\MediaVault\postgres-data` |
| macOS | `~/Library/Application Support/MediaVault/postgres-data` |
| Linux | `~/.config/MediaVault/postgres-data` |

---

## Customising the icon

Replace the placeholders in `build-resources/` with your final artwork before
building:

| File | Recommended size | Used for |
|------|-----------------|---------|
| `icon.png` | 512 × 512 | Linux AppImage / .deb |
| `icon.ico` | Multi-size ICO | Windows |
| `icon.icns` | Multi-size ICNS | macOS |

You can generate `.ico` and `.icns` from a 1024 × 1024 `icon.png` with:

```bash
# macOS
sips -s format icns icon.png --out icon.icns

# Windows (using ImageMagick)
magick icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

---

## Code signing (optional but recommended)

Unsigned apps show security warnings on Windows and macOS.

**macOS** — set env vars before building:
```bash
export CSC_LINK=path/to/cert.p12
export CSC_KEY_PASSWORD=yourpassword
node build.mjs --package --mac
```

**Windows** — set:
```bash
export CSC_LINK=path/to/cert.p12
export CSC_KEY_PASSWORD=yourpassword
node build.mjs --package --win
```

See the [electron-builder code signing docs](https://www.electron.build/code-signing)
for notarization (macOS) and EV certificates (Windows).

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `embedded-postgres` fails to start | Make sure `asar.unpack` includes `node_modules/embedded-postgres/**`; check that the binary is executable (`chmod +x`) |
| Port 18765 / 18766 already in use | Kill stale processes, or edit `API_PORT` / `PG_PORT` in `src/main.ts` |
| White screen on launch | Open DevTools (View → Developer → Toggle DevTools) and check the console |
| `electron-builder: command not found` | Run `pnpm install` from the repo root first |
