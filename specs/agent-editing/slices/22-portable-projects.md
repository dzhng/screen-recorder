# 22 — Relocatable editable projects

Status: implementation in progress. [22a snapshot/dependency boundary](22a-portable-snapshots.md) and the [public archive journey](../assets/22-portable-projects/README.md) are verified. Current and historical rendered results, undo, source/reference bytes, acquisition bindings and exact journal/normalized evidence, retained source-scene and real source-transcript generations, cancellation, replay, corrupt/missing members and aggregate history rejection pass through CLI/MCP/native paths. Retained screenshot-index generations, non-current package export, fonts and prepared model-dependent output closure remain open; actual 15a output remains a final gate. Dependencies: [22a](./22a-portable-snapshots.md), [09](./09-first-preview.md), [10](./10-project-evidence.md), [11](./11-audio-inspection.md), [17](./17-text-captions.md), [15a](./15a-noise-processing.md).


## Contract

A portable package contains an editable project and all dependencies needed for playback, retained history, undo and regeneration provenance after relocation.

## Seam and ownership

Replace fixed-role package interpretation in the new path with one asset-inventory/dependency manifest. Reuse bounded archive creation/extraction and retained-file ownership. package.open/status/close inspect the package; explicit project adoption owns independent durable asset references.

## Checkpoints

1. [22a](22a-portable-snapshots.md): bounded snapshot, dependency inventory and atomic catalog adoption.
2. Archive/public vertical: existing export publication and package registry through CLI/MCP; relocated native playback/edit/undo and failure/cancellation probes.
3. Complete retained-owner closure: acquisition/evidence generations, prepared model-dependent results and fonts; actual 15a output and the full acceptance matrix below.

These are checkpoints within slice 22. No checkpoint reduces its final contract.

## Work and review surface

Retain editable routing/stacks and lossless prepared outputs required by current and historical model-dependent processing. Remove donor model cache and prove processed playback/undo; changed settings can require explicit preparation. Dependency fixtures can develop the package mechanism early, but final acceptance includes real 15a output.

Include current/history documents, referenced source/generated/reference audio, evidence generations and font requirements. Media dependencies are addressed by identity, not external absolute paths. Reuse source bytes without lossy recoding. Validate hashes/member paths and atomically adopt only after all required dependencies validate.

Use explicit generated-asset/camera metadata fixtures if those producers are not
ready. This proves dependency closure, not synthesis/capture quality; slice 25
repeats the journey with actual outputs. Packaging must not wait on model download
or physical camera access when the generic asset contract can already be tested.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/package.mjs --case relocate-edit-undo
```

## Acceptance

Add the scenarios assigned here in the [live journey inventory](../journeys.md)
through actual public CLI/MCP and service paths. State-only checks do not replace
delivered-media or listening/physical gates.

Export, move package, remove external imports/donor project/model cache, then open/adopt/render/edit/undo with identical semantic output. Exercise interrupted extraction, corrupt/missing member, bounded-size rejection and canceled adoption. Existing generated speech plays offline; regeneration clearly reports missing prepared model.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Failure boundary and discretion

Do not ship a package that only plays the current flattened video or leaves past revisions pointing outside. Old package-history migration is excluded; old source media remains explicitly importable.

Delegated: Archive compression and internal manifest organization. Required transitive ownership, editable adoption and bounded extraction are fixed.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.
