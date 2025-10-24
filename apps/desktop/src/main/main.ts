import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import type { Dirent, Stats } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createTranslator } from '@stem-packer/i18n';
import picomatch from 'picomatch';
import {
  AUDIO_EXTENSIONS,
  DEFAULT_PREFERENCES,
  type AppInfo,
  type AudioFileItem,
  type Preferences,
  type ScanResult
} from '../shared/preferences';

const isDevelopment = process.env.NODE_ENV === 'development';
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const t = createTranslator('en');

const audioExtensions = new Set(AUDIO_EXTENSIONS);

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

class PreferencesStore {
  private filePath: string;
  private data: Preferences = { ...DEFAULT_PREFERENCES };

  constructor(filename: string) {
    this.filePath = path.join(app.getPath('userData'), filename);
  }

  async load() {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(content) as Preferences;
      this.data = { ...DEFAULT_PREFERENCES, ...parsed };
    } catch (error) {
      this.data = { ...DEFAULT_PREFERENCES };
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read preferences:', error);
      }
    }
  }

  get(): Preferences {
    return { ...this.data, ignore_globs: [...this.data.ignore_globs] };
  }

  async set(update: Partial<Preferences>): Promise<Preferences> {
    this.data = {
      ...this.data,
      ...update,
      ignore_globs:
        update.ignore_globs !== undefined
          ? [...update.ignore_globs]
          : [...this.data.ignore_globs]
    };

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    return this.get();
  }
}

const preferencesStore = new PreferencesStore('settings.json');

async function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    show: true,
    title: t('app_title'),
    backgroundColor: '#1f2937',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDevelopment && devServerUrl) {
    await window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    const rendererPath = pathToFileURL(path.join(__dirname, 'renderer/index.html')).toString();
    await window.loadURL(rendererPath);
  }
}

async function loadPreferences() {
  await preferencesStore.load();
}

async function getAppInfo(): Promise<AppInfo> {
  return {
    name: app.getName(),
    version: app.getVersion()
  };
}

function normalizeExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

async function walkAudioFiles(
  folderPath: string,
  preferences: Preferences
): Promise<ScanResult> {
  const files: AudioFileItem[] = [];
  let ignoredCount = 0;
  const stack: string[] = [folderPath];
  const matcher =
    preferences.ignore_enabled && preferences.ignore_globs.length > 0
      ? picomatch(preferences.ignore_globs, { dot: true })
      : null;

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) {
      continue;
    }

    let dirEntries: Dirent[];
    try {
      dirEntries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      console.error('Failed to read directory', currentDir, error);
      continue;
    }

    for (const entry of dirEntries) {
      const fullPath = path.join(currentDir, entry.name);
      const relative = path.relative(folderPath, fullPath);
      const posixRelative = toPosixPath(relative);

      if (matcher && matcher(posixRelative)) {
        ignoredCount += 1;
        continue;
      }

      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      const extension = normalizeExtension(entry.name);
      if (!audioExtensions.has(extension)) {
        continue;
      }

      let stats: Stats;
      try {
        stats = await fs.stat(fullPath);
      } catch (error) {
        console.error('Failed to stat file', fullPath, error);
        continue;
      }

      files.push({
        name: entry.name,
        relativePath: posixRelative,
        extension,
        sizeBytes: stats.size,
        fullPath
      });
    }
  }

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return {
    folderPath,
    files,
    ignoredCount
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

ipcMain.handle('dialog:choose-input-folder', async () => {
  const result = await dialog.showOpenDialog({
    title: t('button_choose_folder'),
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const folderPath = result.filePaths[0];
  await preferencesStore.set({ lastInputDir: folderPath });
  return { canceled: false, folderPath };
});

ipcMain.handle('scan:folder', async (_event, folderPath: string) => {
  const preferences = preferencesStore.get();
  const resolvedPath = path.resolve(folderPath);
  const stats = await fs.stat(resolvedPath);

  const directoryPath = stats.isDirectory()
    ? resolvedPath
    : path.dirname(resolvedPath);

  const result = await walkAudioFiles(directoryPath, preferences);
  await preferencesStore.set({ lastInputDir: directoryPath });
  return result;
});

app.whenReady().then(async () => {
  await loadPreferences();
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
