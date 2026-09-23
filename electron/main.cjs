'use strict';

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// ── GPU / Hardware-acceleration flags (must be set before app ready) ──────────
// These ensure Three.js / WebGL gets full GPU acceleration inside Electron
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');

// Development mode: loads from the Vite dev server (NODE_ENV=development)
// Production mode: loads from the built dist/ folder (app.isPackaged || NODE_ENV=production)
const isDev = process.env.NODE_ENV === 'development';

// ── Create main window ────────────────────────────────────────────────────────
function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, 'resources', 'icon.png');

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'DeepSeaLink – Deep Ocean Underwater Acoustic Simulation',
    backgroundColor: '#0a1628', // match ocean scene background, prevents white flash
    show: false,               // show after content is loaded (prevents blank window)
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      // Allow SharedArrayBuffer for Three.js WASM / audio worklets
      allowRunningInsecureContent: false,
    },
  });

  // Show window only when renderer is fully ready (avoids white/blank flash)
  win.once('ready-to-show', () => win.show());

  // ── Load the simulation ────────────────────────────────────────────────────
  if (isDev) {
    // Development: connect to Vite dev server
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: load the Vite-built static files from dist/
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // ── Open external URLs in the system browser, not Electron ────────────────
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // ── Handle navigation (prevent accidental navigation away) ────────────────
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    // Allow navigation to localhost in dev mode, block everything else
    if (!isDev || parsedUrl.origin !== 'http://localhost:5173') {
      event.preventDefault();
    }
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();

  // macOS: re-create window when dock icon is clicked and no windows open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
