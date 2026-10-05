# 15 — Explicit compressor and ducking

Status: typed execution checkpoint verified; consumer/release acceptance remains open. Question: **Does caller-selected detector routing drive one consistent stateful treatment?**

Dependencies: [15a](15a-compressor-reproduction.md), [10](10-loudness.md); managed FFmpeg requires 01–05 and [96](96-audio-preparation.md).

Freeze the [recipe reproduction](15a-compressor-reproduction.md) before changing behavior. Its parameter/state mapping is the mandatory contract for this slice.

## Contract and owner

Composition routing/ordered processors and state domains; prepared audio retains detector dependencies.

Typed detector selection, threshold, ratio, knee, attack/release and channel linkage. Standalone compression uses the selected signal; ducking names another detector. Read-only gain-key proposal may reuse speech regions but application is explicit. No automatic music selection.

## Focused proof and review

Two distinguishable audio stems and gain-envelope evidence.

Known detector steps/absence/overlap, routing cycle refusal, channel linking, repeated/retimed selections and split/full/window state invariance. Preserve latency and tails; listen to selected mix excerpt. Detection does not permit edits.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.

## Frozen execution

Use 15a's linked peak detector and bounded typed controls, explicit detector-prefix
dependency, common128-frame internal packet grid and authored final trim. Never
turn unavailable detector support into silence. The shared preparation contract
must freeze routing dependencies before implementation.

Implementation and scoped execution proof live with the [shared state checkpoint](96-audio-preparation.md#execution-checkpoint). This is not a sound-quality or encoded-peak claim.
