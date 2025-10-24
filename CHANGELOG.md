# Changelog

All notable changes to StemPacker will be documented in this file.

## [Unreleased]
### Added
- Wired the packing manager to stream progress IPC events, honor cancellations, and reject jobs
  when the destination lacks a safety margin of free space.
- Added persistent artist storage alongside existing preference fields plus Vitest coverage for
  cloning semantics.
- Documented quickstart steps, electron-builder packaging commands, and 7z prerequisites in the
  README.
- Configured electron-builder targets (macOS dmg/zip, Windows NSIS/zip, Linux AppImage/tar.gz) and
  a tag-triggered GitHub Actions job that builds release artifacts.
- Added regression coverage for progress event ordering and packing-manager cancellation cleanup.
- Created pack metadata and INFO.txt builders that encode UTF-8/no-BOM payloads with channel provenance, split strategy,
  and fixed English labels, alongside tests covering structure and localization guards.
- Added an ffprobe-backed `probeAudio` helper that extracts channel counts, masks, and canonical labels for multichannel
  sources.
- Implemented the desktop app shell with header, About modal, drag-and-drop input, and audio file table.
- Wired IPC folder selection, scanning, and preference persistence with JSON storage under the user data path.
- Introduced configurable packing preferences (target size, format, output directory, ignore rules) with localized UI strings.
- Added German locale alongside English with shared JSON catalogs and interpolation support.
- Exposed `createTranslator` helper with parameterized translations for main and renderer processes.
- Documented fixed-English `INFO.txt` labels and protected them with unit tests.
- Integrated the Material Symbols Outlined icon system with a shared `<Icon />` wrapper that supports variation controls.
- Applied preference-driven ignore globs across scanning, estimation, and packing with UI feedback, defaults, and tests.
- Delivered a deterministic archive estimator that reports ZIP best-fit and 7z volume counts, including multichannel mono splits, via a 10-second toast summary.
- Added overwrite/abort collision handling with localized dialogs, deletion safeguards, and renderer + main process tests covering ZIP archives and 7z volume sets.
- Implemented the streaming ZIP best-fit pack engine with deterministic bin planning, cancellation safety, and ignore-rule enforcement.
- Added a 7z volume pack engine that stages metadata once, enforces ignore rules, resolves bundled/system binaries, parses progress output, and deletes orphaned `.7z.00N` parts after failures or cancellation.
- Added a multichannel split planner that maps lossless surround stems to mono outputs and flags oversize cases requiring 7z volumes.
- Implemented a lossless multichannel split executor that renders mono temp files via `ffmpeg`, tracks cleanup, and verifies naming + lifecycle through integration tests.
- Introduced a multichannel split decision dialog that offers mono splits, 7z volumes, or cancellation with localized UI and flow tests.

### Changed
- Ensured renderer notifications render Material icons and expanded ESLint checks to prevent emojis in TSX/MDX content.

### Fixed
- Replaced direct imports of `node:child_process/promises` in the pack engine with a
  `child_process` + `util.promisify` wrapper so Electron runtimes missing the
  built-in promises module no longer fail during startup.
- Normalized 7z spawn error handling so launch failures (including Windows spawn EFTYPE cases) report a consistent "7z exited"
  message and still clean up orphaned volume files across platforms.
- Published `@stem-packer/i18n` as CommonJS so the Electron main bundle can require translators without export resolution errors.
- Prebuilt internal workspace packages before launching the desktop dev server to prevent missing module failures when Electron boots.
- Emitted CommonJS builds (with declarations) for `@stem-packer/pack-engine` and exposed them via package exports so the Electron
  main bundle can resolve the workspace dependency without "exports" lookup failures.

## [0.1.0] - 2024-12-04
### Added
- Initialized the StemPacker pnpm monorepo with Electron, Vite, React, and TypeScript foundations.
- Configured Tailwind CSS with DaisyUI dark theme, ESLint, Prettier, and Vitest across the workspace.
- Established documentation scaffolding and continuous integration pipeline.
