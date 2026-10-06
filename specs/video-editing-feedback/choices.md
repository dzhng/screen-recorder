# Implementation choices

User decisions remain binding; this ledger records implementation discretion outside the approved plan.

## Preparation boundary — sound, high confidence

The user clarified that pinned models for first-class Yap features, specifically Parakeet, should download/prepare as needed by default. The recommendation-only policy applies to capabilities outside Yap. Preparation remains an explicit operation through the existing model owner; ordinary inference stays offline. This supersedes the broader wording in the original plan.

## Exact-removal verification boundary — sound, high confidence

The pass exercises persisted project transactions, restart, replay and undo with independent probe controls. This proves exact authoring and storage without claiming decoded-media quality; slice34 owns the final real-media gate. No downstream clock rule changed.

## Capability examples and provenance controls — sound, high confidence

Runnable examples consume IDs from saved public revision replies and retain continuation pins. Controlled old-installed and current-source skill folders remain distinct, so freshness is proved instead of inferred. The portable checkpoint uses available Node24.21; bundled runtime/native readiness remains explicitly unverified until the final installed-runtime gate.

## Native-decoder audio fixture recipe — sound, high confidence

Retain source-rate Float32 rather than compress or resample the first audio excerpts. Derive through the existing native source-audio owner and compare re-decoded retained samples against the original decoder operand. This keeps codec admission, physical sample counting and clock arithmetic with their existing owners. The 28MB inputs leave ample corpus budget. Numerical equality does not establish ASR equivalence or prove that an old failure survives; those verdicts remain separately pending.

## Publication generation identity — sound, high confidence

When an earlier transcript or index remains readable while a replacement runs,
the reply identifies both the work now running and the retained output. The
retained publication uses its owner's actual generation, which may be a number
or a nonempty index-attempt string; it never invents a numeric generation.
Slice03 left that representation unspecified. Keeping actual identities lets
future waiting and cache consumers tell replacement work from readable old
output without a second mapping table. This choice landed in `5d56d2f4`.

## Historical operand boundary — sound, high confidence

A saved receipt predating the public cutover still has its original fields.
Historical comparison tools read that one frozen shape; current callers read
the new public envelope. Converting archived receipts would destroy the original
comparison operand, while accepting both in production would violate the hard
cutover. Slice03 required archive preservation without prescribing fixture
construction. Fixture-local extraction preserves both obligations and does not
introduce a production compatibility reader. This choice landed in `5d56d2f4`.

## Speech timing choices — landed in `6b948f83`

Review first: refusing a result whose delayed punctuation exceeds selected physical support is conservative and can reject otherwise legible words. The parent approved this boundary; a wider explicit selection is a future caller remedy, not silent repair.

### Sound, medium confidence

#### Refuse invalid raw operands as a complete result

- When: slice07 implementation pass.
- Choice: if an engine token contains a nonfinite, reversed or out-of-selected-support estimate, the operation fails nonretryably instead of editing the estimate or publishing only the remaining words. For example, a sentence can have speech-bearing tokens inside the selected audio but delayed punctuation outside it. This still refuses; punctuation is an estimate, not a claim about the last audible sound.
- Gap: the plan allows diagnostics/refusals but did not choose partial publication versus refusal. The current native wire has one bounded code/message/retryable failure and no per-word diagnostic publication contract.
- Reach: callers may explicitly request wider source context; they cannot receive secretly clamped or silently dropped words. Public failures preserve offending indexes, timing/confidence and support context. Invalid fixture inputs retain complete operands in the evidence; no full live engine-result failure artifact is published by this slice. Successful raw results remain intact.
- Verdict: sound conservative boundary, approved by the parent. It avoids inventing another publication contract. Real tiny/25-second cases pass, but do not establish that every end-of-selection punctuation estimate fits.
- Confidence: medium that this is the user's preferred conservative tradeoff; high that it implements the approved plan.

#### Isolate raw-observation replay from media acquisition

- When: slice07 retained checkpoint.
- Choice: the case-selected replay reads hash-pinned native JSON, indexes it in owned scratch and verifies every word through one-row pagination. It deliberately does not import fake media metadata or re-run the model; the native runs and fixture provenance separately establish source/input identity.
- Gap: the plan requires a runnable checkpoint but leaves its construction open. Full repeated imports and inference would test different owners and cost much more than the indexing question needs.
- Reach: this checkpoint proves raw admission and traversal, not authenticated source ownership, model loading, accuracy, or the complete public CLI journey. Existing core owner tests exercise real asset admission separately.
- Verdict: sound, because the report names its scope and keeps the independent native/source evidence alongside it.
- Confidence: medium.

## Picture certification scope — sound, medium confidence

When reducing a camera excerpt, keep the complete raster and the original warm
lighting, backlit highlights and framing. This pass retains ProRes SQ video-only
inputs rather than shrinking or grading them. The reduction recipe is delegated
by slice01; the extra choice is to keep decoded-frame support and sampled visual
fidelity as separate acceptance records. Every decoded frame's dimensions, color
metadata and timestamp are checked, while four matched source/derivative frame
pairs per camera establish the narrower visual claim. A fresh critic also checks
complete contact sheets and face crops. This does not assert that every intermediate
frame was visually inspected, and later picture primitives still need their own
behavioral gates. The alternative would hide source defects or imply exhaustive
visual proof from a hash. Future fixtures must state their own preservation scope.

## New video derivation requires independent admission — sound, high confidence

A caller can regenerate a selected clip with the frozen, hash-pinned encoder
recipe. The tool checks physical raster and frame timing, but writes its visual
preservation status as unverified. It refuses corpus certification until a separate
source comparison is recorded. Slice01 did not specify whether regeneration alone
should declare quality passed. Keeping that boundary prevents a newly generated
file from certifying its own appearance; matched bytes on a selected regeneration
are retained as additional evidence, without a second quality judge in product code.

## Speaker research resource boundary — sound, medium confidence

- When: retained slice31 research and maintenance checkpoint.
- Choice: report the inference process's peak resident memory as the measured
  resource bound. When a CoreML trial finishes, this reports memory attributed to
  that process; system model caches and separate accelerator services can hold
  additional memory. It does not claim a bound for the entire Mac.
- Gap: the planned memory gate did not identify which operating-system accounting
  boundary to use. The trial measurements supply process RSS (resident memory),
  while whole-system memory would require a separate controlled comparison.
- Reach: these trials can establish their stated process cost, but a future packaged
  provider must name its resource boundary and cannot inherit a total-memory claim.
- Verdict: sound as a scoped research measurement. No failed provider or broader
  memory claim is promoted. A distribution needing a total-machine bound requires
  its own measurement before that claim becomes public.
- Confidence: medium.

## Recovered runtime has a new identity — sound, high confidence

- When: retained original speaker replication.
- Choice: reconstruct missing dependencies through the existing preparation owner
  and give that complete artifact a new hash. For example, a rebuilt dependency
  library can preserve the speaker calculation while changing runtime bytes; exact
  matched calculations prove that scoped behavior, not identical installation.
- Gap: the historical runtime was gone, and the plan required preserving its
  computation without specifying how to identify a rebuilt dependency closure.
- Reach: future packaging must pin the actual complete prepared artifact. The
  private trial does not change the default registered runtime or reuse its old
  digest; Nemotron source layers likewise remain separate from their base runtime.
- Verdict: sound. Hashes describe actual bytes, and matched original outputs remain
  a separate preservation record rather than a substitute runtime identity.
- Confidence: high.
