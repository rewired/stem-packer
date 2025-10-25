# ADR 0014: ZIP Non-Splittable Warning Badges

## Status

Accepted

## Context

StemPacker already surfaces mono-split eligibility and oversized split failures, but users packing
lossy or policy-protected stems that exceed the ZIP ceiling received no early guidance—the packer
would later throw when a single asset breached the size budget. We need to warn proactively, align
the estimator with runtime behaviour, and nudge engineers and artists toward 7z volumes when ZIP is
a dead end.

## Decision

* Introduce a pure `predictExcessNonSplittables` helper that mirrors the estimator’s mono-split
  logic and classifies oversize files using shared ZIP ratio thresholds.
* Store the thresholds in a new `@stem-packer/shared` config module so both main and renderer code
  consume identical severity cut-offs (>=100% = warning, >=120% = critical).
* Surface inline DaisyUI badges ahead of each affected filename when ZIP mode is active. Badges use
  Material Symbols, localized copy, and a tooltip that recommends switching to 7z volumes.
* Hide the badges automatically when the user switches to 7z mode to avoid redundant alerts.
* Expand Vitest coverage across the estimator, FilesTable, and App flows to assert severity styling,
  tooltip accessibility, and ZIP/7z behaviour stays in sync with the packing engine.

## Consequences

* The renderer now consumes predictor output on every render, so future changes to splitting rules
  must update the shared helper to stay consistent.
* Translators gain three new strings to describe the warnings and tooltip, and the CHANGELOG captures
  the UX tweak for release notes.
* The shared workspace package introduces another build target, but consolidating thresholds reduces
  the risk of mismatched heuristics between renderer and main processes.
