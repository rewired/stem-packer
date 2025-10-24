import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppInfo,
  ChooseFolderResult,
  Preferences,
  ScanResult
} from '../shared/preferences';
import type {
  CollisionCheckPayload,
  CollisionDetectionResult,
  CollisionResolutionResult
} from '../shared/collisions';
import type { ArtistProfile } from '../shared/artist';
import type { PackingRequest, PackingResult, PackingProgressEvent } from '../shared/packing';

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
  },
  detectCollisions: async (
    payload: CollisionCheckPayload
  ): Promise<CollisionDetectionResult> => {
    return ipcRenderer.invoke('packing:detect-collisions', payload);
  },
  overwriteCollisions: async (
    payload: CollisionCheckPayload
  ): Promise<CollisionResolutionResult> => {
    return ipcRenderer.invoke('packing:overwrite-collisions', payload);
  },
  getArtist: async (): Promise<ArtistProfile> => {
    return ipcRenderer.invoke('artist:get');
  },
  saveArtist: async (artist: string | ArtistProfile): Promise<ArtistProfile> => {
    const payload = typeof artist === 'string' ? artist : artist.artist;
    return ipcRenderer.invoke('artist:set', payload);
  },
  startPacking: async (request: PackingRequest): Promise<PackingResult> => {
    return ipcRenderer.invoke('packing:start', request);
  },
  cancelPacking: async (): Promise<boolean> => {
    return ipcRenderer.invoke('packing:cancel');
  },
  onPackingProgress: (listener: (progress: PackingProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: PackingProgressEvent) => {
      listener(progress);
    };
    ipcRenderer.on('packing:progress', handler);
    return () => {
      ipcRenderer.removeListener('packing:progress', handler);
    };
  },
  onPackingResult: (listener: (result: PackingResult) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, result: PackingResult) => {
      listener(result);
    };
    ipcRenderer.on('packing:result', handler);
    return () => {
      ipcRenderer.removeListener('packing:result', handler);
    };
  },
  onPackingError: (listener: (error: { name: string; message: string }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      error: { name: string; message: string }
    ) => {
      listener(error);
    };
    ipcRenderer.on('packing:error', handler);
    return () => {
      ipcRenderer.removeListener('packing:error', handler);
    };
  }
};

contextBridge.exposeInMainWorld('stemPacker', api);

export type StemPackerApi = typeof api;

declare global {
  interface Window {
    stemPacker: StemPackerApi;
  }
}
