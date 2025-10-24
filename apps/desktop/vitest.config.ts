import { defineConfig, mergeConfig } from 'vitest/config';
import path from 'node:path';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: [path.resolve(__dirname, 'vitest.setup.ts')],
      globals: true,
      include: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/__tests__/**/*.{ts,tsx}',
        '../main/**/*.test.ts',
        '../main/**/__tests__/**/*.{ts,tsx}'
      ]
    }
  })
);
