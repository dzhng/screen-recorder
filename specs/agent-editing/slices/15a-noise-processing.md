# 15a — Adopt verified noise reduction in processing stacks

Status: complete for local typed RNNoise execution and the finite acceptance matrix. [Acceptance evidence](../assets/denoise-acceptance/README.md) links native-entry parity, shared prepared/state consumers, combined preserve/follow-pitch preview/export, explicit transitions, portability and exact user quality verdicts. Installed cutover, final scale and autonomous workflow remain slices 23/24/25. Dependencies: [14a](./14a-prepared-audio.md), [03c](./03c-processing-stacks.md), [08](./08-audio-mixing.md), [09](./09-first-preview.md), [12c](./12c-noise-reproduction.md), [14](./14-retiming.md), [16](./16-keyframes.md).

## Contract

Optional noise reduction is an ordinary typed, reorderable, bypassable processor
using the same revision, preparation, inspection, preview and export paths.

Shared preparation owner: [14a](./14a-prepared-audio.md) already verifies durable
publication, public preparation and portable unit-rate/gain assets. Reuse that
owner; scoped RNNoise execution, retained consumers and portability are verified through15a2. The acceptance evidence records the complete parent matrix.
The [early protected-speech packet](../assets/12c-protected-speech/README.md) retains historical unaccepted crops; later complete-sentence verdicts supply the quality evidence.

## Seam and ownership

Adopt the frozen 12c implementation through the composition registry/compiler and
native worker boundary. Core owns one prepared-derivative lifecycle shared with
retiming, scheduled by the existing job queue. Protocol/CLI/MCP expose the same
capability and edit schemas. No parallel denoise queue or mutable audio copy.

## Checkpoints

1. [15a1 native-entry parity](./15a1-denoise-entry-parity.md) preserves the frozen mono algorithm without enabling public execution. It can proceed on the retained 12c identities without speech-quality acceptance or retiming/temporal adoption.
2. [15a2 prepared consumers](./15a2-denoise-prepared-consumers.md) establishes explicit supported state/channel semantics, typed recipes and model-aware prepared delivery through existing owners.
3. [15a3 combined and listening acceptance](./15a3-denoise-acceptance.md) retains post-retime, temporal, protected-speech and broader public gates. Completing an earlier checkpoint does not close this parent.

## Work and review surface

Add only the verified variant and supported parameter/target/channel contracts.
Retain model-dependent outputs and provenance; handle explicit model preparation,
missing dependencies, cancel/retry/restart and publication fencing. Implement dry
and after-instance inspection taps through the same plan, including waveform and
spectrogram consumers already supplied by 11. Keep raw source reads unchanged.

The existing [public denoise runner](../../../packages/test-harness/editing/denoise-runtime-public.mjs) owns default, combined, transition, post-retime and follow cases through CLI/MCP. Its linked evidence records the pinned worker/reference arguments and complete delivered artifacts.

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

The [public pause workflow](../assets/pause-audio-public/README.md) verifies an
explicit track/window RNNoise choice across an inserted gap, exact wet/dry mix,
unchanged neighbors, prepared delivery, bypass/undo and no implicit ambience
layer. Synthetic signals establish mechanics only; the accepted real-speech and post-retime cases remain separately linked in the parent evidence.
