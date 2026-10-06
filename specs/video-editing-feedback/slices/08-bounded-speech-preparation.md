# 08 — Prepare transcripts for bounded source ranges

Status: implemented in delegated worktree; scoped recipe/contract gates pass. Root integration owns the remaining historical harness caller cutover. Depends on: [07](07-speech-timing-admission.md), [03](03-published-work-contract.md).

## Contract

Inference scope is explicit, bounded and source-clock preserving; it is distinct from filtering a transcript read.

## Seam and ownership

TranscriptProcessing/TranscriptStore/model owner, selected PCM and native SourceTranscript. Protocol preparation/read seam.

Current owners and starting checks:

- [packages/core/src/transcript-processing.ts](../../../packages/core/src/transcript-processing.ts)
- [packages/core/src/transcript-read.ts](../../../packages/core/src/transcript-read.ts)
- [helpers/mac/Sources/YapSpeech/SourceTranscript.swift](../../../helpers/mac/Sources/YapSpeech/SourceTranscript.swift)
- [packages/core/src/transcript-ownership.test.ts](../../../packages/core/src/transcript-ownership.test.ts)
- [packages/test-harness/editing/selected-source-transcription.mjs](../../../packages/test-harness/editing/selected-source-transcription.mjs)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Introduce explicit transcript.prepare execution selection and make transcript.get a retained evidence read. Execution range, context, stream/acquisition, model and decoder participate in generation identity. Omitted execution range means full admitted support processed in bounded windows; unavailable support remains gaps. Retain context ownership and merge diagnostics, avoid duplicate words, and never silently fill gaps. Remove implicit model/inference preparation from reads in one cutover across callers/skill.

The preparation selector names `executionRange` and explicit outer `context`, independently of a read's `range` filter. Outer context expands decode work without expanding primary ownership. All context observations remain raw evidence with explicit ownership diagnostics. An observation intersecting an outer selection edge retains its complete original estimate; reads expose selection intersection/partiality rather than shortening its timestamps. Internal seam matching is separate from that outer selection rule. Source reads can select a retained `generation`; bounded results require that pin. Omitted generation resolves only the full-support preparation identity, never whichever bounded take happened to finish most recently. Project reads select source generations explicitly when consuming bounded evidence and otherwise resolve full-support generations. Reads and search cannot enqueue speech inference.

Keep the original whole-source descriptor and admitted support. Available source time without primary transcript ownership is `not_observed`, including decode-only context; this differs from physically/acquisition-unavailable `not_acquired` and decoded segments refused as `too_short`. The actual bounded recipe, decoder and model identity remain retained preparation inputs, including for portable adoption. Actual decode extent bounds admission, never the artificial owned-window extent. Context observations and ownership diagnostics must survive; a merge cannot silently discard boundary estimates or invent timing repairs.

Slices 03 and 07 are integrated. Whole slice 01 certification remains incomplete, but the private tiny PCM and paired 25-second fixture/original observations already establish exact selected-source timing and sample identity for this scoped speech work. Reuse their valid baseline results; this dependency allowance does not mark slice 01 complete or establish unrelated media admission.

## Frozen recipe and retained reads

The accepted recipe uses20s primary windows,4s internal context and1s guarded
seams. Exact shared decoded support restricts comparison. A guarded observation
must have one mandatory ordered correspondence in every optimal lexical alignment;
missing or ambiguous peers refuse. Exact points require identical estimates.
Each accepted pair selects one original observation, never repaired text or time.
Outer context is caller-selected and does not expand primary ownership.

Native receipts require the exact execution echo, actual readable support and
window ownership; every raw line requires that same ownership. Reference-only
admission derives a modern artifact with frozen-source hash and explicit adapter
provenance, retaining the historical native authority unchanged.
Catalog28 and portable package5 refuse prior formats rather
than reconstruct these inputs. Decoded support can overlap; owned support is
ordered and disjoint. Connected transcribed ownership preserves phrase continuity,
while skipped/unobserved/unavailable gaps split it. Native window ordinals remain
separate private provenance for portable per-window counts.
Cursor-only project continuations restore their manifest's source-generation pins;
an explicit change to those pins still refuses as changed query identity.

The [retained evidence](../assets/08-bounded-speech/README.md) binds paired25s
observations, the shifted60s seam, the100s bounded-work result and new outer-context
native inference. It retains failed trials and recognition differences; recipe
acceptance does not claim independent ASR accuracy or whole-source token parity.
Whole slice01 certification remains open under the existing scoped allowance.

## Runnable checkpoint

The existing timing replay accepts a case inventory and traverses retained current
native output through admission and one-row source pagination. Native speech tests
replay case-selected shared-context observations without inference. Their help owns
usage; the evidence README links both.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

Range inference does not scale decoded memory to full asset length; cancellation, resumed reads, context overlaps, missing support, repeat requests and package retention have explicit behavior. Chunk size/merge recipe is frozen against real cases before production promotion.

No visual verdict is required for a JSON-only checkpoint. If this slice produces a visual artifact, declare its variable/mask, compare it using compare-screenshots and obtain an unprimed screenshot-critique as the last visual check before acceptance. Artifact viewing never requires human QA.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Window size and overlap after measured replication; record these as execution recipe, not hidden defaults. The fixed registered Parakeet provider is acceptable. Explicit preparation may acquire its first-class pinned inputs when needed; retained reads and ordinary inference never download or acquire dependencies.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Source origin, generation pins, exact occurrence projection and read-only pagination remain correct.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.
