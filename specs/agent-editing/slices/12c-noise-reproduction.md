# 12c — Reproduce local noise reduction

Status: research in progress; conventional and learned candidates have measured timing mechanisms, but speech quality and production state policy remain unverified. No processor is adopted. Dependencies: [00](./00-corpus.md).

## Contract

A frozen local implementation reduces unwanted background noise while preserving
speech, selection boundaries and timing under a measured processing-state policy.

## Seam and ownership

Use a standalone bounded reproduction harness, then hand a concrete typed variant
and frozen recipe to 15a. Compare primary-source candidates from
[research](../research.md), including a conventional spectral method and a
speech-oriented learned method. No backend, strength default or channel policy is
accepted from documentation alone. Do not add a production-only denoise engine.

## Work and review surface

Use admitted real narration and the retained room-tone sample, plus clean speech
with known added noise. Include steady hum/hiss, transient noise, clean speech,
quiet consonants, starts/ends, post-retime speech, combined overlapping inputs and
stereo/channel cases. Separate stationary-noise
and transient-noise findings. Record code/model/license/runtime/input hashes,
preparation, parameters, raw outputs, latency/tails, context/reset policy,
resource measurements and separately labeled loudness-matched auditions.

Create this planned probe:

```sh
node packages/test-harness/editing/denoise-reproduction.mjs --fixture narration-noise
```

## Acceptance

Measure residual noise and speech distortion separately. Protect words and
onsets/ends; ASR is a diagnostic, not listening acceptance. Independent listening
checks naturalness, pumping, musical artifacts and introduced echo. Preserve raw
output gain/clipping evidence even when audition copies are loudness-matched.

Prove exact sample count, declared latency compensation, channel behavior, repeat
stability, chunk-size behavior, short selections, poisoned excluded samples and
unchanged neighbors. Distinguish a pure split from an edit that changes kept input.
Prove range/full equivalence using bounded context/checkpoints or explicit prepared
outputs. Freeze the actual evaluation-origin/context policy before adoption;
source-grid leakage and universal fixed padding are not assumed acceptable.

## Failure boundary and discretion

If one candidate fails, evaluate the bounded alternative without weakening speech
or timing gates. Missing listening stays unverified while independent work
continues. Candidate configuration and internal harness structure are delegated;
quality acceptance, context isolation, offline behavior and preparation visibility
are fixed by [processing](../processing.md) and [verification](../verification.md).
Update status, frozen evidence, limitations and the README handoff before ending.


## Measured checkpoints and next pickup

The [conventional baseline](../assets/12c-denoise-baseline/README.md) and
[state probe](../assets/12c-denoise-state/README.md) exposed hidden delay and
per-window reset changes. [Flushing/compensation](../assets/12c-denoise-timing/README.md)
restores tested timing/counts and proves selected-input isolation; independent
split resets still fail. The [learned baseline](../assets/12c-rnnoise/README.md)
reduces room tone but truncates output. Its [frame API probe](../assets/12c-rnnoise-timing/README.md)
restores tested counts/positions without establishing protected speech quality.
The same learned candidate also requires input exclusion before processing and
fails independent reset-per-clip state, including exact repeated-run evidence.

[Matched stationary-noise inputs](../assets/12c-matched-noise/README.md) now expose
the candidates’ attenuation/reference-distortion tradeoff with exact repeatability.
[Independent clean speech and a matched-level control](../assets/12c-clean-reference/README.md)
now separate input-level sensitivity from the earlier recording-specific change.
The user [prefers the learned audition](../assets/12c-matched-noise/audition/README.md)
on the original-recording cohort. Carry that frozen RNNoise recipe forward; next
verify protected phonemes, joins and broader listening, then
freeze a state policy that preserves pure splits while excluding removed input.
Neither measured noise attenuation nor surviving impulse peaks closes listening,
protected-phoneme, retimed/combined-input or production integration acceptance.

[Brief transient controls](../assets/12c-transient-noise/README.md) extend the
stationary comparison with fixed bursts. Noise-only attenuation differs across
these cohorts; mixed-speech error still cannot establish protected speech quality.

[Channel-relation controls](../assets/12c-channel-relations/README.md) measure
identical, inverted and half-level channels without adopting independent stereo
processing. The small measured balance change is not an audible acceptance verdict.

[Range-origin evidence](../assets/12c-range-origin/README.md) rejects the tested
one-second warmup for exact range/full equality. Investigate retained prepared
output or verified checkpoints; do not silently replay an unbounded prefix.
