// ==========================================================
// Coding Hub - desktop application
//
// Starts the hub's own server inside the app and shows it in a
// real window. There is no address bar and no browser needed:
// this is the Coding Hub as an ordinary desktop program.
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
let serverPort = Number(process.env.PORT || 4000);

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
  const databaseFile = path.join(base, 'database', 'codinghub.db');
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
 * An installed app runs its own bundled binary in Node mode, so the computer
 * does NOT need Node.js installed for the app to work. When running from
 * source during development it uses the Node.js already on the computer.
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
    // An installed copy starts empty rather than with example accounts.
    env.SEED_DEMO_DATA = 'false';
  }

  // An installed app must not depend on anything else being on the computer,
  // so it runs its OWN bundled binary in Node mode. During development there
  // is no bundle yet, so the Node.js used to launch Electron is used instead.
  let command;
  let args;
  if (app.isPackaged) {
    command = process.execPath;          // the app's own executable
    args = [serverEntry];
    env.ELECTRON_RUN_AS_NODE = '1';      // ...told to behave as plain Node.js
  } else {
    command = process.platform === 'win32' ? 'node.exe' : 'node';
    args = [serverEntry];
  }

  serverProcess = spawn(command, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  serverProcess.stdout.on('data', (d) => process.stdout.write(`[hub] ${d}`));
  serverProcess.stderr.on('data', (d) => process.stderr.write(`[hub] ${d}`));

  let spawnError = null;
  serverProcess.on('error', (err) => { spawnError = err; });
  serverProcess.on('exit', (code) => {
    if (code && code !== 0 && !app.isQuitting) {
      dialog.showErrorBox('The Coding Hub stopped',
        `The class server stopped unexpectedly (code ${code}).\n\nClose the app and open it again.`);
    }
  });

  // Wait until it actually answers before showing the window.
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (spawnError) {
      throw new Error(app.isPackaged
        ? 'The Coding Hub could not start its own server. Please reinstall the app.'
        : 'Node.js could not be started.\n\nRunning from source needs Node.js. Install it from https://nodejs.org, then try again.');
    }
    try {
      const response = await fetch(`http://127.0.0.1:${serverPort}/api/health`);
      if (response.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('The Coding Hub server did not start in time.');
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
    title: 'Coding Hub',
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
      label: 'Coding Hub',
      submenu: [
        { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: () => go('#/') },
        { label: 'Subjects', accelerator: 'CmdOrCtrl+2', click: () => go('#/subjects') },
        { label: 'Practice', accelerator: 'CmdOrCtrl+3', click: () => go('#/practice') },
        { label: 'My progress', accelerator: 'CmdOrCtrl+4', click: () => go('#/progress') },
        { label: 'Messages', accelerator: 'CmdOrCtrl+5', click: () => go('#/messages') },
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
          label: 'About the Coding Hub',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Coding Hub',
            message: 'Coding Hub',
            detail: `Learn to code: lessons, challenges and practice.\n\nRunning on this computer at http://localhost:${serverPort}\n\nOther people on the same network can join by opening that address with this computer's network address instead of "localhost".`,
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
      dialog.showErrorBox('The Coding Hub could not start', String(err?.message || err));
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
