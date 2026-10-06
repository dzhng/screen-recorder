# 31 — Prove speaker continuity and word attribution

Status: partial; asymmetric hysteresis passes short quality, but required ten-minute four-speaker overlap remains red. Research depends on selected certified [01](01-certified-corpus.md) inputs; word-attribution integration additionally requires [08](08-bounded-speech-preparation.md).

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

Use existing prepared inputs when available; prepare/download pinned models and
runtime for this first-class Yap feature as needed by default. The recommendation-only
policy applies to capabilities outside Yap. Freeze one passing local recipe before 32; failed feasibility causes
reslicing, not a “ready” output made from unrelated local slot IDs.

## Current verdict and smaller remaining passes

[Retained replayable evidence](../assets/31-speaker-replication/README.md) preserves
exact original short-window parity, passing three-speaker continuity controls and
failed long-form four-speaker overlap. The [fixed asymmetric interpretation](../assets/31-speaker-replication/hysteresis-evidence/README.md)
passes both required short cases and longer three-speaker returns, then fails the
ten-minute four-speaker control. Its complete raw operands replay without new
inference. No provider is promoted.
The historical DER-only pass never established simultaneous-speaker recall.

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
   control. Next inspect the pinned model's supported streaming/cache and
   full-input preprocessing contracts; freeze one independently justified bounded
   native configuration before another run. If no supported path exists, use a
   distinct local overlap-capable provider. Do not tune thresholds on the failed
   assembly or repeat unchanged long inference.
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
explicit optional preparation, pagination/replay and source-media integrity remain
green. No second timeline, hidden provider fallback or acquisition during ordinary inference.
Update the README prompt, traceability and spike verdict before ending the pass.

## Direction that would change this slice

Cross-session voice identification or support beyond the proven speaker envelope
requires a new explicit contract. No person becomes a QA prerequisite.
