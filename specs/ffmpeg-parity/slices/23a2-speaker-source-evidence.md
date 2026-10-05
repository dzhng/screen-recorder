# 23a2 — Source-bound speaker publication and reads

Status: queued after the passed [original30s runtime seam](23a1-speaker-runtime.md).
Question: **Can one explicit source observation publish durable anonymous speaker
evidence, and can reads preserve that evidence through an immutable revision?**
This slice does not expand native input length or select a shipping runtime.

## Contract and existing owners

An explicit preparation request selects one immutable audio asset/stream, optional
acquisition context, one channel and exactly 30 seconds of completely available
source support. Core [source selection](../../../packages/core/src/source-selection.ts)
owns asset bytes, stream origin and availability. The existing native source-PCM
owner supplies the prepared window; freeze its decoder/resampler identity,
physical frame count, sample rate and complete PCM hash before worker invocation.
No silence fill, hole concatenation, implicit channel mix or fallback decoder.
The selected channel is one zero-based source channel; mono is channel zero.

The source range uses the repository's normalized source clock and exact range
schema. Require its admitted start to land on the prepared 16k sample grid; retain
the exact offset when translating native 80ms rows and endpoints into source time.
Support, channel and decode recipe are bound metadata, not extra worker opinions.
If an existing source decoder cannot satisfy this contract, retain that refusal
and resolve a separate PCM-authority seam before inference. A decoder difference
cannot borrow equality with the original prepared PCM or its quality result.

Use the shared Models preparation/runtime accessor and existing jobs/attempts.
Execution uses the existing JSON process owner and exact original worker. Register
only the actual verified descriptor/digest with actual model resources and notices;
`model.prepare` requires explicit local modelSource/runtimeSource for this initial
closure, without a downloadable runtime placeholder or install during execution.
Reads do not prepare, download or invoke models. A missing optional model is
explicitly unavailable:model_not_prepared. Existing job retry/cancel owns recovery.

Durable acoustic observations belong to the asset, selected stream/channel,
acquisition/support descriptor and exact observation range. Add this evidence
family to the shared core catalog and retention/reference boundary, following
[transcript publication](../../../packages/core/src/transcript.ts) and
[scene generations](../../../packages/core/src/scene-evidence.ts) for owner,
staging, attempt fencing and reclamation. These establish the lifecycle, not
permission to append speaker records to the capture-journal validator or rewrite
transcript words. A family-specific store may own acoustic data; it cannot own
another catalog, queue, file installer or process supervisor.

## Public seam and data meaning

Add shared protocol operations `speaker.prepare` and `speaker.get` (proposed
names until implemented). Preparation accepts source selection, explicit channel,
sourceRange, pinned modelId and the existing retry identity; it returns the
existing durable job/readiness envelope. Preparation is source-only. A repeated
request joins the same job/end state, while explicit failed-job retry creates a
fresh attempt/generation. The caller cannot choose another recipe through hidden
worker arguments.

`speaker.get` selects either the same source/channel observation range or a
project/revision/range/trackIds. Its limit uses the existing evidence page bound,
and continuation uses an opaque cursor. Readiness is unavailable, not_ready or
ready with pinned source coverage and rows. Continue while nextCursor exists,
even for an empty page. A first source read requires the observationRange that
selects its generation; optional query sourceRange narrows display without
changing the stored observation or inference. A project read uses only existing
ready source generations; unobserved support is explicitly unavailable and does
not schedule work. A source window and a project occurrence are different keys.

Each generation binds owner/source SHA, stream/channel, acquisition/support
digest, normalized observationRange, prepared PCM hash/frames/rate, decoder and
preparation recipe, model/checkpoint/runtime/worker identities, complete native
receipt SHA and worker measurement scope. Retain complete native operands before
validation, including dtype/shape/raw scores and original segment lines.
Publication makes validated rows and their generation visible atomically only
while the source, support and job attempt still agree. A cancellation, replaced
attempt, deleted owner, malformed receipt or native endpoint outside physical
support cannot publish a partially ready generation.

