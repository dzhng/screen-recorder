# 18 — Reproduce local reference speech

Status: offline candidate reproduced; observed warm RTF/memory targets and independent ASR word agreement met. User finds voice close but joins wrong: louder speech, excessive margins and more echo. [Tighter joins](../assets/18-voice-joins/README.md) and an [alternative local conditioning mode](../assets/18-voice-speaker-only/README.md) pass lexical checks but await listening; join acceptance, visual review and managed origin retention remain open. [Frozen evidence](../assets/18-voice/README.md). Dependencies: [00](./00-corpus.md).

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
This closes only the ASR lexical cross-check; pronunciation, identity, delivery,
protected joins and listening remain open. Missing required outputs fail the probe.
