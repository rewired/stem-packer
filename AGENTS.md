# AGENTS.md — StemPacker

## Mission

Build a modern Electron app **StemPacker** that packs audio stems into size-capped bundles (default **50 MB**, user-configurable):

* Formats: **ZIP (best-fit)** or **7z (volume split)** — selectable in UI.
* Every archive includes **`PACK-METADATA.json`** and **`INFO.txt`** (fields: `artist`, `title`, `album?`, `bpm`, `key`, `license`, `attribution`).
* **`INFO.txt` labels are always English** (fixed): `Title`, `Artist`, `Album`, `BPM`, `Key`, `License`, `Attribution` (never localized).
* **Artist** and **Preferences** are persisted locally.
* On folder scan (drag-and-drop or picker), show an **estimate** of resulting archive count as a **toast** visible ≥ **10 s**.
* Provide an **About** dialog.

## Tech / Versions / Tooling (hard requirements)

* **Node.js 22 LTS**, **pnpm**
* **Electron** `^38.2.0`, **Vite** `^7.1.7`, **@vitejs/plugin-react** `^4.3.1`
* **React** `^18.3.1`, **react-dom** `^18.3.1`
* **Tailwind + DaisyUI** (Dark theme default)
* **electron-builder** `^24.13.3`
* Dev: **concurrently** `^8.2.2`, **wait-on** `^7.2.0`
* Tests: **Vitest** (and RTL where helpful)
* Lint/Format: **ESLint + Prettier**
* CI: **GitHub Actions** (Node 22, pnpm cache)

## i18n policy (strict, snake_case)

* No hard-coded UI strings in Main/Renderer/Tests.
* Keys use **snake_case** (e.g., `button_pack_now`, `dialog_overwrite_title`).
* JSON resources per locale (e.g., `src/i18n/locales/en.json`, `de.json`).
* **Exception:** `INFO.txt` labels are fixed English and **not** pulled from i18n.

## UX & App States

* DaisyUI Dark, calm layout, clear actions; progress bar + **Cancel** during packing.
* State machine:
  `idle → scanning → ready → packing → (idle | error | cancelled)`
* **Overwrite/Abort** when output collisions are detected:

  1. **Ignore → Overwrite** (delete conflicting artifacts, continue)
  2. **Abort → Idle** (clear selection, wait for new folder)

## Packing Engine

* **ZIP best-fit:** Place files into multiple zips not exceeding `targetSizeMB`. Use FFD/BF-style bin-packing (deterministic order).
* **7z volumes:** Split archive into `.7z.001 …`; put **`PACK-METADATA.json`** and **`INFO.txt`** **once** at archive root (not in each volume).
* **Multichannel lossless split (WAV/AIFF/FLAC):**

  * Trigger when `channels > 1` **and** file **> targetSizeMB**.
  * Mode: **mono-per-channel**. Names:

    * With known channel map (e.g., WAVEFORMATEXTENSIBLE mask): `{base}_{label}{ext}` → `L, R, C, LFE, Ls, Rs, …`
    * Otherwise: `{base}_chNN{ext}` (1-based, two digits).
  * Setting: `auto_split_multichannel_to_mono` (default **off**).
  * If **off** and a candidate is found → dialog offers:

    * **Split to mono**, or **Use 7z volumes**, or **Cancel**.
  * Edge case: If even a mono channel would still exceed `targetSizeMB`, only **7z volumes** is offered.
* **Estimator** must account for potential splits (N monos ≈ totalBytes/N + per-file overhead).

## Ignore rules (no external file; Preferences-driven)

* Preferences:

  * `ignore_enabled: true`
  * `ignore_globs: string[]` (editable in Settings)
  * Defaults:

```
["**/.DS_Store","**/Thumbs.db","**/~*","**/*.tmp","**/*.bak","**/.git/**","**/*.cue","**/*.m3u*"]
```

