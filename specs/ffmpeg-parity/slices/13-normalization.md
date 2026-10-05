# 13 — Explicit normalization

Status: typed execution and wider scoped PCM/refusal acceptance verified; consumer/release acceptance remains open. Question: **Can an explicitly requested loudness treatment retain mode and full-context identity?**

Dependencies: [13a](13a-normalization-reproduction.md), [10](10-loudness.md); managed FFmpeg requires 01–05 and [96](96-audio-preparation.md).

Freeze the [recipe reproduction](13a-normalization-reproduction.md) before changing behavior. Its parameter/state mapping is the mandatory contract for this slice.

## Contract and owner

Composition processor registry/state domains, core retained prepared audio, service execution.

Target LUFS/TP/LRA and requested mode belong to typed recipe with full signal measurement dependencies and output sample rate. Gain-only linear mode must refuse when targets cannot be met; dynamic mode is separately explicit. No silent loudnorm mode fallback. Inspectors consume retained prepared result.

## Focused proof and review

A short requested treatment and before/after measurements.

Gain-only identity, silence, inadequate context, measured linear feasibility and dynamic request. Full/window and structural split invariance, exact sample count, post-encode true peak and complete recipe identity. Listen before sound-quality claims. −14 LUFS remains optional skill guidance.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.

## Frozen admission requirements

Use the frozen13a controls and whole-domain recipe. Prepared publication admits
only candidates meeting requested integrated target, maximum LRA and meter-specific
peak ceiling under the declared tolerances, with exact sample count. Retain
requested/achieved values. The failed stepped dynamic candidate is a mandatory
refusal fixture, not permission to reduce targets or substitute gain-only.
The shared preparation contract must exist before implementation.

Implementation and scoped execution proof live with the [shared state checkpoint](96-audio-preparation.md#execution-checkpoint); the [wider acceptance](96-audio-preparation.md#wider-audio-acceptance-checkpoint) retains retiming/refusal, independently measured decoded AAC and actual child-scoped resource evidence. This is not a sound-quality or encoded-peak guarantee.
