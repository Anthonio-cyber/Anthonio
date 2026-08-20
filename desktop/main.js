// ==========================================================
// Grade 8 Hub - desktop application
//
// Starts the hub's own server inside the app and shows it in a
// real window. There is no address bar and no browser needed:
// this is the Grade 8 Hub as an ordinary desktop program.
// ==========================================================
import { app, BrowserWindow, Menu, shell, dialog, nativeImage } from 'electron';
import path from 'node:path';
import url from 'node:url';
import net from 'node:net';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');

// Keep everything (database, uploads, .env) beside the app itself.
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

let mainWindow = null;
let serverProcess = null;
let serverPort = Number(process.env.PORT || 3000);

/** Finds a free port so a second copy of the app still opens. */
function findFreePort(start) {
  return new Promise((resolve) => {
    const tryPort = (port) => {
      const tester = net.createServer()
        .once('error', () => tryPort(port + 1))
        .once('listening', () => tester.close(() => resolve(port)))
        .listen(port, '127.0.0.1');
    };
    tryPort(start);
  });
}

/**
 * Once installed, the app folder itself is read-only, so the database,
 * uploaded pictures and the sign-in secret are kept in the normal place
 * for application data on this computer. That also means they survive
 * updating or reinstalling the app.
 */
function userDataPaths() {
  const base = app.getPath('userData');
  const databaseFile = path.join(base, 'database', 'grade8hub.db');
  const uploadDir = path.join(base, 'uploads');
  fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });

  // One secret per installation, made on first run and kept afterwards.
  const settingsFile = path.join(base, 'app-settings.json');
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch { settings = {}; }
  if (!settings.jwtSecret) {
    settings.jwtSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  }
  return { base, databaseFile, uploadDir, jwtSecret: settings.jwtSecret };
}

/**
 * Runs the hub's server as its own process rather than inside the window.
 *
 * In development that is the Node.js already installed on the computer, which
 * means the database module never has to be rebuilt and `npm start` keeps
 * working exactly as before. In a packaged app there is no system Node, so the
 * app runs its own binary in Node mode instead.
 */
async function startServer() {
  serverPort = await findFreePort(serverPort);

  const serverEntry = path.join(ROOT, 'server/boot.js');
  const env = { ...process.env, PORT: String(serverPort), NODE_ENV: 'production' };

  if (app.isPackaged) {
    const paths = userDataPaths();
    env.DATABASE_FILE = paths.databaseFile;
    env.UPLOAD_DIR = paths.uploadDir;
    env.JWT_SECRET = paths.jwtSecret;
    // An installed app is for one class, so it starts empty rather than
    // with the example students.
    env.SEED_DEMO_DATA = 'false';
  }

  // The server always runs on the Node.js installed on this computer.
  // That keeps one single build of the database module for both the desktop
  // app and `npm start`, so neither ever has to be recompiled.
  const command = process.platform === 'win32' ? 'node.exe' : 'node';
  const args = [serverEntry];

  serverProcess = spawn(command, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  serverProcess.stdout.on('data', (d) => process.stdout.write(`[hub] ${d}`));
  serverProcess.stderr.on('data', (d) => process.stderr.write(`[hub] ${d}`));

  let spawnError = null;
  serverProcess.on('error', (err) => { spawnError = err; });
  serverProcess.on('exit', (code) => {
    if (code && code !== 0 && !app.isQuitting) {
      dialog.showErrorBox('The Grade 8 Hub stopped',
        `The class server stopped unexpectedly (code ${code}).\n\nClose the app and open it again.`);
    }
  });

  // Wait until it actually answers before showing the window.
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (spawnError) {
      throw new Error('Node.js could not be started.\n\nThe Grade 8 Hub needs Node.js. Install it from https://nodejs.org, then open the app again.');
    }
    try {
      const response = await fetch(`http://127.0.0.1:${serverPort}/api/health`);
      if (response.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('The Grade 8 Hub server did not start in time.');
}

function stopServer() {
  if (!serverProcess || serverProcess.killed) return;
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t']);
    else serverProcess.kill('SIGTERM');
  } catch { /* it is already gone */ }
  serverProcess = null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 520,
    show: false,
    backgroundColor: '#080a13',
    autoHideMenuBar: true,
    icon: nativeImage.createFromPath(path.join(ROOT, 'public/icons/icon-256.png')),
    title: 'Grade 8 Hub',
    webPreferences: {
      // The window only ever shows our own local pages.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`);

  // Links to anywhere else open in the normal browser, never in the app.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (!target.startsWith(`http://127.0.0.1:${serverPort}`)) {
      shell.openExternal(target);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(`http://127.0.0.1:${serverPort}`)) {
      event.preventDefault();
      shell.openExternal(target);
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Hub',
      submenu: [
        { label: 'Home', accelerator: 'CmdOrCtrl+1', click: () => go('#/') },
        { label: 'Feed', accelerator: 'CmdOrCtrl+2', click: () => go('#/feed') },
        { label: 'Messages', accelerator: 'CmdOrCtrl+3', click: () => go('#/messages') },
        { label: 'Games', accelerator: 'CmdOrCtrl+4', click: () => go('#/games') },
        { label: 'Homework', accelerator: 'CmdOrCtrl+5', click: () => go('#/homework') },
        { type: 'separator' },
        { role: 'reload' },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About the Grade 8 Hub',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Grade 8 Hub',
            message: 'Grade 8 Hub',
            detail: `The private network for our class.\n\nRunning on this computer at http://localhost:${serverPort}\n\nClassmates on the same network can join by opening that address with this computer's network address instead of "localhost".`,
            buttons: ['Close']
          })
        },
        {
          label: 'Open in my browser instead',
          click: () => shell.openExternal(`http://localhost:${serverPort}`)
        }
      ]
    }
  ]));
}

const go = (hash) => mainWindow?.loadURL(`http://127.0.0.1:${serverPort}/${hash}`);

// Only ever one copy of the app, so the database is never opened twice.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      await startServer();
      buildMenu();
      createWindow();
    } catch (err) {
      dialog.showErrorBox('The Grade 8 Hub could not start', String(err?.message || err));
      app.quit();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  // Never leave the class server running after the app is closed.
  app.on('before-quit', () => { app.isQuitting = true; stopServer(); });
  app.on('will-quit', stopServer);
  process.on('exit', stopServer);
}
