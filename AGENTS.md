# AGENTS.md — StemPacker (English)

## Mission

Build **StemPacker**, an Electron app that packs audio stems into size-capped bundles (default **50 MB**, configurable):

* Formats: **ZIP (best-fit)** or **7z (volume split)** — selectable in UI.
* Every archive includes **`PACK-METADATA.json`** and **`INFO.txt`** with: `artist`, `title`, `album?`, `bpm`, `key`, `license`, `attribution`.
* **`INFO.txt` labels are fixed English** (`Title`, `Artist`, `Album`, `BPM`, `Key`, `License`, `Attribution`) — never localized.
* Persist **Artist** and **Preferences**.
* On folder scan (drag-and-drop or picker), show an **archive count estimate** as a **toast** visible **≥ 10 s**.
* Provide an **About** dialog.

## Tech / Tooling (hard requirements)

* **Node.js 22 LTS**, **pnpm**
* **Electron** `^38.2.0`, **Vite** `^7.1.7`, **@vitejs/plugin-react** `^4.3.1`
* **React** `^18.3.1`, **react-dom** `^18.3.1`
* **Tailwind + DaisyUI** (Dark theme default)
* **electron-builder** `^24.13.3`
* Dev: **concurrently** `^8.2.2`, **wait-on** `^7.2.0`
* Tests: **Vitest** (RTL if helpful)
* Lint/Format: **ESLint + Prettier**
* CI: **GitHub Actions** (Node 22, pnpm cache)

## i18n (strict, snake_case)

* No hard-coded UI strings in Main/Renderer/Tests.
* Keys use **snake_case** (e.g., `button_pack_now`, `dialog_overwrite_title`).
* JSON per locale (e.g., `src/i18n/locales/en.json`, `de.json`).
* **Exception:** `INFO.txt` labels are fixed English and not sourced from i18n.

## UI Icons (policy)

* **No emojis anywhere** (UI, toasts, progress, dialogs, tests).
* Use **Google Material Icons (Material Symbols)** via a small `<Icon name="..."/>` wrapper.
* Default style: **Outlined** (Rounded allowed only for legibility).
* ESLint guard blocks emoji literals in TSX/MDX.

## UX & State Machine

* Calm Dark UI; clear actions; progress bar + **Cancel** during packing.
* States: `idle → scanning → ready → packing → (idle | error | cancelled)`.
* **Overwrite/Abort** on output collisions:

  1. **Ignore → Overwrite** (delete conflicting outputs, continue)
  2. **Abort → Idle** (clear selection, wait for new folder)

## Packing Engine

* **ZIP (best-fit):** deterministic bin-packing (FFD/BF) without exceeding `targetSizeMB`.
* **7z (volumes):** `.7z.001 …`; include **`PACK-METADATA.json`** and **`INFO.txt`** **once** at archive root (not per volume).
* **Multichannel lossless split (WAV/AIFF/FLAC):**

  * Trigger when `channels > 1` **and** file **> targetSizeMB**.
  * Mode: **mono per channel**. Names:

    * With channel map: `{base}_{L|R|C|LFE|Ls|Rs|…}{ext}`
    * Fallback: `{base}_chNN{ext}` (1-based).
  * Setting: `auto_split_multichannel_to_mono` (default **off**).
  * If **off** and a candidate exists → dialog: **Split**, **Use 7z volumes**, or **Cancel**.
  * Edge case: if any mono still **> target**, only **7z volumes** is offered.
* **Estimator** accounts for splits (N monos ≈ totalBytes/N + per-file overhead).

## Ignore Rules (preferences, no external file)

* Preferences:

  * `ignore_enabled: true`
  * `ignore_globs: string[]` (editable)
  * Defaults: `["**/.DS_Store","**/Thumbs.db","**/~*","**/*.tmp","**/*.bak","**/.git/**","**/*.cue","**/*.m3u*"]`
* Applied in **scan**, **UI list**, **estimator**; re-enforced in **packer** (defense-in-depth).
* UI shows “ignored: N” and a toast with count.

## Persistence

* Stored in `app.getPath('userData')` (e.g., `settings.json`, `artist.json`):

  * `artist`, `targetSizeMB`, `format`, `auto_split_multichannel_to_mono`, `ignore_*`,
    `lastInputDir`, `outputDir`, optional presets.

## Overwrite / Abort semantics

* Detect collisions with session naming base:

  * ZIP: `stems-01.zip`, `stems-02.zip`, …
  * 7z: `stems.7z.001 …`
* **Ignore → Overwrite:** delete matching outputs (entire 7z sequences).
* **Abort → Idle:** stop and reset selection.
* Toasts: `toast_overwrite_done`, `toast_action_cancelled`.
* Only match **StemPacker-like** outputs (do not touch foreign archives).

## Progress, Cancel & Naming

* Progress IPC: `{ state, current, total, percent, message, currentArchive }`.
* Cancel: close streams and temp files safely.
* Naming: ZIP `stems-01.zip`, 7z `stems.7z.001`, mono files `{base}_{label|chNN}{ext}`.

## Metadata formats

* `PACK-METADATA.json`: pack settings, `originalChannelCount`, `splitStrategy`,
  per-file: `derivedFrom`, `channelIndex`, `channelLabel`, `channelMapSource`.
* `INFO.txt`: fixed-English template (UTF-8, no BOM; line endings policy defined).

## Robustness & Security

* Path sanitization, Unicode/long paths (Windows), safe temp lifecycle, streaming/backpressure.
* Free-space pre-check with margin.
* Deterministic mode: stable sort, normalized timestamps where feasible.

## Quality Gates (must be green)

* `pnpm lint` • `pnpm typecheck` • `pnpm test` • `pnpm build` • `pnpm dev` runs.

## Testing Strategy

* Unit: bin-packing, glob matcher, probe mapping, split planner, collision detector.
* Integration: estimator (with/without split), overwrite/abort, pack ZIP/7z, metadata presence, ignore enforcement.
* E2E: large multichannel at 50 MB cap; overwrite vs abort; cancel mid-pack; `INFO.txt` labels remain English under non-EN locale.

## Repo layout (suggested)

```
/apps/desktop
/packages/pack-engine
/packages/ui          # shared UI bits (e.g., <Icon/>)
/packages/i18n        # optional
/.github/workflows
```

## Scripts (pnpm)

`dev`, `build`, `lint`, `typecheck`, `test`, `package:*` (per-platform).
