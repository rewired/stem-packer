import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createTranslator } from '@stem-packer/i18n';
import type { AppInfo, Preferences } from '../shared/preferences';
import type { CollisionCheckPayload } from '../shared/collisions';
import type { ArtistProfile } from '../shared/artist';
import type { PackingRequest, PackingResult, PackingProgressEvent } from '../shared/packing';
import type { ResolveDroppedPathsRequest } from '../shared/drop';
import { detectOutputCollisions, overwriteOutputCollisions } from './collisions';
import { scanAudioFiles } from './scanner';
import { PreferencesStore, ArtistStore } from './stores';
import { PackingManager, InsufficientDiskSpaceError } from './packingManager';
import { resolveDroppedPaths } from './drop';
import { loadWindowState, trackWindowState } from './windowState';

const isDevelopment = process.env.NODE_ENV === 'development';
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const t = createTranslator('en');
const userDataPath = app.getPath('userData');
const preferencesStore = new PreferencesStore(userDataPath);
const artistStore = new ArtistStore(userDataPath);
const DEFAULT_WINDOW_BOUNDS = { width: 1000, height: 700 } as const;

function broadcast<T>(channel: string, payload: T) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }
}

const packingManager = new PackingManager({
  preferencesStore,
  artistStore,
  emitProgress: (progress: PackingProgressEvent) => {
    broadcast('packing:progress', progress);
  },
  emitResult: (result: PackingResult) => {
    broadcast('packing:result', result);
  },
  emitError: (error: Error) => {
    broadcast('packing:error', {
      name: error.name,
      message: error.message,
    });
  },
});

async function createMainWindow() {
  const bounds = await loadWindowState(DEFAULT_WINDOW_BOUNDS);
  const position =
    typeof bounds.x === 'number' && typeof bounds.y === 'number'
      ? { x: bounds.x, y: bounds.y }
      : {};

  const window = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    ...position,
    show: true,
    title: t('app_title'),
    backgroundColor: '#1f2937',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  trackWindowState(window);

  if (isDevelopment && devServerUrl) {
    await window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    const rendererPath = pathToFileURL(path.join(__dirname, 'renderer/index.html')).toString();
    await window.loadURL(rendererPath);
  }
}

async function loadPersistentData() {
  await Promise.all([preferencesStore.load(), artistStore.load()]);
}

async function getAppInfo(): Promise<AppInfo> {
  return {
    name: app.getName(),
    version: app.getVersion()
  };
}

ipcMain.handle('app:get-info', async () => {
  return getAppInfo();
});

ipcMain.handle('preferences:get', async () => {
  return preferencesStore.get();
});

ipcMain.handle('preferences:set', async (_event, update: Partial<Preferences>) => {
  return preferencesStore.set(update);
});

ipcMain.handle('artist:get', async () => {
  return artistStore.get();
});

ipcMain.handle('artist:set', async (_event, payload: string | ArtistProfile) => {
  const value = typeof payload === 'string' ? payload : payload?.artist ?? '';
  return artistStore.set(value);
});

ipcMain.handle('dialog:choose-input-folder', async () => {
  const result = await dialog.showOpenDialog({
    title: t('button_choose_folder'),
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const folderPath = result.filePaths[0];
  return { canceled: false, folderPath };
});

ipcMain.handle('scan:folder', async (_event, folderPath: string) => {
  const preferences = preferencesStore.get();
  const resolvedPath = path.resolve(folderPath);
  const stats = await fs.stat(resolvedPath);

  const directoryPath = stats.isDirectory()
    ? resolvedPath
    : path.dirname(resolvedPath);

  const result = await scanAudioFiles(directoryPath, preferences);
  return result;
});

ipcMain.handle('drop:resolve', async (_event, payload: ResolveDroppedPathsRequest) => {
  return resolveDroppedPaths(payload);
});

ipcMain.handle('packing:detect-collisions', async (_event, payload: CollisionCheckPayload) => {
  return detectOutputCollisions(payload);
});

ipcMain.handle('packing:overwrite-collisions', async (_event, payload: CollisionCheckPayload) => {
  return overwriteOutputCollisions(payload);
});

ipcMain.handle('packing:start', async (_event, payload: PackingRequest) => {
  try {
    return await packingManager.start(payload);
  } catch (error) {
    if (error instanceof InsufficientDiskSpaceError) {
      const enriched = Object.assign(new Error(error.message), {
        name: error.name,
        requiredBytes: error.requiredBytes,
        availableBytes: error.availableBytes,
      });
      throw enriched;
    }
    throw error;
  }
});

ipcMain.handle('packing:cancel', async () => {
  return packingManager.cancel();
});

app.whenReady().then(async () => {
  await loadPersistentData();
  await createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
