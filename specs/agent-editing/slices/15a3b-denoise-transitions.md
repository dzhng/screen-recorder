# 15a3b — Explicit denoise strength and transitions

Status: planned, dependency-ready unit-rate contract. Dependencies: [15a3a](15a3a-unit-rate-combined.md), [16b](16b-scalar-program.md).
Parent15a/16 keep retiming, speech quality and complete journeys open.

## Contract and API

Add optional `mix` to the existing `rnnoise` processor: a number or existing
anchored scalar Curve, with the whole function constrained to[0,1]. Omission
means1, preserving the frozen fully processed result. Zero selects the unchanged
signal at this exact stack position; one selects the latency-aligned learned
result. Intermediate values linearly mix those same signals. This is an explicit
wet/dry control, not a new model strength setting or automatic boundary choice.
An agent authors a fade using ordinary keys and the existing activation window.
Outside the half-open window the output stays dry.

Use the shared scalar compiler, anchor restriction and native scalar evaluator.
For intermediate values, evaluate `(1-mix)*Double(dry) + mix*Double(wet)` then
convert once toFloat. Handle exact0 and1 by copying the respectiveFloat samples,
so dry/full-wet endpoints preserve their existing bits. The same scalar applies
to both channels; existing independent-channel learned processing is unchanged.
No equal-power curve, loudness normalization or implicit smoothing is added.

A zero-valued key does not reset or split learned state. Existing activation,
connected-domain and input-binding rules still define state. Bypass retains its
existing meaning. Dry means the immediately preceding ordered signal, including
all upstream processing and routing, not the immutable source. Every downstream
processor consumes the mixed result. Preparation identity must include the
mix program and its clock so changed settings cannot reuse stale final PCM.
Prepared spans contain the mixed step result: blend against the already retained
immediate upstream PCM during state preparation, before exposing prepared coverage.
Playback's existing prefix-skipping then remains correct, including downstream
learned steps. Preserve omitted mix in compiled recipes where possible, but review
composition audio/movie execution identities independently of the unchanged model
ID; no cache may silently inherit changed output semantics.

## Ownership and verification

Extend the existing processor registry, temporal compiler and native prepared
state application. Do not introduce a parallel effect interpreter, state owner,
asset store or job lifecycle. Reuse existing preparation, preview/export,
package and schema discovery consumers. Internal helper naming is delegated;
the API, range, arithmetic and state semantics above are fixed.

Use a short retained differing-stereo source and the frozen C learned adapter.
Independently assemble dry/full-wet references and evaluate complete linear,
cubic and hold envelopes. Verify0/1 endpoints, dry neighbors, both channels,
full/range equality, split/trim/move restriction, clip and parent scopes,
stack order, bypass, history/undo and changed-recipe invalidation through actual
CLI/MCP/service/native delivery. Retain a wrong-phase or wrong-order negative.
Include two learned steps with intervening gain to prove prefix order. Verify a
zero plateau followed by nonzero mix against uninterrupted learned samples,
including a pure split through the plateau; reset-at-zero must fail.
No download, live input, audition or large preparation is necessary. Numeric
agreement is not a listening-quality verdict or permission to enable retiming.

Extend the existing denoise public journey with explicit mix cases; preserve its
default coverage. Keep composition restriction/state, prepared identity, native
full-wet parity and public retained-consumer gates green. Review shape, code,
docs and choices before committing, then integrate and update the hub.
