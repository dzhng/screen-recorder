# 05 — Compile bounded execution plans

Status: pure schedules and strict revision-pinned target windows verified; native binding and full compiler acceptance remain open. See [evidence](../assets/05-compiler/README.md). Dependencies: [01](./01-composition.md), [03](./03-edits.md), [03c](./03c-processing-stacks.md).

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

A short window agrees with the corresponding full-project schedule at all sampled times, including fractional fps and non-frame-aligned starts. Validate independent AV, repeat/reorder, held source, bounded iteration and mixed source rates. Golden plans show exact layer/source/sample membership.

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
