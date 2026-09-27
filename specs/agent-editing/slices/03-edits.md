# 03 — Structural edits and attachments

Status: not started. Dependencies: [01](./01-composition.md).

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
