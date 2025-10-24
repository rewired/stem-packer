# ADR 0013: Packing Progress, Cancellation, and Persistence

## Status

Accepted

## Context

The desktop shell gained packing engines, but the UI still lacked feedback while archives were being
written, and jobs could not be cancelled mid-stream. We also relied on in-memory artist metadata and
had no guard against filling the destination disk during long sessions. With upcoming releases that
ship tagged builds via CI/CD, we need deterministic progress updates, cancellation wiring, a
pre-flight disk space check, and durable artist preferences so the renderer can restore state across
runs.

## Decision

* Introduce a dedicated `PackingManager` that orchestrates pack-engine calls, merges metadata, and
  forwards progress updates (`{ state, current, total, percent, message, currentArchive }`) over IPC.
* Surface a cancel endpoint that aborts the underlying `AbortController`, cleans partial archives,
  and resets the active job so the UI can resume scanning immediately.
* Perform a statfs-based free-space check with a 10%/128 MB safety margin before launching the pack
  job, rejecting requests when the output volume cannot accommodate the payload plus staging costs.
* Persist `artist` alongside preference fields in JSON under the user data directory and expose IPC
  helpers so the renderer can read/update the value without reimplementing file I/O.
* Expand Vitest coverage to lock progress event ordering, packing-manager cancellation cleanup, and
  preference/artist round-trip cloning semantics.
* Configure electron-builder targets and a tag-triggered GitHub Actions workflow that packages
  macOS, Windows, and Linux builds after the quality gates succeed.

## Consequences

* Renderer components can subscribe to deterministic progress, display the active archive, and offer
  a responsive cancel action without polling.
* Jobs fail fast when the destination disk is constrained, preventing partially written archives and
  time spent on doomed runs.
* Artist and preference changes persist across sessions, simplifying UX flows that reuse the last
  known context.
* The CI pipeline now emits ready-to-distribute artifacts on tagged releases, keeping packaging
  outputs in lockstep with test coverage.
