import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  nativeTheme,
} from "electron";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { createConnection } from "net";
import EmbeddedPostgres from "embedded-postgres";

// ── Constants ─────────────────────────────────────────────────────────────────
const IS_DEV = !app.isPackaged;

// ── Asar spawn fix ────────────────────────────────────────────────────────────
// embedded-postgres resolves binary paths using import.meta.url, which inside
// a packaged Electron app points into app.asar. Executables cannot be spawned
// from inside an asar archive — they must come from app.asar.unpacked.
// This patch rewrites any spawn command that still references app.asar so it
// uses the correct app.asar.unpacked path instead.
if (!IS_DEV) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cp = require("child_process");
  const _origSpawn = cp.spawn.bind(cp);
  cp.spawn = function (cmd: string, args?: unknown[], opts?: unknown) {
    if (typeof cmd === "string" && cmd.includes("app.asar") && !cmd.includes("app.asar.unpacked")) {
      cmd = cmd.replace(/(app\.asar)([/\\])/g, "app.asar.unpacked$2");
    }
    return _origSpawn(cmd, args, opts);
  };
}
const API_PORT = 18765;
const PG_PORT = 18766;
const PG_USER = "mediavault";
const PG_PASSWORD = "mediavault";
const PG_DB = "mediavault";

// ── State ─────────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let apiProcess: ChildProcess | null = null;
let pg: EmbeddedPostgres | null = null;

// ── Paths ─────────────────────────────────────────────────────────────────────
function resourcesPath(...parts: string[]): string {
  return IS_DEV
    ? path.join(__dirname, "..", "..", "..", ...parts)
    : path.join(process.resourcesPath, ...parts);
}

// ── Splash window ─────────────────────────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  splashWindow.loadURL(`data:text/html,
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #0f1117;
          color: #e2e8f0;
          font-family: system-ui, -apple-system, sans-serif;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          height: 100vh; gap: 20px;
          border-radius: 12px;
          overflow: hidden;
        }
        .logo { font-size: 48px; }
        h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
        p  { font-size: 14px; color: #94a3b8; }
        .bar {
          width: 200px; height: 3px;
          background: #1e293b; border-radius: 4px; overflow: hidden;
        }
        .bar-inner {
          height: 100%; width: 30%;
          background: linear-gradient(90deg, #06b6d4, #3b82f6);
          border-radius: 4px;
          animation: slide 1.4s ease-in-out infinite;
        }
        @keyframes slide {
          0%  { transform: translateX(-100%); }
          100%{ transform: translateX(600%); }
        }
      </style>
    </head>
    <body>
      <div class="logo">▶</div>
      <h1>MediaVault</h1>
      <p id="status">Starting database…</p>
      <div class="bar"><div class="bar-inner"></div></div>
    </body>
    </html>`);
}

function setSplashStatus(text: string) {
  splashWindow?.webContents.executeJavaScript(
    `document.getElementById('status').textContent = ${JSON.stringify(text)}`
  ).catch(() => {});
}

// ── Wait for a TCP port to accept connections ─────────────────────────────────
function waitForPort(port: number, timeout = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;

    function attempt() {
      if (Date.now() > deadline) {
        return reject(new Error(`Timed out waiting for port ${port}`));
      }
      const socket = createConnection(port, "127.0.0.1");
      socket.once("connect", () => { socket.destroy(); resolve(); });
      socket.once("error", () => {
        socket.destroy();
        setTimeout(attempt, 400);
      });
    }
    attempt();
  });
}

// ── Embedded PostgreSQL ───────────────────────────────────────────────────────
async function startPostgres() {
  const dataDir = path.join(app.getPath("userData"), "postgres-data");

  pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: PG_USER,
    password: PG_PASSWORD,
    port: PG_PORT,
    persistent: true,
  });

  await pg.initialise();
  await pg.start();

  // Create DB if it doesn't exist yet
  const client = pg.getPgClient();
  await client.connect();
  const existing = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [PG_DB]
  );
  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE ${PG_DB}`);
  }
  await client.end();
}

// ── Express API server ────────────────────────────────────────────────────────
function startApiServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const serverEntry = IS_DEV
      ? path.join(__dirname, "..", "..", "..", "artifacts", "api-server", "dist", "index.mjs")
      : path.join(process.resourcesPath, "server", "index.mjs");

    const frontendDir = IS_DEV
      ? path.join(__dirname, "..", "..", "..", "artifacts", "mediavault", "dist-electron")
      : path.join(process.resourcesPath, "frontend");

    const dbUrl = `postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${PG_DB}`;

    apiProcess = spawn(process.execPath, ["--enable-source-maps", serverEntry], {
      env: {
        ...process.env,
        PORT: String(API_PORT),
        DATABASE_URL: dbUrl,
        STATIC_DIR: frontendDir,
        NODE_ENV: "production",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    apiProcess.stdout?.on("data", (d) => {
      const text = d.toString();
      if (text.includes("Server listening")) resolve();
    });

    apiProcess.stderr?.on("data", (d) => {
      console.error("[api]", d.toString());
    });

    apiProcess.on("error", reject);
    apiProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`API server exited with code ${code}`));
      }
    });

    // Fallback: poll port in case stdout doesn't fire in time
    waitForPort(API_PORT, 20_000).then(resolve).catch(() => {});
  });
}

// ── Main window ───────────────────────────────────────────────────────────────
async function createMainWindow() {
  nativeTheme.themeSource = "dark";

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#0f1117",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow loading local media files via file:// in the <video>/<audio> tags
      webSecurity: false,
    },
  });

  await mainWindow.loadURL(`http://127.0.0.1:${API_PORT}/`);

  mainWindow.once("ready-to-show", () => {
    splashWindow?.close();
    splashWindow = null;
    mainWindow?.show();
    if (IS_DEV) mainWindow?.webContents.openDevTools();
  });

  mainWindow.on("closed", () => { mainWindow = null; });

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle("dialog:openFolder", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"],
    title: "Choose a media folder",
  });
  return result.canceled ? null : result.filePaths[0] ?? null;
});

ipcMain.handle("app:version", () => app.getVersion());

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createSplash();

  try {
    setSplashStatus("Starting database…");
    await startPostgres();

    setSplashStatus("Starting API server…");
    await startApiServer();

    setSplashStatus("Loading MediaVault…");
    await createMainWindow();
  } catch (err) {
    dialog.showErrorBox(
      "MediaVault failed to start",
      String(err instanceof Error ? err.message : err)
    );
    app.quit();
  }
});

app.on("window-all-closed", async () => {
  apiProcess?.kill("SIGTERM");
  try { await pg?.stop(); } catch { /* best-effort */ }
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createMainWindow();
});

app.on("before-quit", () => {
  apiProcess?.kill("SIGTERM");
});
