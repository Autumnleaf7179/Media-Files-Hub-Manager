---
name: Electron CI build constraints
description: Gotchas when building the Electron app in CI (GitHub Actions or similar)
---

## onlyBuiltDependencies skips electron and embedded-postgres postinstalls

`pnpm-workspace.yaml` lists `onlyBuiltDependencies` which controls which packages may run lifecycle scripts. `electron` and `embedded-postgres` are NOT in this list (to avoid downloading large binaries in Replit). In CI, their binary-download postinstall scripts must be triggered manually after `pnpm install`:

```bash
node artifacts/mediavault-electron/node_modules/electron/install.js
node artifacts/mediavault-electron/node_modules/embedded-postgres/postinstall.js
```

**Why:** We don't want to download a ~100MB Electron binary during every `pnpm install` in Replit (dev only needs the web workflow). But in CI we're actually packaging the app so the binary must be present.

**How to apply:** Any CI workflow that packages the Electron app must include these two manual steps after `pnpm install`.

## esbuild darwin override blocks macOS CI

`pnpm-workspace.yaml` overrides exclude `@esbuild/darwin-x64` and `@esbuild/darwin-arm64` (Replit runs linux-x64 only). On a macOS CI runner, this prevents esbuild from installing its native binary.

Fix: before `pnpm install` on macOS, patch the workspace file to remove the darwin lines:

```python
with open('pnpm-workspace.yaml', 'r') as f:
    lines = f.readlines()
filtered = [l for l in lines if 'esbuild>@esbuild/darwin' not in l]
with open('pnpm-workspace.yaml', 'w') as f:
    f.writelines(filtered)
```

**Why:** The esbuild overrides are Replit-specific disk-space optimizations; they break cross-platform CI.

## Icon files: only icon.png exists in build-resources

Only `icon.png` (512×512) is committed. The workflow must generate platform-specific icons at build time:

- **Windows `.ico`**: `npx --yes png-to-ico icon.png > icon.ico`
- **macOS `.icns`**: `sips` + `iconutil` (built into macOS runners)
- **Linux**: uses `icon.png` directly — no conversion needed

## Workflow location

`.github/workflows/build.yml` — triggers on push to main and `workflow_dispatch`.
