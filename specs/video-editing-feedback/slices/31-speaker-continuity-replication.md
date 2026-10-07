# 31 — Prove speaker continuity and word attribution

Status: partial; asymmetric hysteresis passes short quality, and the pinned native call has a replayed stateful three-speaker 600-second envelope, but required ten-minute four-speaker overlap remains red. Research depends on selected certified [01](01-certified-corpus.md) inputs; word-attribution integration additionally requires [08](08-bounded-speech-preparation.md).

## Contract

An agent can determine who spoke each passage of a mixed interview, with stable
anonymous IDs across bounded processing windows and explicit overlap/unknowns.
This spike must prove the execution and attribution recipe before public labeling.

## Seam and ownership

Extend the existing speaker evidence/processing owner and optional model runtime.
Do not build another diarization service, transcript database or installer.

Read the current [speaker worker](../../../helpers/speaker/README.md),
[source selection](../../../packages/core/src/source-speakers.ts),
[processing](../../../packages/core/src/speaker-processing.ts),
[evidence](../../../packages/core/src/speaker-evidence.ts), and
[project projection](../../../packages/core/src/project-speakers.ts).
The [original quality proof](../../done/ffmpeg-parity/evidence/speaker-original/README.md)
and [runtime proof](../../done/ffmpeg-parity/evidence/speaker-runtime/README.md)
establish short-window behavior only. Their training overlap and recipe limitations
survive this plan; they are not long-form or known-person proof.

## Scope and frozen decisions

First preserve matched 30-second raw scores/segments against the frozen original
recipe. Investigate its actual streaming state/chunk support before treating separate
calls as a continuous session. Compare a stateful or measured window-association
recipe against known speaker changes across boundaries, repeated re-entry, silence,
similar voices and simultaneous speech. An invocation-local slot number is never a
cross-window identity. Require real raw/mixed project excerpts plus independently
constructed known-speaker assembly controls; transcript text alone is not speaker truth.

Resolve selected PCM/channel/support, model/runtime/hash, allowed speaker count,
window/context/state reset, continuity association and unknown/refusal rules.
Declare work/memory bounds and score meaning. Measure mixed-source identity errors
separately from timing errors and lexical ASR errors. Current four-slot constraints
must stay explicit until a different supported envelope is proven.

Use existing prepared inputs when available; the registered first-party provider now
prepares/downloads its pinned model and runtime by default through the measured
acquisition descriptor. The recommendation-only policy applies to capabilities
outside Yap. Freeze one passing local recipe before 32; failed feasibility causes
reslicing, not a “ready” output made from unrelated local slot IDs.

## Current verdict and smaller remaining passes

[Retained replayable evidence](../assets/31-speaker-replication/README.md) preserves
exact original short-window parity, passing three-speaker continuity controls and
failed long-form four-speaker overlap. The [fixed asymmetric interpretation](../assets/31-speaker-replication/hysteresis-evidence/README.md)
passes both required short cases and longer three-speaker returns, then fails the
ten-minute four-speaker control. Its complete raw operands replay without new
inference. No provider is promoted.
The historical DER-only pass never established simultaneous-speaker recall.

The bounded native streaming envelope is now checked without inference by
`packages/test-harness/editing/speaker-streaming-envelope.mjs` and its focused
test. It binds one fresh Sortformer state to each selected input, preserves that
state across the runtime's internal 27.2-second chunks, and resets it between
selections. The retained three-speaker 600-second control passes, while the
required four-speaker overlap control remains below the unchanged 80% recall
gate. Public preparation therefore stays on independent 80ms-grid windows of at
most 30 seconds; this receipt does not promote long-form continuity or named
speaker inference.

The independently trained eight-slot direct-activity model has a replayable
exploratory long audit in [ultra8 evidence](../assets/31-speaker-replication/ultra8-evidence/README.md):
the 336.32-second three-speaker control passes, while the 600-second
four-speaker control fails DER `0.371`, overlap recall `0.092` and identity
confusion `0.076`. The run was not frozen before inference, so it narrows the
next hypothesis but cannot close the long-form gate or promote a provider.

The bounded [Community-1 AHC threshold probe](../assets/31-speaker-replication/fluidaudio-evidence/threshold-probe/README.md)
now reuses one prepared public embedding pass and replays the existing clustering
owner at thresholds 0.3, 0.4, 0.5 and 0.6. Fa/Fb, VBx, constrained assignment,
count hints, segmentation, embedding and post-processing remain unchanged. Every
threshold produces the same segment assignments on both calibration controls.
BSP30 still exposes two IDs for three reference speakers, and the 100-second
control still has the known endpoint beyond physical support. The AHC cut therefore
does not explain the collapse; the probe stops before held-out inference and
promotes no threshold or provider.

