# ADR 0011: Lossless Multichannel Split Executor

## Status

Accepted

## Context

The split planner now determines when a multichannel lossless source (WAV, AIFF, FLAC) must be broken into mono stems to stay
within StemPacker's size ceiling. However, the pack engine lacked an implementation that actually performs the extraction. We
need to generate per-channel mono files using the planner's naming convention, ensure the process is lossless, keep the derived
assets available for packing, and reliably clean them up after success or cancellation. The executor must also respect the
cancellation signal shared with the packers and avoid deleting the original multichannel source.

## Decision

* Introduce an `executeMultichannelSplit` helper that shells out to `ffmpeg` with `-map_channel` and `-c copy` to extract each
  planned channel without recompression.
* Stage mono outputs inside a dedicated temporary directory (`stem-packer-split-*`) that mirrors the planner's `{base}_{label|chNN}{ext}`
  naming so downstream consumers can reuse the relative paths.
* Return `MonoSplitCandidate` records for every derived asset along with an idempotent `cleanup` hook and automatic abort-handler
  registration that removes staged files when the shared `AbortSignal` fires.
* Cover the executor with integration-style Vitest cases that verify command arguments, file naming, and temporary-directory
  lifecycle both for successful runs and abort scenarios.

## Consequences

* Packing orchestration can now consume real mono files that match the planner output while deferring cleanup until archives are
  written or a cancellation occurs.
* Using `ffmpeg` keeps the split lossless and dependable across supported formats but requires the binary to be bundled or
  discoverable at runtime, similar to the existing `ffprobe` dependency.
* The additional cleanup guarantees prevent temp directories from accumulating after cancellations, reducing disk churn during
  repeated packing sessions.
