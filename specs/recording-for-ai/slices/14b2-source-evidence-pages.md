# 14b2 — Portable normalized source queries

Status: implemented internal source-only checkpoint within [14b](14b-portable-inspection.md).
[Generated evidence](../assets/portable-inspection/source-pages.md). Scene/index
transport, whole-package inspection and native relocation parity remain open.

## One owner for time and uncertainty

The live SourceEvidenceStore and portable FileSourceEvidence both inherit the
[shared query owner](../../../packages/core/src/evidence-read.ts). Storage supplies
bounded ordered normalized records; the shared owner handles cursor continuation,
latest observations, timed/unplaced geometry, inclusive pause boundaries and
clipped audio acquisition. Neither reader rebuilds a clock or edit timeline.

The [directory format and producer](../../../packages/core/src/evidence-pages.ts)
store ordinary JSON record pages plus a versioned source identity and seek manifest.
Each page describes its first/last key, row/byte counts and SHA-256. Query-specific
orders preserve delivery sequence separately from timestamp order. Cursor records
appear in both time and sequence orders; geometry likewise retains its existing
query orders. The duplication buys direct bounded seeks without a database or a
whole-journal scan. Only queried normalized evidence is transported; this is not
an archival substitute for the immutable source journal/display-space history.

## Bounds and lifetime

The format caps page rows, page bytes, total page count and manifest bytes. The
reader binary-searches page boundaries, loads only contributing pages, and retains
no whole-record index or persistent cache. Existing per-query result limits still
apply. The producer yields between record batches and honors cancellation. An
exclusive output directory prevents overwriting another export; the manifest is
published by rename only after all pages are written.

A reader checks source identity, format version, key ordering, member names,
counts and hashes; changed/missing/truncated required pages fail explicitly.
Leaf symlinks and non-regular members are rejected. Page hashes detect divergence
from the loaded manifest; they do not authenticate a hostile rewritten manifest.
The later package inventory must pin these members like every other payload.

This checkpoint accepts an internally owned stable directory. It does not certify
untrusted ZIP extraction, mutable ancestor containment or descriptor-safe root
lifetime. Those remain 14c. The producer's caller must keep the published evidence
generation alive for the export; 14d owns export admission and deletion coordination.
Incomplete scratch output remains its caller's cleanup responsibility.

## Verification and next pickup

The generated fixture ingests real normalized evidence, crosses page boundaries,
exports it, closes/removes the original SQLite catalog and normalized file, then
moves the directory. It matches live cursor, geometry, pause and audio queries,
including buffered out-of-order observations, equal times, unknown continuation,
unplaced geometry and an audio interval preceding the query start. Shared trail
and audio planners consume the relocated reader. Their sampler/media boundary is
synthetic here; no native pixel/sample claim follows from this test.

Corruption and seek tests pin explicit errors, bounded member reads and no need to
load unrelated distant pages. A missing-pause mutation must break parity. Existing
library/frame/trail/audio/selection tests remain the live-consumer regression gate.

Next, apply this proven ordered-page approach to scene evidence and retained index/
coverage through their current owners. Do not generalize source-specific query
semantics into a second repository or reconstruct library rows. Then run the
original full-context/native relocation gate in 14b before expanding package handles.
