# 12c — Reproduce local noise reduction

Status: not started. Dependencies: [00](./00-corpus.md).

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
