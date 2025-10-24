import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createTranslator } from '@stem-packer/i18n';

const isDevelopment = process.env.NODE_ENV === 'development';
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const t = createTranslator('en');

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

app.whenReady().then(async () => {
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
