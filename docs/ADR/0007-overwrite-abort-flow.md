# ADR 0007: Overwrite / Abort Collision Flow

## Status

Accepted

## Context

Packing sessions reuse the `stems-XX.zip` and `stems.7z.###` naming bases. Users often repack the same folders, so these names can already exist in the target directory. We must prevent accidental corruption by surfacing conflicts before packing starts and offer explicit actions that either delete the stale archives or return the app to the idle state.

## Decision

* Add a main-process collision detector that resolves the effective output directory (absolute, relative, or default-to-input) and scans only for StemPacker naming patterns: `stems-(\d{2,}).zip` and `stems.7z(.\d{3})?`.
* Expose IPC endpoints `packing:detect-collisions` and `packing:overwrite-collisions`, revalidating requests server-side before deleting files to guard against arbitrary file removal.
* Show a renderer modal when collisions exist. The modal presents two localized actions:
  * **Ignore and overwrite** — invokes the overwrite endpoint and emits a success toast once deletion completes.
  * **Abort** — clears the current selection and plays a cancellation toast so the UI returns to the idle state.
* Persist toast strings and dialog copy in the shared localization catalogs so future locales inherit the flow without hard-coded English.
* Cover the logic with integration tests (ZIP and 7z) plus renderer E2E tests that exercise both dialog paths.

## Consequences

* Collision checks run on every scan using the latest preferences, preventing stale files from entering future packing runs.
* The IPC boundary encapsulates deletion logic, ensuring only legitimate StemPacker outputs are touched while shielding the filesystem from malicious renderer input.
* Renderer state always aligns with the modal choice, reducing surprise by either removing conflicting archives or clearing the selection entirely.
* Additional translations and tests slightly increase maintenance overhead, but they guarantee consistent UX across locales and prevent regressions in overwrite handling.
