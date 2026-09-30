# 12c — Reproduce local noise reduction

Status: frozen user-preferred RNNoise has measured timing and retained-output state evidence. Scoped production execution, independent mono/stereo lanes and mix transitions are verified through [15a](15a-noise-processing.md); The [current user verdicts](../assets/listening-review-2026-09-30.md) pass the exact familiar post-retime output, different complete protected sentence and authored half-level stereo balance. The [known-added-noise complete sentence](../assets/15a3-noisy-sentence/README.md) awaits listening; broader quality remains open. Dependencies: [00](./00-corpus.md).

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
on the original-recording cohort. Carry that frozen RNNoise recipe forward. The
mono retained-output mechanism below preserves tested pure splits and excluded
neighbors; production target/channel/transition evidence belongs to [15a](15a-noise-processing.md). The
[protected-speech packet](../assets/12c-protected-speech/README.md) now supplies
exact retained contexts and unconfirmed annotation targets for phoneme/join listening.
Neither measured noise attenuation nor surviving impulse peaks closes listening,
protected-phoneme or post-retime acceptance. Scoped combined-input and production
integration results are recorded in 15a.

[Brief transient controls](../assets/12c-transient-noise/README.md) extend the
stationary comparison with fixed bursts. Noise-only attenuation differs across
these cohorts; mixed-speech error still cannot establish protected speech quality.

[Channel-relation controls](../assets/12c-channel-relations/README.md) measure
identical, inverted and half-level channels without itself establishing production adoption. The later
[independent-channel checkpoint](15a2f-independent-channels.md) owns that policy;
the small measured balance change is not an audible acceptance verdict.

[Range-origin evidence](../assets/12c-range-origin/README.md) rejects the tested
one-second warmup for exact range/full equality. The retained-output proof below
supplies the tested alternative; do not silently replay an unbounded prefix.

[Retained-output reproduction](../assets/12c-prepared-output/README.md) now proves
exact pure-split/excluded-neighbor preservation through compiled native upstream
PCM, fixed-recipe parity and bounded reads of the prepared result. Fresh trim
processing differs from stale cropped output; gain/RNNoise order differs in real
PCM. This is an output-target mono research proof. The later [prepared consumer
checkpoint](15a2-denoise-prepared-consumers.md) binds the frozen adapter to the
single durable owner, with public target/channel and portable retained-output
checks. [Explicit mix transitions](15a3b-denoise-transitions.md) retain learned
state while blending against the immediate input. Those implementation results
do not close this slice's speech-quality or post-retime requirements.

The user could not understand the unfamiliar cropped words and reported no
obvious artifacts. That feedback is not intelligibility acceptance. Future
listening material uses complete meaningful sentences with a transcript and
labeled original/edited versions, as specified by [15a3](15a3-denoise-acceptance.md).
