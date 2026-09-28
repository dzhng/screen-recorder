# 13 — Reproduce pitch-preserving stretch

Status: numerical reproduction implemented; quality gate NOT accepted. Dependencies: [00](./00-corpus.md).

The [frozen experiment](../assets/13-stretch/README.md) establishes pitch, exact
retained sample counts and excluded-source isolation. Native tail/endpoint
handling and speech/listening acceptance remain open; slice 14 must not adopt
the diagnostic crop. Candidate visual evidence and real-speech auditions are
tracked in [13a](./13a-stretch-endpoints.md); independent listening remains open. The bounded
context experiment rejected a universal padding/latency crop;
[13a](./13a-stretch-endpoints.md) owns endpoint treatment before integration.

## Contract

Select and freeze a local pitch-preserving stretch mechanism that meets duration and quality requirements on actual narration.

## Seam and ownership

Standalone research runner reproduces Apple's offline AVAudioEngine/AVAudioUnitTimePitch or composition-based algorithms. Compare FFmpeg atempo as a measured alternative; investigate another local engine only if needed and record distribution implications.

## Work and review surface

Run fixed 0.8×, 0.9×, 1× and 1.25× speed cases over a tone, real phrases, rushed speech, silence and speech with clicks. Include a local segment between untouched neighbors. Record output samples, latency/tail correction, pitch, runtime, memory and independent listening results.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/stretch-reproduction.mjs --case local-phrase
```

## Acceptance

Exact requested output PCM sample count after documented compensation; tone pitch error below 1%; no clipped word at joins; intelligibility and naturalness assessed on real speech. Freeze runnable code, inputs, configuration and artifacts. Do not equate sample-rate conversion with pitch preservation.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **duration and pitch evidence**, using aligned tone spectrum and boundary waveform panels; aesthetic plot styling is out of scope. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

If the native method fails, test the named alternative. If only whole-phrase stretch passes, record local-window stretch as unpassed and reslice it; the full requested capability is not complete. No silent restriction to global speed or visual-only insertion.

Delegated: Candidate implementation and licensed-runtime selection based on evidence. The measured recipe is binding on slice 14.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.
