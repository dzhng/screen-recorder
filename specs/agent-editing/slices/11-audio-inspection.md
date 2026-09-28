# 11 — Audio, waveforms and spectrograms

Status: not started. Dependencies: [08](./08-audio-mixing.md), [10](./10-project-evidence.md).

## Contract

An agent can inspect actual audio, exported tracks and time-labeled acoustic evidence at useful resolutions without materializing the full project.

## Seam and ownership

Shared evidence jobs provide WAV excerpts, full selected-stream/project-mix WAV delivery, waveform buckets/images and bounded spectrogram images. Source reads use asset/stream IDs; project reads reuse the exact audio compiler/mixer.

## Work and review surface

Provide raw-source and processed-target dry/after-step taps through the same execution plan. Compare bounded waveform/spectrogram and audio results against full output, including nested group treatment and bypass.

Expose bucket origin/duration, min/max/RMS, channel handling and returned bounds in JSON. Image axes identify time domain, units, revision/generation and range. Full-track extraction is a bounded background job. Silence/energy suggestions are explicitly heuristic, never edits. Reuse artifact delivery tokens/file output.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/audio-evidence.mjs --fixture speech-and-clicks
```

## Acceptance

Known impulses map to correct times/buckets/pixels; range and whole extraction agree at sample bounds. Test narration/mix choices, repeated and stretched project occurrences, pagination/size caps, cancellation and explicit failures. Have an agent locate a labeled interval using only delivered artifacts; record whether it can actually listen.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **acoustic time-axis alignment**, using known impulse windows and their labeled time axes; image theme and editorial cut quality are separate. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

A full-track waveform PNG that hides short phonemes is not sufficient. Add selectable resolution/windowing within the same contract; don't return enormous JSON sample arrays or let raw file paths stand in for actual media delivery.

Delegated: Bucket pyramid and spectrogram implementation after axis/energy conformance. The agent chooses references and cuts.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.

