const fs = require('fs');

const workspaceFile = 'pnpm-workspace.yaml';

if (!fs.existsSync(workspaceFile)) {
    throw new Error(`Could not find ${workspaceFile}`);
}

let c = fs.readFileSync(workspaceFile, 'utf8');

// Normalize line endings
c = c.replace(/\r\n/g, '\n');

/**
 * Remove Windows binary exclusions that break CI builds
 */

// Rollup Windows binaries
c = c.replace(
    /  "rollup>@rollup\/rollup-win32[^"]+": "-"\n/g,
    ''
);

// esbuild Windows binaries
c = c.replace(
    /  "esbuild>@esbuild\/win32[^"]+": "-"\n/g,
    ''
);

// lightningcss Windows binaries
c = c.replace(
    /  "lightningcss>lightningcss-win32[^"]+": "-"\n/g,
    ''
);

// tailwindcss oxide Windows binaries
c = c.replace(
    /  "@tailwindcss\/oxide>@tailwindcss\/oxide-win32[^"]+": "-"\n/g,
    ''
);

// embedded-postgres / other Windows exclusions (safety sweep)
c = c.replace(
    /  "@embedded-postgres\/windows-x64[^"]+": "-"\n/g,
    ''
);

fs.writeFileSync(workspaceFile, c);

console.log('pnpm-workspace.yaml patched for Windows CI (cleaned native deps)');