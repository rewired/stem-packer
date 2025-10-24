# StemPacker

StemPacker is an Electron application for packing audio stem folders into size-capped archives.
The project is built with pnpm, Vite, React, Tailwind CSS, and a shared pack engine that emits ZIP
or 7z volume sets with metadata describing each export.

## Quickstart

1. Install [Node.js 22 LTS](https://nodejs.org/en) and [pnpm 9](https://pnpm.io/installation).
2. Clone this repository and install dependencies:

   ```bash
   pnpm install
   ```

3. Launch the desktop shell in development mode:

   ```bash
   pnpm dev
   ```

   This runs the renderer on Vite, recompiles the main/preload bundles with tsup, and spawns
   Electron once both are ready.

4. Run the quality gates as needed:

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

## Packaging builds

The Electron distributables are produced with `electron-builder`. Platform-specific scripts live
under `apps/desktop`:

```bash
# macOS
pnpm --filter @stem-packer/desktop package:mac

# Windows
pnpm --filter @stem-packer/desktop package:win

# Linux
pnpm --filter @stem-packer/desktop package:linux
```

These commands expect the workspace to be built (`pnpm build`) so that shared packages expose their
compiled artifacts in `dist/`.

## 7z prerequisites

The pack engine shells out to a 7z binary when creating multi-volume archives. A bundled copy from
[`7zip-bin`](https://github.com/develar/7zip-bin) is used by default, but you can override it with
`STEM_PACKER_7Z_PATH` or by ensuring a compatible `7z`/`7za`/`7zz` executable is available on `PATH`.

For development on Linux the tests that interrogate 7z volumes also expect `p7zip` to be installed so
that listing commands succeed. On macOS and Windows install the official 7-Zip CLI if you plan to run
integration tests against the system binary.
