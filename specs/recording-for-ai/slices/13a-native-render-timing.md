# 13a — Native render timing feasibility

Status: membership and player-output gap checkpoints measured; product renderer and full
gate remain unimplemented. Dependency: the implemented core timeline/render
plan and native media worker seams. Independent of speech readiness and completion
of the CLI/MCP journey. Parent [13](13-edited-media.md) remains open.

## Current pickup

[The first bounded probe](../assets/render-membership/review.md) establishes
nonempty held-frame membership for dense/reordered and sparse generated sources.
Timestamped writer outputs preserve the measured sub-frame intervals; the tested
composition export does not pass independent decoding. The follow-up running-player probe
observes explicit no-display references across both leading and internal empty
edits; a raw decoder's duplicate frame is not a presentation rule. AVPlayerLayer
background appearance and the production empty-edit render policy remain undecided.
The next pass must choose that contract explicitly before implementing gap output. Existing still-image inspection
continues to reject gap-only/no-PTS kept intervals and needs no change on this evidence.

The reproducible optional fixture is `node helpers/mac/Tests/render-membership.mjs`.
It is a standalone SDK probe, not `lab:render-timing` or the product render worker.
The full command and all gates below remain required. The next implementation must
stream decoded frames; the probe's explicitly bounded sixteen-frame fixture buffer
must not become the movie architecture. Parent 13 remains entirely open.

## One question and contract

Can AVFoundation turn the core's exact retained intervals into playable video
without moving a cut, omitting a retained interval, or presenting removed content?
Prove timing ownership first with generated video that genuinely has no audio or
cursor. This is an internal execution checkpoint, not a completed preview/export.

Core `renderPlan(revision)` in `packages/core/src/timeline.ts` owns edit projection.
A native renderer accepts `{source, plan: [{source, playback}], output}` through the
existing worker. Paths are absolute; the plan is pinned before execution. Native
validates ordered source spans, contiguous playback from zero and equal durations;
it does not consult revision state, interpret edits or invent new boundaries.
It writes H.264 MP4 for these video-only fixtures. Its receipt states actual
duration, dimensions, codec/container, frame count and bytes. Keep test sample-to-playback receipts bounded to the selected join windows.

Use sequential AVFoundation execution with bounded decoded buffers. Reuse the
existing media-time/segment mapping and image orientation owners. Repeated PNG
requests would seek and encode every movie frame separately; do not make that the
movie renderer. Apple documents [timestamped writer buffers](https://developer.apple.com/documentation/avfoundation/avassetwriterinputpixelbufferadaptor);
that API capability does not prove the cut semantics below. No second process owner or edit store, compatibility layer, public
preview route, or speculative long-lived native session belongs in this pass.

## Resolve the sub-frame ambiguity before accepting a renderer

A frame presented at source 0 ms may remain displayed until 33 ms. A retained span
[10 ms, 20 ms) has no frame presentation timestamp (PTS) inside it, but intersects
that frame's display interval. The current still-image selector only admits PTS
inside its kept interval and can report unavailable here. Neither copying that
rule blindly nor assuming the movie can use the earlier frame proves correctness.

Build this counterexample first. Record actual sample PTS, measured display end,
asset/edit-list mapping and the retained intersection. Compare native decoded
output with the source as displayed during the kept interval. The acceptance
question is which source content remains visible for the retained time, not simply
whether the renderer returned a file or its duration adds up.

Before declaring no deleted-frame leakage, document the chosen movie membership
rule and why the measured fixture supports it, including its relationship to the
stricter still-image lookup rule. Do not infer held duration from the next sample
when sample timing cannot establish it. Unknown support stays an explicit failure.
Never snap the cut, drop the short span, add unreported filler or change an existing
still-image contract to make the fixture pass. If none of the measured approaches
preserves the contract, retain the red evidence and reslice this seam; a feasibility
finding does not complete playable media. Cut/membership semantics are not delegated
as an invisible implementation choice.

## Runnable proof and review surface

Create `bun run lab:render-timing` in test-harness, forwarded at root, with an
explicit optional native fixture entrypoint. It must exercise real TypeScript
`renderPlan` output through the actual native worker; FFmpeg may generate/decode
fixtures as an independent test oracle, not become the product renderer.

- Use asymmetric, independently readable frame IDs. Cover dense video with
  reordered frames/edit-list offsets, sparse held frames and a true sample gap.
- Execute a trim, two middle cuts, non-frame-aligned boundaries, the sub-frame
  counterexample, a pause-boundary cut, and original/undo plans. Pause wall time
  must not enter playback. Include spans whose fractional durations would expose
  cumulative rounding if each span were rounded separately.
- Independently decode output around each join and verify source frame identities,
  ordering, actual timestamps and duration against the fixed plan. No omitted kept
  time, source mutation or unexplained black/future/removed image is acceptable.
  State measured encoder/timebase tolerance rather than silently changing cuts.
- Submit one plan, then change the current revision; output still follows the
  submitted plan. Verify cancellation reaps the owned worker and publishes no
  partial output. Keep invalid-plan/output-alias rejection explicit.
- Retain the machine-readable timing ledger, source hashes and short playable
  fixture. Compare full asymmetric frames immediately before/after joins against
  the source targets using [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md).
  Judge temporal membership/orientation only; pointer style and audio are later.
  Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md)
  last before accepting visual evidence. Follow the non-blocking review and shot
  cleanup procedure in [verification](../verification.md#visual-gates).

## Follow-on boundaries and freedoms

Encoder settings, AVFoundation execution internals and fixture implementation are
delegated subject to readable frames, bounded memory and the measured timing gate.
Keep timeline, native frame/sample-selection and worker-lifetime checks green.

Parent 13 still owns full streaming audio, shared in-span ramps/mix, current-pointer
rendering without trails, the heavy-queue preview job, CLI/MCP delivery and pinned
app playback. Existing `AudioExcerpts` buffers its complete output and caps it at
30 seconds; raising that cap is not a movie-audio implementation. Reuse its audio
policy through a bounded owner in the follow-on. The worker's current 30-second
deadline also requires a deliberate bounded render-job policy before long exports.
Generated timing success does not satisfy adjacent-speech audition, physical audio
capture, five-minute A/V drift or the installed read/edit/preview/export journey.
