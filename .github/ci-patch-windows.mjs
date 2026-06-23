/**
 * Patches pnpm-workspace.yaml for Windows CI builds.
 * Removes overrides that block Windows-native rollup/esbuild packages,
 * and allows electron + embedded-postgres to run their binary-download scripts.
 *
 * Run with: node .github/ci-patch-windows.mjs
 */

import { readFileSync, writeFileSync } from "fs";

let c = readFileSync("pnpm-workspace.yaml", "utf8").replace(/\r\n/g, "\n");

// Remove overrides that block Windows-native rollup modules (needed by Vite)
c = c.replace(/\s+"rollup>@rollup\/rollup-win32[^"]+": "-"/g, "");

// Remove overrides that block Windows-native esbuild modules
c = c.replace(/\s+"esbuild>@esbuild\/win32[^"]+": "-"/g, "");

// Add electron + @embedded-postgres/windows-x64 to onlyBuiltDependencies
// so pnpm runs their binary-download postinstall scripts
c = c.replace(
  "  - unrs-resolver\n",
  "  - unrs-resolver\n  - electron\n  - '@embedded-postgres/windows-x64'\n"
);

writeFileSync("pnpm-workspace.yaml", c);
console.log("pnpm-workspace.yaml patched for Windows CI.");
