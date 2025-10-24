import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: {
    main: 'src/main/main.ts',
    preload: 'src/preload/preload.ts'
  },
  format: ['cjs'],
  sourcemap: true,
  splitting: false,
  clean: !options.watch,
  dts: false,
  minify: false,
  target: 'node22',
  outDir: 'dist',
  outExtension() {
    return {
      js: '.cjs'
    };
  }
}));
