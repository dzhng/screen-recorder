# 08 — Independent audio mixing

Status: not started. Dependencies: [02](./02-assets.md), [05](./05-compiler.md).

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
Unknown fractional phase remains explicit NOT_READY until independently proven.
