# Risk-first ladder for slices 10 and 11: source/project inspection

This is a read-only draft. I made no edits and ran no builds or apps.

## What the code does today

- **The range engine is ready but nothing uses it yet.** `createSourceRangeProjection` (`packages/composition/src/source-projection.ts:71`) returns exact rational fragments, a whole/partial flag and a stable sort order (`:119-124`). Its only callers are composition tests; there are no service or core consumers.
- **Audio taps exist only in the plan.** `processingTapSchema` already supports dry / processed / after-step (`execution-window.ts:20-29`), and `compiler.window()` builds tapped manifests (`compiler.ts:193-226`). But preview only ever asks for the processed output (`project-preview.ts:165-168`). The only native composition operation is `media.renderCompositionMovie` (`project-render.ts:43`). There is no composition frame, PCM or WAV executor.
- **All evidence is keyed by recording.**
  - Source evidence tables are keyed by `(recordingId, sourceId, generation)` (`evidence.ts:159-175`).
  - Audio acquisition is limited to the roles `narration|system` (`evidence.ts:111`).
  - Transcript tables are keyed by `recordingId` (`transcript.ts:173-196`).
  - The transcript job target is `{kind:"recording", revisionId:"r0"}`, and it reads `${role}.mov` (`transcript-processing.ts:57,74`).
- **The old transcript cursor is ordered by source time.** It is `afterSourceUs/afterOrdinal` walking recording `spans` (`transcript-read.ts:145-159`; protocol `operations.ts:98`). Slice 10 forbids grafting a `clipId` onto this.
- **Composition "available" means the file has media there.** `compositionAsset` builds `available` from the probe's non-empty `segments` (`assets.ts:503-525`). Capture acquisition intervals are a different fact, so the two must stay separate.
- **Asset provenance can't carry capture metadata yet.** Provenance is a free JSON `{kind, source?}` row with primary key `(assetId, provenance)` (`assets.ts:61,92`), with no place for capture context. Jobs already accept an `asset` owner (`jobs.ts:37-41`).
- **Public read selectors are only `{recordingId} | {packageHandle}`.** They come from `inspection()` (`operations.ts:21-22`). `frame.get`, `audio.get`, `transcript.*`, `timeline.events` and `cursor.raw` have no project or asset member. `audio.get` still uses the role enum `narration|system|mix` (`:80`).

## Ordered steps (each can kill the plan early)

**R1 — Pure merge of occurrence evidence, in composition, no I/O.** This comes first because it is the "needs full-project expansion" failure named in slice 10.
- Add a function that takes the 10a projection, the compiler's clip `intervalIndex`, and one seekable reader per stream (`rowsFrom(assetId, streamId, sourceStart)`, ordered by source).
- It yields rows ordered by `(projectStart exact, trackRank, clipId, sourceOrdinal)` using a heap across the clips active at that point.
- Within one clip, rows come out in project order because the source-to-project mapping is affine with a positive rate.
- The cursor holds the last exact sort key plus a scan-budget watermark, so a page can be empty and still continue.
- Tests: repeated and reordered takes, rational retimes, tied track times, partial words at clip edges and internal holes, empty long gaps. Also a counter check that per-page work is bounded by active clips plus rows read, not all occurrences.
- Kill test: if resuming needs anything other than an interval query from the cursor's start time, split the index before going further.

**R2 — Per-track phrase matcher, pure, on top of R1.**
- Keep one sliding token window per selected track, merged across tracks by project time.
- A window resets at a track gap, an acquisition gap, or a partial word.
- It crosses contiguous clip boundaries on the same track in edited order.
- The fixture must fail if words from two simultaneous tracks could form a phrase.
- Source search keeps the existing adjacency logic, re-keyed.

**R3 — Split capture acquisition from the recording (core schema; highest durable risk).**
- Add one acquisition-context owner in the asset catalog: `contextId → [(assetId, streamId, role label, captureClockOffsetUs)]`.
- It also holds immutable journal-derived facts (audio acquired intervals, pauses, geometry, raw cursor).
- Asset provenance references `{kind:"capture", contextId}`.
- The same bytes can have several contexts (capture plus later imports). Only capture contexts carry acquisition facts.
- Contexts live as long as the asset, never as long as the recording or project, so deleting the donor leaves them intact.
- Raw evidence rows are copied by hash-validated adoption, never rewritten.
- Kill test: an adopted old recording, after its donor recording is deleted, still reports identical acquisition intervals and raw cursor samples. Compare against `evidence.test.ts` outputs by value, not IDs.

**R4 — Check what the transcript's input identity depends on (real model, corpus).**
- Today transcription is gated by acquired intervals (`planAudioTracks`, `audio.ts:118-164`).
- Transcribe corpus `a`/`b` segmented by media presence and compare with segmentation by acquisition.
- If words and timings match, a transcript is keyed by stream bytes + policy + model digest, and acquisition gaps are overlaid at read time.
- If they differ, the acquisition context becomes part of the transcript's input identity. It still goes through one ingestion path.

**R5 — One transcript ingestion, re-keyed to asset streams.**
- Extract the shared ingest/raw-retention/page primitives from `TranscriptStore` behind a subject key: `{assetId, streamId}`, plus `{recordingId}`.
- The `recordingId` subject is temporary scaffolding. Its removal condition is slice 23 cutover.
- The job target is `{kind:"asset"}` with input `streamId:policy:modelDigest`.
- Imported streams have no roles. A capture role label comes only from its context.

