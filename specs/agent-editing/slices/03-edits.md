# 03 — Structural edits and attachments

Status: in progress; track/canvas, placement, linking and atomic batch foundation verified. Dependencies: [01](./01-composition.md), [03a](./03a-exact-edit-boundaries.md).

## Contract

A deterministic batch performs structural edits, linked/independent changes and attachment propagation with no partial document on failure.

## Seam and ownership

`applyBatch(document, operations, identityContext)` in composition returns the next document, normalized expansion, created IDs, split lineage, removed attachments and link changes, or one typed error. Implement the operations table in contracts.md.

## Work and review surface

Support place/insert/remove/move/replace/split/trim/retime/duplicate/link/unlink and explicit ripple tracks. Use operation labels for in-batch references. Apply linked scope by default and selected-scope split/unlink explicitly. Keep project anchors fixed and partition content anchors, including attached overlays. No storage, decoding or generated speech runs in this reducer.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/edits.mjs --fixture linked-replacement
```

## Acceptance

Test failure on operation 3 of 4, original immutability, repeated-source identity, duplicate versus fresh placement, split through an attachment, deleting all attached content, replace-audio without changing video, insert spanning a sync group with unequal offsets, explicit ripple, no-op and full deletion to an empty project. A parent and attached overlay on two named tracks shift once; child-only ripple rejects. IDs and normalized results are repeatable for the same supplied identity context.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Failure boundary and discretion

If an operation has ambiguous track or link scope, reject with actionable candidates rather than choose a creative interpretation. Reslice only if an operation introduces a second time algebra.

Delegated: Reducer implementation and internal immutable collections; not default ripple scope, attachment semantics or hidden normalization.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.

## Foundation checkpoint

The pure reducer owns deterministic batch labels and identities, validated
per-operation expansion, and a net-change result. The model owns validation and
exact mapping; the public package boundary exposes both without a dependency
cycle. [24 tests](../assets/03-edits/foundation-tests.txt), package build/type
checks and the [corpus probe](../assets/03-edits/composition-probe.json) pass.
Independent Codex review found no actionable correctness issues. A net-no-op
regression first failed and now passes when a batch adds then removes a track.

Split/trim, remove, move, insert, replace, retime, duplicate and attachment/ripple
propagation remain unimplemented. Empty split/attachment receipt fields do not
claim those capabilities. The full edits probe and public service remain open.
