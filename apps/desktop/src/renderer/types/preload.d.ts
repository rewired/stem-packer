import type { StemPackerApi } from '../../preload/preload';

declare global {
  interface Window {
    stemPacker: StemPackerApi;
  }
}

export {};
