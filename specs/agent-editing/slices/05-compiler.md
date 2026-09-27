# 05 — Compile bounded execution plans

Status: not started. Dependencies: [01](./01-composition.md), [03](./03-edits.md).

## Contract

One compiler produces bounded, windowed execution instructions used by every inspection, preview and export path.

## Seam and ownership

`compileWindow(revision, assetMetadata, range, rendition)` and bounded frame/audio schedule iterators in composition. Outputs use asset/stream IDs, exact project bounds, source requests, layer order and prepared audio segments; service alone resolves assets to retained files.

## Work and review surface

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

