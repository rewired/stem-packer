# ADR 0006: Archive Estimator Toast

## Status

Accepted

## Context

Scanning should immediately communicate how many archives StemPacker will produce under the current preferences. The estimator must
cover ZIP best-fit packing, 7z volume counts, and multichannel mono splits when enabled. UX requirements additionally mandate a
toast that remains visible for at least ten seconds.

## Decision

* Share the estimation logic between main and renderer by importing the deterministic `estimateArchiveCount` helper.
* Extend audio file metadata with optional channel counts so the estimator can approximate mono split output sizes when lossless
  multichannel stems exceed the configured archive size.
* Implement a best-fit decreasing bin packer for ZIP counts and a total-size ceiling for 7z volumes, tracking any simulated mono
  splits to surface them in the toast copy.
* Replace the prior ignored-file toast with a combined archive summary message that interpolates ZIP, 7z, split, and ignored
  counts and persists on screen for ten seconds via a dedicated toast hook.

## Consequences

* Renderer scans now always surface archive expectations without waiting for a packing run, while maintaining ignore-rule
  feedback in the same toast.
* Tests cover estimator determinism, split-sensitive counts, and toast timing to guard against regressions.
* The renderer gains a reusable toast hook that enforces the mandated visibility duration for any future notifications.
