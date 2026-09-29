# 08 — Independent audio mixing

Status: native constant-gain execution and tested fractional unit-rate mapping pass; later09/11a public jobs, taps and large PCM delivery supply their scoped integration gates. [Current reconciliation](../assets/08-current-acceptance/README.md) records the combined-worker rerun. [Physical-segment composition](../assets/08-physical-segments/README.md) passes at 44.1/48kHz after a converter buffer-state fix. [Thirty-minute A/V drift](../assets/08-av-drift/README.md) passes actual public export with 120 fractional edits. [Mixed-rate conformance](../assets/08-11-rate-conformance/README.md) adds 44.1k AAC/MP3 with 48k PCM and frozen-decoder arithmetic; independent resampled AAC reproducibility remains unresolved. [Low/high lossless rates](../assets/08-lossless-rate-boundaries/README.md) add bounded 8/192k source conformance. Broader codec/rate conformance and real-narration listening remain open. Dependencies: [02](./02-assets.md), [05](./05-compiler.md).

## Contract

Any admitted audio instances can overlap and replace one another independently of video, producing an exact-duration PCM mix.

## Seam and ownership

Native audio execution consumes the independent audio plan from slice 05. Replace recording-role uniqueness inside the new path with stream/clip identity. Mixing is linear float PCM at the declared output rate/channels with explicit constant gain stacks; animated gains and fades belong to 16.

## Work and review surface

Execute constant gain stacks at clip, track, nested group and output scopes after their declared combination. No inherited source-count attenuation or hidden join ramps. Empty/bypassed stacks preserve baseline; adding a silent track cannot change other levels. Gain chains commute, so actual noncommuting audio-order proof belongs to 15a.

Decode and resample admitted streams, place them by project sample bounds, sum requested tracks and report peak/clipping evidence. Implement explicit trims and silence gaps without automatic ducking/normalization. Preserve acquisition-gap reporting. Rate-changing pitch-preserved audio waits for slice 14.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/audio-mix.mjs --case music-and-replacement
```

## Acceptance

Known tone/impulse mixes have expected placements, amplitudes, channel mapping and sample counts. Replace audio while video plan is identical. Test absent streams versus acquired silence and actual mixed 44.1/48 kHz source decoding/resampling (slice 05 proves only rate-independent presentation-time planning), long edits without drift, cancel/restart and bounded PCM buffers. Audition real narration joins per verification.md.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Failure boundary and discretion

Do not relabel imported/generated audio as narration/system or derive audio ranges from the video plan. Isolate sample-clock errors before adding effects.

Delegated: Buffer size/resampler configuration after measured conformance. Hidden gain policies and sound-quality claims are not delegated.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.



Consume compiler-owned [selected resampling context](../processing.md#selected-resampling-context).
Do not infer neighboring editorial continuity or read asset-wide filter input.
Prove impulses outside selection, source acquisition and ancestor support cannot
affect retained output, while pure splits and late windows preserve samples.
The tested unit-rate fractional mappings are verified; unknown rate-changing
phase still requires prepared retiming and must not be inferred from those checks.

[Lossless-container](../assets/08-lossless-containers/README.md),
[simultaneous44.1/48kHz](../assets/08-mixed-rates/README.md),
[AAC/MP3 overlap](../assets/08-compressed-mix/README.md),
[compressed endpoints](../assets/08-compressed-endpoints/README.md) and
[physical segment-origin composition](../assets/08-physical-segments/README.md)
retain the measured format/rate coverage. The segment probe fixes a converter
buffer-state defect while preserving full/range/split samples and excluded-input
isolation; source and mixer regression suites pass.
[Long-project A/V timing](../assets/08-av-drift/README.md) is verified for the
measured thirty-minute public export. Broader rate/codec coverage and real-narration
listening remain open.

[Negative-origin feasibility](../assets/08-negative-origin/README.md) exhausted a bounded two-candidate probe: a negative writer session normalized to zero, and negative composition insertion was refused before export. No genuine negative occupied-origin asset was produced; its public mixing proof remains unverified, without a new admission restriction.
