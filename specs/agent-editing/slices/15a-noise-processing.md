# 15a — Adopt verified noise reduction in processing stacks

Status: not started. Dependencies: [03c](./03c-processing-stacks.md), [08](./08-audio-mixing.md), [09](./09-first-preview.md), [12c](./12c-noise-reproduction.md), [14](./14-retiming.md), [16](./16-keyframes.md).

## Contract

Optional noise reduction is an ordinary typed, reorderable, bypassable processor
using the same revision, preparation, inspection, preview and export paths.

Shared preparation prerequisite: [14a](./14a-prepared-audio.md).

## Seam and ownership

Adopt the frozen 12c implementation through the composition registry/compiler and
native worker boundary. Core owns one prepared-derivative lifecycle shared with
retiming, scheduled by the existing job queue. Protocol/CLI/MCP expose the same
capability and edit schemas. No parallel denoise queue or mutable audio copy.

## Work and review surface

Add only the verified variant and supported parameter/target/channel contracts.
Retain model-dependent outputs and provenance; handle explicit model preparation,
missing dependencies, cancel/retry/restart and publication fencing. Implement dry
and after-instance inspection taps through the same plan, including waveform and
spectrogram consumers when 11 lands. Keep raw source reads unchanged.

Create this planned probe:

```sh
node packages/test-harness/editing/processing.mjs --case ordered-denoise --transport both
```

## Acceptance

Add the scenarios assigned here in the [live journey inventory](../journeys.md)
through actual public CLI/MCP and service paths. State-only checks do not replace
delivered-media or listening/physical gates.

Production-entry matched-input parity must preserve the frozen recipe. A real
noncommuting audio pair proves both orders execute, not merely serialize; bypass
matches baseline. Prove protected speech, exact duration, compensated latency,
fixed post-retime placement and combined-result meaning, pure-split preservation, selection isolation and
bounded preview/full-export equality. Test windowed denoising, supported parameter
automation and explicit transitions with dry neighbors unchanged. Reorder, undo/restore and historical renders
must not reuse stale processing or silently change implementation.

Exercise full queue, concurrent revisions, canceled work, restart, missing model,
poisoned outside regions and long/late-window requests. Noise reduction remains
optional; no automatic normalization, ducking or room-tone changes. Broader ordered
video output is verified by 15, and processing portability/scale/agent acceptance
remain mandatory in 22/24/25. Keep [verification](../verification.md) gates green.

## Failure boundary and discretion

Unavailable processing must fail explicitly, never export dry media silently.
Do not port or simplify the winning DSP until production parity is proven. Internal
buffering and worker organization are delegated within the measured recipe;
editorial defaults, source preservation and audible quality are not. Update status,
evidence and the README handoff; absent listening cannot be recorded as acceptance.