* Rules apply in **scan**, **UI list**, **estimator**, and are enforced again by the **packer** (defense-in-depth).
* UI shows an “ignored: N” badge and a toast with the count.

## Persistence

* Store in `app.getPath('userData')` (e.g., `settings.json`, `artist.json`):

  * `artist`, `targetSizeMB`, `format`, `auto_split_multichannel_to_mono`, `ignore_*`, `lastInputDir`, `outputDir`, optional presets.

## Overwrite / Abort semantics

* Pre-flight: detect collisions with current session’s naming base:

  * ZIP: `stems-01.zip`, `stems-02.zip`, …
  * 7z: `stems.7z.001 …`
* **Ignore → Overwrite**: delete matching outputs (entire volume sequences for 7z) then proceed.
* **Abort → Idle**: stop and return to initial state.
* Toasts: `toast_overwrite_done`, `toast_action_cancelled`.
* Only match **StemPacker** outputs (avoid deleting unrelated zips).

## Progress, Cancel & Output naming

* Progress callback: state, current index/total, percent, current archive name.
* Cancel: closes streams and temp files safely.
* Naming:

  * ZIP: `stems-01.zip`, `stems-02.zip`, …
  * 7z: `stems.7z.001`, `.002`, …
  * Multi-mono outputs: `{base}_{label}{ext}` or `{base}_chNN{ext}`.

## Metadata formats

**`PACK-METADATA.json` (example):**

```json
{
  "artist": "Example Artist",
  "title": "Example Title",
  "album": "Optional",
  "bpm": 96,
  "key": "F#m",
  "license": "CC-BY-4.0",
  "attribution": "Example Artist - Example Title",
  "pack": {
    "format": "zip",
    "targetSizeMB": 50,
    "createdAt": "2025-10-24T09:00:00Z"
  },
  "originalChannelCount": 2,
  "splitStrategy": "mono_per_channel",
  "files": [
    { "name": "drums_L.flac", "bytes": 12345678, "derivedFrom": "drums.flac", "channelIndex": 0, "channelLabel": "L", "channelMapSource": "wav_channel_mask" },
    { "name": "drums_R.flac", "bytes": 12345678, "derivedFrom": "drums.flac", "channelIndex": 1, "channelLabel": "R", "channelMapSource": "wav_channel_mask" }
  ]
}
```

**`INFO.txt` (fixed English labels):**

```
Title: {title}
Artist: {artist}
Album: {album}
BPM: {bpm}
Key: {key}
License: {license}
Attribution: {attribution}

Packed with StemPacker • {date}
```

## Robustness & Security

* Path sanitization, Unicode & long paths (Windows), safe temp handling, backpressure/streaming for large files.
* Free-space pre-check with safety margin.
* Deterministic mode: stable sort, normalized timestamps where possible.

## Quality gates (must be green)

* `pnpm lint` → no lint errors
* `pnpm typecheck` → no TS errors
* `pnpm test` → all tests green; sensible coverage
* `pnpm build` OK; `pnpm dev` launches the app

## Testing strategy

* Unit: bin-packing, ignore-glob matcher, audio probe mapping, split planner, name/collision detectors.
* Integration: estimate math (with/without split), overwrite/abort flow, pack ZIP/7z, metadata presence.
* E2E (happy paths & edge cases): large multichannel file at 50 MB cap; overwrite vs abort; cancel mid-pack; INFO.txt labels remain English under non-EN locale.

---

## Repository layout (suggested)

```
/apps/desktop            # Electron main/renderer app
/packages/pack-engine    # Packing engine (zip, 7z, plan, probes, split)
/packages/ui             # Shared UI components (optional)
/packages/i18n           # i18n wiring & types (optional)
/.github/workflows       # CI
```

## Scripts (pnpm)

* `dev`: start Electron + Vite (concurrently + wait-on)
* `build`: Vite build, then electron-builder
* `lint`, `typecheck`, `test`
* `package:*`: per-platform packaging (win/mac/linux)
