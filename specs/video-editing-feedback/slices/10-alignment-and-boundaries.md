# 10 — Publish alignment and acoustic boundary evidence

Status: checkpoint A, B1 and the selected project-tap portion of B2 are implemented and reviewed. Source and prepared project-tap observations share the retained alignment evidence owner; project jobs pin the prepared tap, revision and generated PCM asset through restart and retry. Public source acoustic evidence passes; portable project-tap delivery and the final slice verdict remain open. Depends on: [09](09-alignment-replication.md), [08](08-bounded-speech-preparation.md).

## Contract

Known supplied text can be aligned to selected PCM with unmatched tokens and measured edge context retained.

## Seam and ownership

Core alignment evidence using existing jobs/models/publication/pagination; service/native adapter for the accepted recipe. Acoustic observations share selected PCM.

Current owners and starting checks:

- [packages/core/src/models.ts](../../../packages/core/src/models.ts)
- [packages/core/src/audio-inspection.ts](../../../packages/core/src/audio-inspection.ts)
- [packages/core/src/word-kind.ts](../../../packages/core/src/word-kind.ts)
- [packages/core/src/transcript.ts](../../../packages/core/src/transcript.ts)
- [packages/test-harness/speech/feasibility/source-clock.test.mjs](../../../packages/test-harness/speech/feasibility/source-clock.test.mjs)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

### Checkpoint A — prepared provider and shared arithmetic

Port the exact accepted NeMo auxiliary CTC flow and Torchaudio forced alignment,
preserving literal tokenizer inputs and complete native operands. Reuse the Models
preparation owner for pinned checkpoint/runtime inputs; inference is offline and
never acquires another model. Preserve request/output parity against09 before new
inference. Generalize native selected-channel PCM decoding so each model owns its
window policy, without creating another decoder. One ordered all-optimal
correspondence owner serves08 reconciliation and10 provider correspondence;
their physical support, point and ownership policies remain separate.

Fresh preparation reconstructs the optional runtime from hash-pinned public
interpreter/package inputs through the existing Models acquisition owner and
service descendant lifetime. It requires no developer-installed runtime or
developer tools. The complete measured output inventory precedes readiness;
offline inference cannot trigger acquisition. Runtime identity is distinct from
the original accepted donor closure. The
[checkpoint evidence](../assets/10-word-attribution/README.md) records acquisition
scope, complete reference parity and interpretation limits;
[scoped choices](../assets/10-word-attribution/choices.md) retain architecture calls.

Checkpoint A focused gates pass: Models preparation/adoption, optional runtime
helpers, prepared-model cache ownership, affected core/service types, native
channel extraction, correspondence and speech seam parity. Full provider-response
parity covers retained candidates before actual inference; the prepared public
closure reproduces every bounded reference matrix. Repeated inference also
preserves complete inventory readiness. Public attribution is still pending B.

### Checkpoint B — durable evidence and public lifecycle

B1 has passed independent review and focused consumer corrections. It exposes
explicit source preparation and retained-generation reads, including
words, acoustic cells, native scores and original raw chunks. Thresholded reads
never invoke a provider. Unpublished refusal operands are inspectable as captured
and unverified; ready rows require queue settlement. Complete23-case correspondence
and conditional-bound parity passes against09 through the shared native arithmetic
and actual core publication/read owners. Source restart, cancellation/retry and
missing-runtime checks pass. B2 still owns project selected-tap observations,
source projection and portable preservation through this same evidence store.

B2's source-portability pass reuses the package registry, resource closure,
archive budgets and adopter. Complete ready generations retain original raw bytes,
native bounds, correspondence and publication order. The same parser admits
immutable package reads and catalog adoption; publication rechecks the live source
inside the existing transaction. Actual public export/open/adopt/replay/restart
passes with receiver media/model execution forbidden, and package continuation
refuses a managed-library cursor. Captured unpublished failures remain local
diagnostics. Project alignment now runs as a project-owned job after the caller
pins an already-prepared tap. Its worker selects the generated tap asset through
the existing source PCM owner, while retained evidence remains keyed to that
asset for package and source reads. Project reads return direct project-clock
ranges for tap rows with a null source occurrence; source rows continue through
exact revision projection. Rendered-tap timing and source timing stay separate
without inventing a clip identity.

Explicit preparation publishes immutable conditional paths and correspondence,
with literal source/text/channel/range/provider/PCM pins. Retained reads and pinned
source/project projection require neither inference nor runtime bytes. Wrong,
repeated, missing and partial text remain unmatched or unknown as observed;
out-of-physical-support native cells refuse rather than shortening an estimate.
Retain bounded acoustic cells and measured noise context. Acoustic activity/quiet
requires a caller-supplied threshold, and never supplies a lexical identity.
Both checkpoints are required before this slice is complete.

Explicit alignment preparation pins literal text, source/tap/range, PCM identity and provider. Read rows retain token/word index, estimated bounds, matched/unmatched status and provider score interpretation. Report nearby quiet/activity intervals with resolution and measured noise context; no waveform-only lexical label. Preserve partial/disfluent fragments only when observed; otherwise expose unexplained speech/ASR mismatch as unknown, not invented words.

## Runnable checkpoint

Production-entry-point parity against frozen alignment reference, including trend versus turn and fortun- support.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Before expensive inference, compare complete native requests and parsed outputs with accepted spike. Gaps, wrong text, unknown fragments, repeated words, unmatched dictionary tokens and source/project mapping remain explicit. Known text is not an independent timing oracle.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Small module names/storage structure and bounded evidence representation; lexical detector capabilities require separate successful proof before claiming them.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

One retained evidence owner, no independent transcript vocabulary/clock, raw-source integrity and exact revision projection remain green.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
