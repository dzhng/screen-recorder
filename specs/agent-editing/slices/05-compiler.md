# 05 — Compile bounded execution plans

Status: pure compiler accepted. Strict records, availability provenance, clipped presentation intervals, independent AV and nested-window conformance pass. Native adoption belongs to downstream slices, not this dependency. See [evidence](../assets/05-compiler/README.md). Dependencies: [01](./01-composition.md), [03](./03-edits.md), [03c](./03c-processing-stacks.md).

## Contract

One compiler produces bounded, windowed execution instructions used by every inspection, preview and export path.

## Seam and ownership

`createCompiler(validatedRevision, revisionId)` builds one reusable interval index and exposes bounded frame/audio schedules plus processing-tree instructions. Its window method validates target taps and emits a strict manifest identifying revision, rendition, sources, ordered processing and unresolved native/preparation requirements. Outputs use asset/stream IDs, exact project bounds, source requests, layer order and prepared audio segments; service alone resolves assets to retained files.

## Work and review surface

Compile the processing target forest, ordered stacks and combined parent inputs per processing.md. Preserve fixed post-retime placement, depth-first layer rank, raw/dry/after-step tap identity, implementation/context dependencies and downstream invalidation. Prove nested-tree window/full schedule equality; reject unsupported execution explicitly.

Implement global frame phase, source sample selection requests, sample-accurate audio placements, gaps/holds, compiled transform defaults and dependency identity. Reuse one interval index per immutable revision. Define strict worker-facing records without a second editable project format.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/compiler.mjs --fixture phase-offset
```

## Acceptance

A short window agrees with the corresponding full-project schedule at all sampled times, including fractional fps and non-frame-aligned starts. Validate independent AV, repeat/reorder, held source and bounded iteration. Prove source presentation-time planning through the real admitted-metadata projection with different source-rate metadata; decoded mixed-rate resampling is the distinct slice 08 gate. Golden plans show exact layer/source/sample membership.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Failure boundary and discretion

If a plan requires materializing every project frame or projecting every word for a bounded request, revise the iterator/index seam before native integration.

Delegated: Index structure, chunk sizes and serialization. Sampling, fit/anchor/curve meaning and artifact identity remain core-owned.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.


## Execution-window contract

Bind an opaque revision ID when constructing the compiler. A window request pins
its exact range, a target tap (dry, after a named step, or fully processed), and
the baseline 48 kHz stereo rendition. Canvas and frame rate come from the pinned
document; this pass introduces no output resize policy. Raw source evidence stays
a source read; a dry target tap still includes its children and fixed media mechanics.

The strict serializable manifest carries revision, range, rendition, tap, ordered
processing inputs, immutable source references/mappings, and unresolved preparation
and implementation requirements. Together these values identify the work; the
storage owner may hash canonical manifest bytes without another compiler hash
algorithm. Frame/audio schedules remain lazy and preserve their absolute clocks.
Native execution readiness must fail explicitly until the owning native slices
bind real executors and prepared retiming results. A typed descriptor is not media.


## Acceptance boundary

The [pure probe](../../../packages/test-harness/editing/compiler.mjs) consumes the
real core metadata projection and compiler exports. Strict manifest and streamed
frame/audio schemas round-trip JSON; golden requests preserve independently
reordered AV, nested window/full restriction, source gaps, fractional frame clocks
and partial first/last pictures. Source sample-rate metadata does not change the
project-time selection algebra. This is engine evidence, not a live service journey.

Slice 07 binds/executes video instructions and preserves the frozen 06 media gate;
08 proves decoded source-rate conversion, channel behavior, mixing and gain;
09 proves CLI/MCP service-to-media preview/export; 14 binds verified stretch;
15/16/15a extend the compiler for visual processing, automation and verified denoise.
Those downstream implementations pin real worker/recipe identities and resolve the
currently explicit preparation requirements. Their absence does not block this
pure compiler acceptance, and this acceptance does not pre-approve their media.


Frame availability carries source-versus-anchor provenance. The resolver retains
exact anchor support before source intersection; anchor absence takes precedence
in compiled records. Slice 07 may resolve source-unavailable to an explicit empty
edit only through physical source proof. Unknown source gaps and unavailable
ancestors remain unavailable. Native code must not recreate anchor semantics.
