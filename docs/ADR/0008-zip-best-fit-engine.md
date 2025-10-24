# ADR 0008: ZIP Best-Fit Packing Engine

## Status

Accepted

## Context

StemPacker must ship with a deterministic ZIP engine that honors the user-selected `targetSizeMB`, enforces ignore rules, and
streams data so the UI can report progress or cancel safely. Until now, the packer was a placeholder, leaving the desktop shell
unable to create archives for real-world sessions or to validate estimator output.

## Decision

* Introduce a dedicated `@stem-packer/pack-engine` workspace package that exposes bin-packing utilities and a ZIP best-fit runner.
* Use a first-fit decreasing / best-fit hybrid planner that sorts files by size, keeps metadata overhead in reserve, and emits
  `stems-XX.zip` archive names deterministically.
* Reapply the global ignore defaults plus user-defined globs inside the engine to provide defense in depth against accidental
  archive pollution.
* Build archives with `yazl` so file contents stream straight from disk to disk, enabling responsive progress updates and
  ensuring that aborting via `AbortController` tears down every open stream before removing partial outputs.
* Surface structured progress payloads (`{ state, current, total, percent, message, currentArchive }`) so the main process can
  forward them over IPC without reshaping.

## Consequences

* Packing logic now lives in a reusable module that both the estimator and desktop app can share, reducing drift between
  planning and execution.
* Cancellations are safe: pending read streams close, partially written archives are deleted, and the caller receives a domain
  error (`AbortPackingError`).
* By accounting for metadata overhead during bin planning, every produced archive respects the configured size ceiling and stays
  consistent across operating systems.
* The additional package increases build graph breadth slightly, but Vitest coverage enforces the ignore contract, cancellation
  behavior, and size distribution guarantees demanded by the product brief.
