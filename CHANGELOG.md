# Changelog

All notable changes to StemPacker will be documented in this file.

## [Unreleased]
### Added
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

### Changed
- Ensured renderer notifications render Material icons and expanded ESLint checks to prevent emojis in TSX/MDX content.

## [0.1.0] - 2024-12-04
### Added
- Initialized the StemPacker pnpm monorepo with Electron, Vite, React, and TypeScript foundations.
- Configured Tailwind CSS with DaisyUI dark theme, ESLint, Prettier, and Vitest across the workspace.
- Established documentation scaffolding and continuous integration pipeline.
