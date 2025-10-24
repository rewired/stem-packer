import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('stemPacker', {
  getVersion: () => process.versions.electron
});

export type StemPackerApi = {
  getVersion: () => string;
};

declare global {
  interface Window {
    stemPacker: StemPackerApi;
  }
}
