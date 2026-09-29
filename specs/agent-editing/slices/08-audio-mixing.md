# 08 — Independent audio mixing

Status: verified for the stated independent unit-rate mixing contract. [Contract evidence](../assets/08-current-acceptance/README.md) combines native/public preservation, mixed-rate and long-clock checks, the accepted public narration join, and exact current-worker AAC full/range PCM. Historical AAC variability, unverified negative occupied origins and unheard accompaniment balance remain explicit limitations, not claims of universal codec or perceptual coverage. Retiming and other processor quality stay with their owning slices. Dependencies: [02](./02-assets.md), [05](./05-compiler.md).

## Contract

Audio instances in the supported execution domain can overlap and replace one another independently of video, producing an exact-duration PCM mix. Assets outside that domain remain admitted media with truthful execution refusal.

[Recorded narration plus authored accompaniment](../assets/08-narration-music/README.md)
now has scoped public exact-sample, dry-neighbor, gain-negative and undo evidence;
perceptual accompaniment balance remains unverified. The separately accepted12d
join establishes only its own original/candidate pair.

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
measured thirty-minute public export. These are named conformance cases, not a
universal codec guarantee. The accepted public12d join covers its own narration
edit; other perceptual judgments remain separate.

[Negative-origin feasibility](../assets/08-negative-origin/README.md) exhausted a bounded two-candidate probe: a negative writer session normalized to zero, and negative composition insertion was refused before export. No genuine negative occupied-origin asset was produced; its public mixing proof remains unverified, without a new admission restriction.

[Admission-boundary characterization](../assets/08-admission-boundaries/README.md) records one public fractional-rate/discrete-layout cohort: raw refusals and broader composition readiness differ, while measured output clocks/range phase and discrete channel samples agree. No policy change or independent fractional-source-time fidelity claim follows.

[Fractional-rate refusal](../assets/08-fractional-rate-refusal/README.md) resolves a measured late-window phase defect with a shared integral-native-rate execution guard and new audio/movie recipe identities. Asset admission and discrete-two-channel mapping remain unchanged; old ready fractional recipes cannot bypass refusal.

[Exact physical segment phase](../assets/08-rational-segment-phase/README.md)
retains rational occupied times through the shared reader and invalidates affected
derived recipes; full/late PCM, binding acquisition support and legacy converter
lookahead have focused preservation evidence. Listening remains separate.

[Native sample-address evidence](../assets/08-native-sample-address/README.md)
verifies arbitrary physical phase through full/range decoding and resampling,
with binding acquisition masks, bounded seeks and cache invalidation.

## Current mixed-range verification

The [current retained-input check](../assets/08-11-rate-conformance/current-mixed-range/README.md)
passes exact full/range PCM on worker8a. The historical6663 range still differs in
4530 scalar samples; its cause is unknown and its bytes remain retained. This
current composition check is distinct from the source-only repeat cohort. No
tolerance, shift, recipe or source material changed to pass it. Root independently
verified the complete current PCM and request preservation, plus all18 archived
members. The stated slice requirements are met by the combined named evidence;
this does not establish general decoder determinism or the separate later gates.
