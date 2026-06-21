/**
 * MediaVault Electron build pipeline
 *
 * Usage:
 *   node build.mjs              # Compile main process only (dev)
 *   node build.mjs --package    # Full build: frontend + server + Electron → installer
 *   node build.mjs --package --win    # Windows only
 *   node build.mjs --package --mac    # macOS only
 *   node build.mjs --package --linux  # Linux only
 *
 * Prerequisites (run once):
 *   pnpm install
 *   pnpm --filter @workspace/api-server run build
 *   (The --package flag does this automatically)
 */

import { build as esbuild } from "esbuild";
import { execSync, exec } from "child_process";
import { rm, copyFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);
const doPackage = args.includes("--package");

function run(cmd, cwd = root) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

// ── 1. Build Electron main process ───────────────────────────────────────────
async function buildMain() {
  console.log("\n📦 Building Electron main process…");
  await rm(path.join(__dirname, "dist"), { recursive: true, force: true });

  await esbuild({
    entryPoints: [
      path.join(__dirname, "src/main.ts"),
      path.join(__dirname, "src/preload.ts"),
    ],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outdir: path.join(__dirname, "dist"),
    external: [
      "electron",
      "embedded-postgres",
      "*.node",
    ],
    define: {
      "import.meta.url": "__filename",
    },
    logLevel: "info",
  });

  console.log("✅ Main process compiled → dist/");
}

// ── 2. Build React frontend (Electron variant) ────────────────────────────────
async function buildFrontend() {
  console.log("\n🌐 Building React frontend for Electron…");
  run(
    `pnpm --filter @workspace/mediavault exec vite build --config vite.electron.config.ts`,
    root
  );
  const outDir = path.join(root, "artifacts/mediavault/dist-electron");
  if (!existsSync(outDir)) {
    throw new Error(`Frontend build output not found at ${outDir}`);
  }
  console.log("✅ Frontend built → artifacts/mediavault/dist-electron/");
}

// ── 3. Build Express API server ───────────────────────────────────────────────
async function buildServer() {
  console.log("\n🖥  Building Express API server…");
  run(`pnpm --filter @workspace/api-server run build`, root);
  console.log("✅ API server built → artifacts/api-server/dist/");
}

// ── 4. Run electron-builder ───────────────────────────────────────────────────
async function packageApp() {
  const platform = args.includes("--win")
    ? "--win"
    : args.includes("--mac")
    ? "--mac"
    : args.includes("--linux")
    ? "--linux"
    : "";          // Let electron-builder auto-detect current platform

  const cmd = `pnpm exec electron-builder ${platform} --config`.trim();
  // electron-builder reads "build" from package.json by default
  console.log(`\n🏗  Running electron-builder (${platform || "current platform"})…`);
  run(cmd, __dirname);
  console.log("\n✅ Installer(s) written to dist-installer/");
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    if (doPackage) {
      await buildServer();
      await buildFrontend();
    }
    await buildMain();
    if (doPackage) {
      await packageApp();
    }
  } catch (err) {
    console.error("\n❌ Build failed:", err.message ?? err);
    process.exit(1);
  }
})();
