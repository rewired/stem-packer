# 0002 - Internationalization Strategy

## Status
Accepted

## Context

The desktop application needs localizable strings for both the Electron main process and the React renderer without duplicating translation logic. Existing UI copy was hard-coded, and upcoming features require deterministic formatting (e.g., ignored item counts) while preserving the product requirement that `INFO.txt` labels remain in fixed English.

## Decision

- Maintain locale catalogs as JSON per locale (`en`, `de`) inside `@stem-packer/i18n` to keep translations colocated and shareable across packages.
- Expose a `createTranslator(locale, options?)` helper that returns a `t(key, params?)` function for both processes.
  - `params` supports simple `{placeholder}` interpolation with string or numeric values.
  - Unknown locales fall back to English.
- Document `INFO.txt` labels (`Title`, `Artist`, `Album`, `BPM`, `Key`, `License`, `Attribution`) in a dedicated module so they remain English-only and test-protected.

## Consequences

- Adding locales only requires a new JSON file and TypeScript import in `@stem-packer/i18n`.
- UI strings can be migrated incrementally without repeating formatting logic.
- Tests guard against accidental localization of `INFO.txt` labels, upholding the archival contract while still allowing the rest of the UI to be translated.
