# Shared frame materialization

[Frame materialization](../../../../packages/core/src/frame-materialization.ts)
owns rendering to an explicit output path: pinned revision mapping, requested-time
trail planning, native decoding, image/overlay receipt validation and compact
metadata. It returns the same frame metadata without a cache identity.

The caller owns admission, output publication and cleanup after failure or
cancellation. [Frame inspection](../../../../packages/core/src/frames.ts) keeps
its existing queue and disposable cache lifecycle. A retained index can call the
same materializer with a retained destination without creating a nested frame job
or copying a disposable cache entry. Both use one renderer and metadata projection.
The shared input takes already-effective rendering options and pinned source
evidence; obtaining that evidence remains the caller's dependency responsibility.

## Verification

- Build and workspace type checks pass in the isolated worktree. All 56 service
  tests, focused lint/format checks, and `git diff --check` pass.
- All 156 core tests pass, including existing cache/public frame error and
  cancellation checks. The direct materialization test covers clean bypass,
  annotated pinned source evidence, edited timing and caller-owned output that
  survives cache reconciliation.
- The new cut-mapping test was falsified by temporarily returning source time as
  playback time: it failed with 200 instead of the required 100 microseconds.
  Restoring the shared mapping returned green; the mutation is not committed.
- `SCREENREC_TRAIL_EVIDENCE=/tmp/frame-materialization-png-proof node --test
  apps/macos/tests/trail-inspection.test.mjs
  apps/macos/tests/sparse-frame-inspection.test.mjs
  apps/macos/tests/audio-inspection.test.mjs` passes all 12 generated-media tests
  against this worktree's bundled app and native worker.
- Every one of the eight delivered PNGs is byte-identical to its retained
  [public trail baseline](../public-trails/review.md), including clean,
  pointer-only, default/custom trail, pause and future-image outcomes. No visual
  treatment changed.

The shape review moved ownership rather than introducing another rendering path.
Native frame types live with materialization, and existing consumers import their
owner directly. Source and annotation summaries have one owner. This checkpoint
makes retained rendering available; it does not implement or close retained index
delivery or the physical acquisition gates.

Independent Codex review found no actionable defects and independently passed all
156 core tests and core type checks. It did not run native applications; the host
run and PNG byte comparison above supply that evidence. The decision audit found
no added product or storage policy: the internal function/type layout follows the
slice's delegated ownership boundary.
