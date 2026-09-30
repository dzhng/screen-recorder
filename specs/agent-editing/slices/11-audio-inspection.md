# 11 — Audio, waveforms and spectrograms

[Source/project rate-axis evidence](../assets/08-11-rate-conformance/README.md) covers public 44.1k source and 48k project PCM/buckets/images, with scoped fresh visual review; it does not establish listening or low-amplitude waveform readability.

Status: cached waveform JSON jobs and [actual public CLI/MCP delivery](../assets/11-waveform-public/README.md) are verified. [Public acoustic images and spectral lifecycle](../assets/11-acoustic-lifecycle/README.md) are verified; [fresh image-based skill use](../assets/11-acoustic-skill/README.md) also passes; [retimed conformance](../assets/11-retimed-acoustic/README.md) also passes with independent PCM/DFT checks and fresh visual review. Actual PCM/WAV delivery is owned by [11a](./11a-audio-delivery.md). Transcript/events from [10](./10-project-evidence.md) are optional contextual evidence, not a dependency of PCM-only acoustic analysis.

Dependencies: [11a](./11a-audio-delivery.md).

## Contract

An agent can inspect actual audio, exported tracks and time-labeled acoustic evidence at useful resolutions without materializing the full project.

## Seam and ownership

The shared PCM/WAV owner from 11a feeds waveform buckets/images and bounded spectrogram images. There is no legacy production acoustic artifact owner to adapt: reuse the existing job queue, derived cache and media delivery owners. Source reads use asset/stream IDs; project reads reuse the exact audio compiler/mixer. Acoustic reducers consume a retained validated PCM file, never decode sources or invent a project.

The [core waveform reducer](../../../packages/core/src/audio-wave.ts) owns sample-domain reduction and shares WAV validation with audio publication. Its absolute bucket grid is independent of the selected range and byte header. Edge buckets explicitly report their clipped sample support; channels remain separate. Bucket count is bounded before reading sample data, and sample blocks yield for cancellation while the caller retains the cache lease.

## Verified acoustic artifact ownership

Timestamped waveform images derive from pinned waveform evidence; the bounded
spectral reducer and labeled images share the same acoustic lifecycle. The public
and fresh-agent evidence linked above verifies those surfaces and their axes.
Energy suggestions remain optional heuristics. Retimed conformance is verified separately below; listening
remains outside these numerical and visual verdicts.

The [cached waveform owner](../../../packages/core/src/acoustic-inspection.ts) uses the audio owner's canonical recipe and existing jobs/cache. A surviving waveform needs retained audio provenance, not resident PCM bytes. Rebuilding missing waveform data holds a PCM lease during reduction, then permits PCM eviction before waveform publication. Audio-generation changes fence publication; an explicit waveform retry retries its single audio prerequisite, while ordinary reads preserve terminal failures. JSON has an independent byte ceiling and preserves unavailable-support metadata rather than pretending missing capture context is silence. [Lifecycle evidence](../assets/11-waveform-jobs/README.md) covers the core boundary; it does not replace public delivery acceptance.

The [spectral kernel](../../../packages/core/src/audio-spectrum.ts) shares the absolute sample grid and validated PCM reader. It preserves separate channels and raw DC/noise energy, emits linear one-sided density, and labels each analysis window's actual support. [Spectral mechanism evidence](../assets/11-spectrum-core/README.md) proves transform normalization and axes independently; image acceptance is retained in the public journey.

The [first core pass evidence](../assets/11-waveform-core/README.md) verifies an independent mechanism, not public waveform acceptance. The larger retained-file test uses a sparse WAV to prove positioned I/O; actual native project-tap WAVs separately prove reducer integration. No listening claim follows from either.

## Work and review surface

Provide raw-source and processed-target dry/after-step taps through the same execution plan. Compare bounded waveform/spectrogram and audio results against full output, including nested group treatment and bypass.

Expose bucket origin/duration, min/max/RMS, channel handling and returned bounds in JSON. Image axes identify time domain, units, revision/generation and range. Full-track extraction is a bounded background job. Silence/energy suggestions are explicitly heuristic, never edits. Reuse artifact delivery tokens/file output.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/audio-evidence.mjs --fixture tones-and-clicks
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


## Waveform skill acceptance

[Blind skill use](../assets/11-waveform-skill/README.md) verifies that a fresh agent
can locate a short energy interval, map repeated project uses, and compare per-channel
dry/processed measurements through the delivered public JSON. This waveform-only
checkpoint predates the public image and fresh acoustic-skill evidence linked in
the status above; it does not establish listening acceptance.
## Acoustic raster checkpoint

The [headless raster evidence](../assets/11-acoustic-raster/README.md) covers images from retained measurements, channel/time/frequency axes, subpixel peak preservation, bounded labels and shared picture PNG preservation. This checkpoint predates the verified public lifecycle and fresh-agent use linked in the status above.

## Public image journey checkpoint

[Actual public acoustic evidence](../assets/11-public-acoustic-images/README.md) verifies CLI/MCP waveform and spectrogram PNG delivery, independent source/project measurements and pixels, all nested processing taps, outside-view missing FFT context, cancellation/retry, history, restart and temporary sidecar cleanup. The later fresh-agent product-use proof is linked in the status; speech/listening acceptance remains separate.


## Retimed conformance

[The public retimed fixture](../assets/11-retimed-acoustic/README.md) verifies
preserve/follow pitch, repeated occurrences, fractional ranges and pure splits.
Complete delivered PCM owns the independent bucket values and spectral oracle;
localized transient columns discriminate time offsets that steady tones cannot.
Both transports return the same artifacts. Fresh visual review passes axis and
panel readability, retaining small boundary markers and faint-feature limitations.
The earlier fresh-agent navigation proof remains applicable; no agent heard audio.
