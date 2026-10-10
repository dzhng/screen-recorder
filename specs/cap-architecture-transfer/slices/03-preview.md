# Slice 03 — measure the existing warm preview path

## Contract unlocked

Preview remains a read/inspection concern and cannot delay or alter capture
media. The first deliverable is evidence about the existing owner, not a new
preview abstraction.

Cap's preview path reuses an open editor's decoders, render constants and GPU
resources and temporarily pauses competing prefetch ([`crates/export/src/preview.rs:137-209`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/crates/export/src/preview.rs#L137-L209)).

## Yap seam and ownership

Measure [`packages/core/src/project-preview.ts`](../../../packages/core/src/project-preview.ts)
and its existing tests before adding any owner or API. Compare cold setup with
the cached/published path already covered by
[`packages/core/src/project-preview.test.ts`](../../../packages/core/src/project-preview.test.ts).

If evidence shows repeated decoder/GPU setup or preview work affecting capture,
optimize inside the existing preview owner. Keep source capture and immutable
composition owners unchanged.

## Tests and evidence

- Add a focused timing/behavior probe for cold versus warm preview setup.
- Assert the preview result does not mutate the pinned revision or source bytes.
- If the implementation changes a visual surface, run `screenshot-critique`,
  `compare-screenshots` against the prior output, and `preview-shots` before
  accepting it. A measurement-only change needs no screenshot gate.

## Evidence

The existing preview owner already has the warm path Cap's design calls for.
`submitCachedDerivative` acquires a published cache entry and only regenerates
after that entry has been evicted. The focused regression test in
`packages/core/src/project-preview.test.ts` proves this at the preview
boundary: a cold request renders once, a second request for the same pinned
revision is ready without another render, and the source asset bytes remain
unchanged. The test was shown to fail after a deliberate temporary cache
regeneration mutation, then passed again with the implementation restored.

No preview API, renderer, or scheduling change is warranted by this evidence.

## Firewalls

No new preview operation, no mutable serialized Cap timeline, no rendering
engine fork, and no optimization without measured evidence.