Keep the required gate unchanged; proceed through these separately verifiable passes:

1. **Provider and short-case admission.** Freeze licensing, complete raw-observation
   access, exact physical support and a candidate recipe before confirmation. Pass
   the existing short quality/count/overlap gates on independent controls. The
   original, low-latency, equal-threshold Nemotron and Community-1 recipes remain
   failed records. The fixed asymmetric Nemotron interpretation passes the selected
   short gate only, with its training-overlap and held-out limitations intact.
2. **Global continuity.** Only a short-quality winner proceeds to bounded long
   calls with return, silence, overlapping voices and planted identity swaps.
   Existing three-speaker successes remain valid within their stated scope.
   The asymmetric ten-minute failure banks every score and a planted identity-swap
   control. The [native cache/context comparison](../assets/31-speaker-replication/native-cache-research.json)
   establishes exact asynchronous-path parity on selected single-stream controls
   and a failed documented buffering profile. Next admit one distinct local
   overlap-capable provider/runtime. [Original PyTorch Community-1](../assets/31-speaker-replication/community1-original-evidence/README.md)
   independently merges identities and fails its first short control. The research
   data-only AHC threshold probe also fails to change the calibration collapse;
   the research record therefore continues to prioritize an independently trained
   direct-output checkpoint.
   Freeze licensing, complete raw access and physical support
   before short inference. Do not tune thresholds/count hints on failed cases or
   repeat unchanged long inference.
   The next distinct provider hypothesis is NVIDIA's
   `nvidia/Nemotron-3-Diarization` checkpoint. Its pinned artifact was acquired
   and hashed, but admission stopped before inference: the checkpoint declares
   NeMo 3.0 and targets `nemo.collections.asr.modules.TransformerEncoder`,
   while the sealed first-party runtime is NeMo 2.7.3. A source compatibility
   probe exposed that symbol only by introducing a matching NeMo tree, which
   then required a different `lhotse` API than the sealed runtime provides. The
   refusal is retained in [Nemotron-3 admission evidence](../assets/31-speaker-replication/nemotron3-admission/README.md).
   Prepare a separately hashed NeMo 3-compatible runtime before rerunning the
   unchanged short-first controls; do not alter production defaults or claim
   quality from this pre-inference refusal.
3. **Prepared execution closure.** Seal and relocate the winning model/runtime;
   offline inference must use only the prepared closure and reproduce its operands.
   The original private reconstruction and alternate byte/load readiness are
   distinct evidence; neither changes the default registered production runtime.
4. **Word attribution.** After 08 publishes owned words and coverage, freeze
   deterministic overlap/unknown attribution and public stable-ID/name binding
   contracts before 32. Camera files and transcript text are not speaker truth.

Independent alignment/picture research and contract work continue while pass 1 is
red. Do not repeat failed inference without a new independently justified hypothesis.

## Runnable checkpoint

A case-selected speaker-continuity lab over short multiwindow inputs returns
source-clock turns, stable speaker IDs, overlap/unknown intervals, complete
raw operands and an attribution comparison. Include a chronological compact
transcript view that makes a deliberately swapped-window identity visible.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before behavior
changes. Reuse existing processing/evidence/portable tests for the public lifecycle.
For the spike, compare frozen matched requests and complete outputs before costly
inference. Prove planted speaker swaps and overlapping participants do not become
confident single-speaker assignments. Exercise shorter-than-window selections,
multiple boundaries, gaps, same voice returning and unsupported participant count.

Accept a frozen recipe only with its declared supported envelope, exact reference
outputs, automatic control labels, observed error distribution and resource bound.
Select quality tolerances from the existing accepted speaker gate plus the new
controls before tuning; do not calibrate and confirm on the same cases. Long-form
identity continuity must pass independently of the historical six-window DER.

No user speaker labeling/listening is required. Ambiguous real intervals remain
unknown; energy, camera presence and native sigmoid scores are not identity oracles.
JSON/text output needs no visual verdict. If an overlay/contact sheet is produced,
compare the speaker/turn mask with [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md),
then get unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md)
as the last visual check and show it with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md).

## Delegated choices

Stateful execution versus measured association, candidate selection and internal
representation are delegated to this experiment with recorded rationale. Runtime,
thresholds, supported envelope and identity semantics freeze before production.
Automatic known-person/voiceprint identification is outside this contract.

## Must stay green

Original short-window operand preservation, raw-score retention, overlapping turns,
first-party auto-preparation, pagination/replay and source-media integrity remain
green. No second timeline, hidden provider fallback or acquisition during ordinary inference.
Update the README prompt, traceability and spike verdict before ending the pass.

## Direction that would change this slice

Cross-session voice identification or support beyond the proven speaker envelope
requires a new explicit contract. No person becomes a QA prerequisite.
