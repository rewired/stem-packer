# ADR 0010: Audio Probe and Channel Mapping

## Status

Accepted

## Context

StemPacker must understand the characteristics of incoming audio files so it can decide between straight packing, 7z volumes,
 or per-channel mono splits. The pack engine currently lacks an implementation that inspects source media to determine the cont
ainer format, byte size, channel count, and whether a channel mask is available for deriving human-friendly labels such as `L`,
 `R`, or `LFE`. We also need a deterministic mapping from WAVEFORMATEXTENSIBLE channel masks to the naming convention used when
 splitting multichannel stems.

## Decision

* Introduce a `probeAudio` helper in `@stem-packer/pack-engine` that shells out to `ffprobe` using the Node.js promises-based `
  execFile` API and parses its JSON response.
* Expose the detected format name, byte size, channel count, optional channel mask, and the resolved channel labels so callers
  can immediately display or act on them.
* Provide a `channelMaskToLabels` utility that recognises common surround layouts (stereo, 5.1, etc.) and otherwise falls back
  to deterministic `chNN` identifiers when the mask does not match known patterns.
* Cover the parser and mask mapping with Vitest unit tests that rely on mocked `ffprobe` results, ensuring the behaviour is sta
  ble without invoking external binaries during CI.

## Consequences

* The estimator and packing logic can make informed decisions about multichannel assets and use canonical labels when exporting
  mono stems.
* Depending on `ffprobe` keeps the implementation thin but requires bundling or discovering the binary at runtime; tests remai
  n fast because the process invocation is mocked.
* The centralised mapping logic simplifies future additions for immersive formats because the fallback strategy isolates unknow
  n masks from the rest of the system.
