import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppInfo,
  ChooseFolderResult,
  Preferences,
  ScanResult
} from '../shared/preferences';

const api = {
  getVersion: () => process.versions.electron,
  getAppInfo: async (): Promise<AppInfo> => {
    return ipcRenderer.invoke('app:get-info');
  },
  chooseInputFolder: async (): Promise<ChooseFolderResult> => {
    return ipcRenderer.invoke('dialog:choose-input-folder');
  },
  scanFolder: async (folderPath: string): Promise<ScanResult> => {
    return ipcRenderer.invoke('scan:folder', folderPath);
  },
  getPreferences: async (): Promise<Preferences> => {
    return ipcRenderer.invoke('preferences:get');
  },
  savePreferences: async (preferences: Partial<Preferences>): Promise<Preferences> => {
    return ipcRenderer.invoke('preferences:set', preferences);
  }
};

contextBridge.exposeInMainWorld('stemPacker', api);

export type StemPackerApi = typeof api;

declare global {
  interface Window {
    stemPacker: StemPackerApi;
  }
}