Interval rows carry generation-local ordinal, anonymous slot 0–3, complete source
range and identity:`unknown`. Simultaneous slots coexist, with no argmax collapse.
A slot belongs only to this one observation/generation; slot zero in another
window, channel or generation is not the same person. Rows do not contain a
made-up confidence number. A separate bounded raw-score page/receipt exposes the
native 375×4 sigmoid matrix as uncalibrated scores on its exact 80ms grid. It never
names a person or estimates correctness of an assignment. Below-threshold cells
are native output, not proof of silence; unobserved/unsupported ranges are not
measured gaps or unknown speakers with invented intervals.

Project rows reuse [source range projection](../../../packages/composition/src/source-projection.ts)
and the existing [project evidence manifest/cursor owner](../../../packages/core/src/project-evidence.ts).
They preserve clip/track occurrence identity, generation-local slot and ordinal,
complete original source range, exact surviving project/source fragments and
whole/partial status. A narrower display query does not redefine editorial
completeness. Repeated/retimed occurrences never rerun inference or merge slot
identities. Deterministic ordering uses existing evidence merge keys; simultaneous
rows may span pages and keep their identities.

Cursor identity pins the original revision/query, source selections and exact
observation generations. Replacement cannot silently switch a continuation to
new scores: reuse the existing ARTIFACT_CHANGED contract. Unchanged source
observations survive ordinary source/project reads and service restart.

## Persistence and compatibility boundary

Store validated generation metadata and interval rows in the existing catalog;
retain the small complete native receipt as an owned immutable artifact under
existing source evidence references. Keep the original source/media untouched.
Exact SQL names, internal helper decomposition and bounded batching are delegated;
source/model/slot/publication meaning is not. Reuse existing owner retirement,
job fencing and source file admission rather than implementing lookalikes.

Fresh catalogs can add this family under the current format only if all prior
writers/readers and package preservation remain compatible. Before changing a
portable package schema, catalog format or refusal behavior, freeze that decision
in this slice and the compatibility owner. Do not add automatic migrations,
untyped opaque companions or dev compatibility aliases. Existing package export
must not silently drop retained speaker evidence; if portable retention requires
another seam, explicitly refuse that package operation and reslice portable
support before calling this slice complete.

## Test-first verification and review artifact

Use controlled execution responses for source/publication tests; reuse the
accepted original output and frozen runtime operands. No repeat assembly or model
run is needed to prove lifecycle/projection. Preserve complete inputs and raw
results before assertions.

1. Red/green source admission: wrong asset/stream/channel/hash/clock, off-grid
   start, non-30s extent, incomplete acquisition, stale source/support/model pin
   and unavailable runtime refuse without inference/download or publication.
2. Red/green controlled source job: exact worker request, complete scores/native
   axes, overlapping slot intervals and explicit unknown identity survive.
   Native malformed/nonfinite/out-of-support results remain retained refusals.
3. Existing real job/catalog owners prove restart, lost acknowledgement,
   joined request, cancel/retry, replacement generation, late stale reply and
   deletion during publication. Reclaim failed attempts without deleting retained
   published observations or original media.
4. Public CLI/MCP journey reads one retained 30s observation on a source and an
   authored revision with repeated, retimed and partly removed occurrences.
   Compare complete source rows/score bytes and exact projection fragments;
   ready reads require no prepared model. Exercise narrow queries, empty pages,
   overlap page boundaries, generation replacement and stale continuations.
5. Check the narrow existing library/package preservation controls affected by
   the persistence extension. If a source decoder is connected, freeze a
   no-inference PCM comparison first; a new model-bearing execution is justified
   only by an unresolved preservation concern and a separately frozen protocol.

The focused human artifact is the source and project JSON proof with exact
receipts and coverage, including an unchanged generation read after restart.
Use review/refactor-clean/code-review/write-docs and an independent Codex review
before the checkpoint commit. This nonvisual evidence slice needs no new media
render or personal recording. It does not establish arbitrary-length mechanics,
long-form speaker continuity, known-person identity, confidence calibration,
population quality or consumer release readiness.

## Next agent

Start with source admission and controlled publication tests through the real
source/catalog/jobs owners. Freeze the exact shared public schemas before changing
persistence, inspect package retention, and resolve a scope conflict by reslicing
instead of inventing a compatibility mechanism. Keep the accepted 30s worker and
runtime sources intact; do not rerun their expensive checkpoint. Update this
status and the owning plan handoff before ending the pass.
