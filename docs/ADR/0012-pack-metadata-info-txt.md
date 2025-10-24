# ADR 0012: Pack Metadata and INFO.txt Generation

## Status

Accepted

## Context

StemPacker archives must include machine-readable metadata describing how stems were packed and a fixed-English `INFO.txt`
summary for downstream clients. Previous iterations only documented the labels without providing a concrete implementation for
the metadata payload or validating the encoding requirements. As the packing engine begins emitting mono splits and 7z volumes,
we need deterministic metadata that records channel provenance, split strategies, and label sources while ensuring text files
remain UTF-8 without byte-order marks.

## Decision

* Add a main-process helper that constructs `PACK-METADATA.json` with:
  * pack settings (`format`, `targetSizeMB`, `autoSplitMultichannelToMono`).
  * user-supplied info fields (`title`, `artist`, `album`, `bpm`, `key`, `license`, `attribution`).
  * per-file entries capturing `relativePath`, `sizeBytes`, `originalChannelCount`, `splitStrategy`, `derivedFrom`,
    `channelIndex`, `channelLabel`, and `channelMapSource`.
  * deterministic ordering and ISO timestamp generation.
* Generate `INFO.txt` from the same helper using the fixed English labels and LF line endings, encoded as UTF-8 without BOM.
* Extend the pack-engine multichannel split planner/executor to track `channelMapSource` derived from ffprobe channel masks or
  fallback labels, propagating this metadata into the JSON payload.
* Cover both artifacts with unit tests that verify JSON structure, channel annotations, fixed English labels, and text encoding
  (including the “Key” label under non-English locales).

## Consequences

* Future packing flows can pull a ready-to-embed metadata array directly from the helper, keeping UI inputs and archive content
  synchronized.
* Tests now enforce the UTF-8/no-BOM contract for `INFO.txt` and guard against accidental localization of the Key label.
* The pack-engine split types surface `channelMapSource`, enabling richer provenance tracking for mono stems and ensuring
  downstream consumers understand how labels were derived.
