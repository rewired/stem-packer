# ADR 0005: Preference-Driven Ignore Rules

## Status

Accepted

## Context

Stem folders regularly contain platform metadata files (e.g., `.DS_Store`, `Thumbs.db`) and helper exports (`*.m3u8`, `*.cue`) that should never enter packing jobs. We must enforce the ignore preferences consistently across the scanning pipeline, archive estimator, and packer while accounting for Windows backslashes and nested directories such as `.git/`.

## Decision

* Store the default ignore patterns alongside user preferences and hydrate them through the existing `PreferencesStore`.
* Centralize pattern evaluation in a `createIgnoreMatcher` helper that normalizes paths to POSIX separators before delegating to `picomatch` with `dot` support.
* Apply the matcher when traversing directories so ignored folders short-circuit traversal, incrementing an `ignoredCount` counter that is exposed to the renderer.
* Reuse the same matcher in the estimator and packer layers to ensure that even manually constructed file lists cannot leak ignored files into archive plans.
* Surface feedback in the renderer via an “ignored: N” badge and toast to explain why some files disappeared from the table.

## Consequences

* Tests cover POSIX and Windows-style paths, directory globs, and an integration path from scanning through packing to prevent regressions.
* The matcher module becomes the single enforcement point, simplifying future updates to ignore semantics or defaults.
* Renderer state now tracks the ignored count, enabling UX affordances around skipped files without duplicating filtering logic in the UI.
