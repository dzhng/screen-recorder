# 11 — Audio, waveforms and spectrograms

Status: bounded waveform reduction and shared WAV validation implemented in core; cached acoustic jobs, public delivery, images, spectrograms and agent/visual acceptance remain. Actual PCM/WAV delivery is owned by [11a](./11a-audio-delivery.md). Transcript/events from [10](./10-project-evidence.md) are optional contextual evidence, not a dependency of PCM-only acoustic analysis.

## Contract

An agent can inspect actual audio, exported tracks and time-labeled acoustic evidence at useful resolutions without materializing the full project.

## Seam and ownership

The shared PCM/WAV owner from 11a feeds waveform buckets/images and bounded spectrogram images. There is no legacy production acoustic artifact owner to adapt: reuse the existing job queue, derived cache and media delivery owners. Source reads use asset/stream IDs; project reads reuse the exact audio compiler/mixer. Acoustic reducers consume a retained validated PCM file, never decode sources or invent a project.

The [core waveform reducer](../../../packages/core/src/audio-wave.ts) owns sample-domain reduction and shares WAV validation with audio publication. Its absolute bucket grid is independent of the selected range and byte header. Edge buckets explicitly report their clipped sample support; channels remain separate. Bucket count is bounded before reading sample data, and sample blocks yield for cancellation while the caller retains the cache lease.

## Remaining implementation passes

1. Integrate the reducer with cached acoustic jobs pinned to the exact source/project audio generation and processing tap. Acquire and release the existing cache lease across the entire reduction; propagate missing/expired/deleted dependencies through existing readiness/retry semantics. Choose a simple public resolution representation without exposing file headers or cache paths.
2. Deliver bounded waveform JSON and timestamped images through existing media delivery. Verify absolute axes, partial edge bins, range/full agreement, cache/restart/cancellation and useful agent navigation through actual CLI/MCP.
3. Add bounded windowed spectral reduction and labeled time/frequency images through the same acoustic artifact lifecycle. Judge impulse/tone alignment, then complete the unprimed image and fresh-agent acceptance below. Energy suggestions remain optional heuristics.

The [first core pass evidence](../assets/11-waveform-core/README.md) verifies an independent mechanism, not public waveform acceptance. The larger retained-file test uses a sparse WAV to prove positioned I/O; actual native project-tap WAVs separately prove reducer integration. No listening claim follows from either.

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

