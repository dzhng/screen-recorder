# Acquisition gaps in public project pictures

The [executable journey](../../../../packages/test-harness/editing/acquisition-picture-evidence.mjs)
uses synthetic acquisition journals around real, identical audio/video files.
Everything is admitted through `acquisition.import`; the catalog, source probe,
compiler and native renderer use their production paths. This is not a physical-capture claim.

A video occurrence follows an audio parent through a content anchor. Context A
excludes an internal audio interval; context B and the occurrence without a context
retain it. The pictures therefore disappear only in A, with `anchor-unavailable`
provenance. The original video source remains readable in all three cases. The
comparison keeps byte identity, source ranges, placement rate and framing fixed.

[The report](report.json) covers CLI files and actual MCP inline bytes for direct
project pictures and retained screenshot entries, exact gap-neighbor selection,
sampled coverage, decoded preview pictures and historical reads after advancing
the head and restarting. A fresh picture request after restart resolves retained
media and acquisition evidence after donor deletion. The global frame clock still
owns visibility: a gap beginning between sample instants takes effect on the next
sample, and a request inside a displayed interval reports that entire interval.
The asymmetric source landmarks use the existing common-profile geometry oracle;
excluded pictures must be completely opaque black.

This satisfies 10d's public **project** pictures across selected acquisition gaps.
It does not establish direct-source video `acquisition_excluded`: public capture
admission currently derives video support from the file and audio support from
journal evidence. Direct narrower video masks remain covered by native/core tests.
Adding a public video-support producer would belong to 10b and require authoritative
capture evidence; an arbitrary editable mask API is not part of this journey.

The evidence retains the native binary hash and runtime hashes. No model download,
recording, desktop capture, audio playback, installed app or user library is used.

The retained [before report](before.json) fails on an actual public project frame:
the former executor rejected `anchor-unavailable` for the complete artifact. Its
older direct-native refusal check described an unfinished path; physical support
cannot repair ancestor availability, but a valid compiled exclusion must suppress
that layer. The executor now keeps the physical validation and emits a transparent
layer with its original exclusion reason. The direct-native gate checks actual
black output instead of that refusal; other source/timestamp/state refusals remain.
The selected-source physical/timestamp validation also rejects out-of-support
`anchor-unavailable` requests. Movie and picture recipe identities advance so previous terminal unavailable jobs
do not prevent execution under the completed contract.

Validation: [focused checks](focused.txt), [native temporal preservation](native.json),
[public runtime pins](runtime.json), and [independent code review](review.txt).
The native temporal run preserves the existing decoded membership and matched
baseline checks; it does not rerun the separate long-render resource gates.

[Complete visual review](visual/verdict.md) resolves the fresh critic's alignment
concern with exact source hashes, shape telemetry and a larger fresh comparison.
The direct source, project and index PNGs retain exact CLI/MCP byte equality.

Run the journey after building the TypeScript packages and freezing a native worker:

```sh
SCREENREC_NATIVE=/path/to/frozen-worker node packages/test-harness/editing/acquisition-picture-evidence.mjs --out /empty/output/directory
SCREENREC_NATIVE=/path/to/frozen-worker SCREENREC_BASELINE_NATIVE=/path/to/before-worker node packages/test-harness/editing/video.mjs --case repeat-reorder --out /empty/native/directory --temporal-only
```

Retained text logs normalize trailing whitespace; JSON receipts and media retain
their original bytes.
