# Agent-first media evidence

Status: implementation landed on `main`; review and release closeout remain.
This spec adds three reusable evidence primitives while preserving Yap's
boundary: Yap measures and publishes evidence; the caller decides whether to
crop, smooth, retime, switch cameras, or label.

## Next Agent Prompt

The implementation passes are complete. Run the whole-spec review, consolidate
the choices ledger, archive this rationale, merge to `main`, and release.

Global TODO:

- [x] 01 — publish observed face trajectories without prediction or smoothing.
- [x] 02 — publish temporal correspondence candidates and explicit refusal receipts.
- [x] 03 — admit long-form speaker continuity only through frozen quality gates.
- [x] 04 — integrate protocol/service/CLI/MCP parity, focused replay, review, and release.

## Product contract

Yap never turns detection into permission. Every output distinguishes observed
evidence from prediction, candidates from accepted mappings, transport from
quality, and anonymous slots from caller-authored names. Original media remains
untouched and edits remain explicit revisions.

The public surfaces use one operation handler per capability. Expensive work is
`prepare`; immutable results are `get`; retry uses the existing job identity
rules. Existing durable reads are package-readable without rerunning inference;
the new admission receipts retain their service-local lifetime until a durable
resource owner is added.
There are no compatibility shims or data migrations for this unshipped contract.

The first shipped seams deliberately stop at evidence admission where the
repository has no production owner yet: correspondence accepts a caller's
complete measured candidates, and continuity retains a service-local measured
receipt while the existing speaker provider remains bounded to thirty seconds.
Neither path invents a clock, stitches anonymous slots, or claims package
durability it cannot prove. A future native estimator or promoted provider can
write these receipts through the same contracts.

## Slice graph

1. Face trajectories: extend the existing `trackFaceObservations` owner with a
   generation-pinned, replayable trajectory read. Rows retain observed boxes,
   gaps, resets, ambiguity, and optional predicted boxes only when a caller asks
   for a prediction method. No smoothing is implicit.
2. Temporal correspondence: add `correspondence.prepare/get` over source/source,
   source/edited-reference, and source/project-tap selectors. Return candidate
   mappings, residuals, coverage, drift, competing offsets, and explicit global
   refusal. Never auto-declare an angle or retime a project.
3. Speaker continuity: preserve the existing 30-second bounded `speaker` API,
   add a continuity generation that can only be promoted after short controls,
   transport, three-speaker, and four-speaker overlap gates pass. Keep labels in
   `speaker.bind`; never infer names or cross-call identity without evidence.
4. Integration and release: package/export/replay all three evidence kinds,
   run the complete harness once, whole-spec review, archive the rationale, merge
   to main, and release.

## Verification gates

- Face: exact source/index generation identity, observed-vs-predicted status,
  500 ms association horizon, explicit no-face/error/domain resets, and no
  synthesized samples across gaps. Existing 27-frame full-face failure remains
  refused.
- Correspondence: accepted constant offsets require complete source identity,
  unambiguous anchors, bounded residual/spread, and a source-bound receipt.
  Inconsistent windows, drift, silence, repeated phrases, and unlike-mic real
  evidence remain candidates/refusals; no global clock is promoted.
- Speaker: DER ≤20%, identity confusion ≤5%, overlap recall ≥80% where overlap
  exists, correct speaker count, inference ≤2× audio, and RSS ≤4 GiB. Existing
  four-speaker evidence (57.49% overlap recall) remains refused.
- All mutation tests must reject changed source hashes, clocks, model/provider
  identities, metrics, status, or continuation context before expensive work.

## Decisions and alternatives

- Face output contains both raw observations and derived predictions because an
  agent should not rebuild tracking, but must know which coordinates are inferred.
  Smoothing is not a Yap default; it is a caller/composition decision.
- Correspondence is one general evidence operation rather than a synchronization
  feature. `angle.declare` may consume only an accepted caller-authored receipt.
- Speaker continuity is a quality-gated evidence envelope, not a promise that a
  model can label arbitrary podcasts. `speaker.bind` remains the only naming path.
- The moving transition pixel discrepancy is not in this spec: it is not a
  human-visible product issue under the current evidence.

## Choices ledger

See `choices.md`. The implementing agent must append decisions made where this
plan is silent and consolidate the ledger before close-spec.