**R6 — ★ First public checkpoint** (details below).

**R7 — Project reads for events, index and cursor.**
- **`timeline.events {projectId}`:** clip-boundary markers from composition, plus scene and acquisition point events mapped through `sourceToProject` for every occurrence. Held pictures keep point semantics.
- **Index:** source screenshot indexes are keyed by video stream, and each project row is labelled `domain: source-raw` with its occurrence.
- **`cursor.raw`:** takes `{assetId, streamId}` and resolves the capture context. When several contexts exist it returns rows per context and never silently picks one.

**R8 — Direct project frames.**
- `frame.get/batch {projectId, tap?}` run `compiler.window({range: one frame interval, tap})` through a new native single-frame PNG operation that reuses the movie executor's layer path.
- It uses the slice 09 delivery tokens and the project deletion drain.
- Gate: frame membership and timing match the same range decoded from `preview.get`, within codec tolerance, including partial-picture boundaries.

**R9 — Audio taps (slice 11 core).**
- A native operation renders PCM for a window manifest; the movie operation shares it.
- `audio.get` gains `{projectId, range, tap}` and `{assetId, streamId, range}`. The source member is a raw decode through the executor's own source-decoder stage, keeping the stream's actual rate and layout. It is not a synthetic composition.
- Gates:
  - A range excerpt equals the full render at sample bounds.
  - Nested groups and bypass behave correctly.
  - The dry clip tap excludes parent processing and the manifest says so explicitly.
  - Stateful context/pre-roll for after-step taps works.
  - Retimed occurrences follow the sample count required by `retime`.

**R10 — Waveforms, spectrograms and full-track extraction.**
- `audio.waveform` returns min/max/RMS buckets from tap PCM, using a pyramid in the derived cache, with bucket origin, duration and channels declared.
- `audio.spectrogram` returns a bounded, axis-labelled PNG.
- Full-stream or full-mix WAV is a heavy-lane job.
- Silence/energy candidates are labelled heuristic.

## First useful public checkpoint (R6)

Import `repeated-speech.wav` with `asset.import`. Then call `transcript.get` / `transcript.search` with `{assetId, streamId}` (source scope). Build a project with `edit.apply` that repeats, reorders and retimes that speech. Then call `transcript.get` / `transcript.search` with `{projectId, revisionId?, trackIds?, range?}`.

The reads must return:
- every occurrence, with distinct `clipId`s;
- exact `EditTime` fragments;
- whole/partial flags;
- a revision pin and a generation-set digest.

Continuing across a newly published generation must fail with a stale-cursor error. Both CLI and MCP go through `node packages/test-harness/editing/evidence.mjs --fixture repeated-speech`.

No recording rows or roles are involved anywhere. This checkpoint is useful on its own: an agent can find every retained use of a word.

## Open decisions (recommended calls)

1. **Selectors.** Extend `inspection()` with flat, mutually exclusive members `{projectId}` and `{assetId, streamId}`. The selector implies the time domain. There is no `scope` wrapper, and the acquisition context is never a selector.
2. **Cursor pins.** Pin `revisionId` plus a digest of the sorted `(asset, stream, generation)` pairs in the range. Each row carries its own generation. Recompute the digest on continuation; a mismatch means the cursor is stale. This keeps cursors within the existing 4096-byte limit.
3. **Readiness.** Gate on every distinct audio stream referenced in the requested range and track filter, with a dependency status for each. Never page partial evidence. An audio stream with zero words is ready, not "no speech".
4. **Gap vocabulary.** Report `media_absent` (from occupied segments) separately from `not_acquired` (from a capture context, one entry per contextId). Authored silence produces no rows.
5. **Time output.** Report exact `EditTime` only, never rounded to integer µs, matching 10a.
6. **Adopting old recordings.** `asset.import` becomes a flat union `{requestId, path} | {requestId, recordingId}`. This is the bounded importer architecture.md already allows, and it is permanent. At slice 23, capture finalization calls the same core publication function.
7. **Full-track WAV.** Make `audio.get` range-optional, backed by a job with token/file delivery. Do not route it through `export.*` publication.
8. **Search cost.** Page linearly with a scan budget. A first-token candidate index is deferred to slice 24; record that budget there.

## Preservation and live gates

- **Stay green until slice 23:** `transcript-pages.test.ts`, `transcript.test.ts`, `event-pages.test.ts`, `audio.test.ts`, `evidence.test.ts`, `recording-deletion.test.ts`, `apps/macos/tests/transcript-service.test.mjs`, `audio-inspection.test.mjs`.
- **Composition:** `bun run --cwd packages/composition test`, including 10a and the compiler's partial-frame and sample-phase gates.
- **Slice 09 journeys** (`first-preview.mjs`) and CLI/MCP equivalence (`apps/cli/src/main.test.ts`).
- **New checks:**
  - donor-deletion survival (R3);
  - transcript parity between the adopted recording and the old recording path (R4/R5);
  - frames against decoded preview (R8);
  - range-vs-full PCM and tap parity (R9);
  - `audio-evidence.mjs --fixture speech-and-clicks` with impulse→bucket→pixel checks, then compare-screenshots and, last, screenshot-critique (R10).
- **Live agent run:** a fresh agent finds a labelled interval using only delivered artifacts and records honestly whether it could listen.
- Plumbing tests make no claim about speech-timing quality; that stays with 12/12b.
