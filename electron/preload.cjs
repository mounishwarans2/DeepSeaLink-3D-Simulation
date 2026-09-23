'use strict';

// ── Minimal preload — contextBridge with no exposed APIs ─────────────────────
// The simulation is a self-contained renderer with no need for Node.js APIs.
// contextIsolation=true is enforced in main.cjs.
// This file exists to satisfy Electron's preload requirement and can be
// extended if any Electron ↔ renderer IPC is needed in the future.

const { contextBridge } = require('electron');

// Expose a safe read-only application info object
contextBridge.exposeInMainWorld('__deepsealink__', {
  version: '1.0.0',
  platform: process.platform,
});
