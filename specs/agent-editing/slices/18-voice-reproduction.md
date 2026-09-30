# 18 — Reproduce local reference speech

Status: complete for the fixed word/phrase reproduction matrix. Frozen offline runtime/performance, lexical correctness, calibrated splice visuals and the [current user listening verdict](../assets/listening-review-2026-09-30.md) supply its acceptance. Preserve the accepted word context and [shorter phrase](../assets/18-voice-phrase-lead/README.md), including its sample-exact accepted ending; speaker-only mode remains rejected. Managed reference-origin retention is verified through [19e](19e-retained-audio-excerpts.md) and [19f](19f-public-voice-jobs.md). The rejected source pause leaves speech-free ambience and loop acceptance open under [19](19-voice-assets.md); approval of these exact contexts does not approve other source regions or recipes. Dependencies: [00](./00-corpus.md).

## Contract

Prove a fully local reference-conditioned speech generator can produce usable requested words and contextual replacements on this Mac.

## Seam and ownership

Feature-owned reproduction runner using pinned MLX Audio/Qwen3-TTS reference cloning first. Reference input is actual selected audio plus text, not a saved voice enrollment. A second documented local candidate or optional fine-tuning is a bounded failure branch.

## Work and review surface

Use same-take, external-file and past-project reference origins. Create a fixed matrix of word/phrase corrections, save raw generation and spliced-context artifacts, and record text, identity, prosody, duration, cold/warm latency and peak memory separately. After explicit preparation, execute offline. Model downloads belong to the experiment, not ordinary editing calls.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/voice-reproduction.mjs --case reference-origins
```

## Acceptance

Every fixed requested phrase is intelligible and correct under independent checking; assess identity/delivery/splice audibly, not only with ASR/embedding scores. Target warm generation RTF ≤2 and worker peak ≤12 GiB on the observed host; publish actual measurements. Freeze model weights/revision, runtime/code/config, selected reference samples and generation outputs.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **splice timing evidence**, using boundary waveform/spectrogram windows; voice identity and naturalness require the separate listening gate. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

If reference cloning fails, reproduce another local candidate or fine-tuning without imposing mandatory enrollment. If quality still fails, keep local regeneration incomplete while unrelated work continues. External audio import is useful but does not satisfy this gate.

Delegated: Candidate runner internals and justified model/runtime selection. No remote synthesis, automatic reference choice, cover policy or lip-sync model.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.



Independent [local recognizer evidence](../assets/18-voice-lexical/README.md)
now matches both generated requested texts and the supplied reference transcript.
This evidence closes only the ASR lexical cross-check; the later linked user
review owns the exact current candidates’ listening disposition. Missing required outputs fail the probe.

The historical [acceptance handoff audit](../assets/18-voice-handoff/audit.md) retains earlier dispositions. Its pending entrance/word judgments are superseded by the linked user review; no regeneration is needed.

The [fixed matrix](../../../packages/test-harness/editing/voice/cases.json) contains
one word and one phrase across three reference-origin paths. The original runs
used copies of the same reference, producing identical bytes for each text;
the later managed origin gates establish retention rather than new speakers.
Earlier audible identity feedback and the accepted contextual corrections supply
the scoped delivery/splice assessment. [Phrase](../assets/18-voice-boundary-timing/README.md)
and [word](../assets/18-word-boundary-timing/README.md) boundary figures retain
the independent visual verdicts. This is the fixed candidate's acceptance, not a
general voice-quality guarantee or closure of19's ambience workflow.

[Clean-process repeatability](18a-voice-repeatability.md) now matches all frozen main-candidate WAV/PCM in two fresh offline processes with unchanged identities. It does not establish cold-cache behavior, independent reference origins or quality acceptance. The private [entry checkpoint](19a-voice-entry-parity.md) preserves those bytes before durable integration.
