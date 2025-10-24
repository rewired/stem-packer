# ADR 0003: App Shell and Preference Persistence

- Status: Accepted
- Date: 2024-12-05

## Context

The desktop client required an interactive shell to let artists pick stem folders, inspect detected audio files, and adjust packer defaults. The renderer previously offered only a placeholder hero. We needed to wire IPC to the main process for folder selection, persist user preferences in `app.getPath('userData')`, and expose them to the renderer so that ignore rules, output directories, and archive targets survive restarts.

## Decision

- Added an application shell with a header, About modal, drag-and-drop surface, and audio file table implemented with Tailwind + DaisyUI.
- Defined shared preference and scan result types under `apps/desktop/src/shared` for reuse across main, preload, and renderer.
- Implemented a main-process preference store backed by JSON in the user data directory and exposed IPC endpoints for reading/updating preferences, choosing folders, and scanning directories.
- Used `picomatch` to enforce ignore globs while traversing folders and filtered the file table to supported audio extensions.
- Persisted the last input directory and replayed its scan on startup to restore context.

## Consequences

- User settings survive restarts and can be edited via the renderer without leaving the app.
- Drag-and-drop and picker actions reuse the same scan pipeline, ensuring consistent ignore handling and file listings.
- The shared type module keeps IPC payloads type-safe across processes.
- Additional packing features can build on the established IPC channels without reshaping the UI skeleton.
