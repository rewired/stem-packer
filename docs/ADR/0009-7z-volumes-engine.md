# ADR 0009: 7z Volumes Packing Engine

## Status

Accepted

## Context

The product brief requires StemPacker to produce multi-part 7z archives that respect the configured target volume size, reuse the
ignore rules established for scanning, and embed `PACK-METADATA.json` plus `INFO.txt` once at the archive root. The existing pack
engine only handled ZIP output, leaving the estimator and overwrite flows without a real 7z implementation to exercise. We also
need cancellation support, deterministic progress payloads, and a cross-platform fallback so the desktop app can ship a bundled 7z
binary when the host system lacks one.

## Decision

* Add a `pack7zVolumes` runner to `@stem-packer/pack-engine` alongside the ZIP implementation.
* Stage metadata entries and source files inside a temporary workspace, enforce ignore globs again, and feed a 7z `@listfile`
  so the metadata appears exactly once at the archive root while user files retain their normalized relative paths.
* Resolve the 7z executable via a layered strategy (explicit option ➜ environment override ➜ PATH search ➜ `7zip-bin` fallback)
  to satisfy both system installations and bundled Electron builds without code changes.
* Stream progress by parsing the 7z CLI percentage output, relay structured progress payloads, and tear down the child process
  when an `AbortController` fires, deleting any partially written volume parts.
* Guard against orphaned `.7z.00N` files by scanning the output directory after failures or cancellations and removing every path
  that matches the active archive base name.

## Consequences

* The estimator, overwrite flow, and UI can now exercise a real 7z pipeline that mirrors production behavior, including naming
  (`stems.7z.001…`) and metadata placement.
* Temporary staging introduces a small amount of disk churn, but it avoids copying large files when hard-linking succeeds and is
  fully cleaned up even if the process aborts midway.
* The dependency on `7zip-bin` modestly increases the package footprint yet guarantees a working binary on CI and end-user
  machines where 7z is not preinstalled.
* New Vitest coverage locks in naming, ignore-rule enforcement, cancellation, and cleanup semantics so regressions surface early
  in CI.
