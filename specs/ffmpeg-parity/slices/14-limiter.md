# 14 — Explicit limiter

Status: not started. Question: **Does the declared ceiling preserve timing and state in every consumer?**

Dependencies: [14a](14a-limiter-reproduction.md), [10](10-loudness.md); managed FFmpeg requires 01–05 and [96](96-audio-preparation.md).

Freeze the [recipe reproduction](14a-limiter-reproduction.md) before changing behavior. Its parameter/state mapping is the mandatory contract for this slice.

## Contract and owner

Same composition state-domain/prepared-audio owners; selected compatible limiter implementation.

Define ceiling, one lookahead/attack duration and release, channel linkage and latency compensation. Disable unrequested auto-level. Recipe persists actual implementation and context, and prepared signal is shared by inspection/preview/export.

## Focused proof and review

Impulse/step/tail PCM comparison and bounded listening excerpt.

Independent expected transient response, no auto-gain, latency/flush/sample count, split/unsplit and full/window equality. Meter encoded output separately; sample peak is not guaranteed true peak. Freeze response/peak tolerances before accepting production implementation.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.

## Frozen controls

Use 14a's single `lookaheadMs` control, `ceilingDbfs` and `releaseMs`, linked stereo,
auto-level disabled and latency compensation enabled. Lookahead and attack are
one proven coupled duration. The shared preparation contract must exist before
implementation; compiler/native owners retain complete state domains.

Production uses14a's composed mono max-detector/common-gain graph, not the failed
raw per-channel safety clip. Validate sample ceiling and exact output count before
prepared publication; linking, signed response and zero behavior retain frozen
parity gates. A failed candidate cannot be published as a completed treatment.
