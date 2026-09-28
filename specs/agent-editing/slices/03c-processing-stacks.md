# 03c — Ordered stack authoring and structural lifecycle

Status: not started. Dependencies: [03b](./03b-processing-targets.md), [03a](./03a-exact-edit-boundaries.md).

## Contract

One pure get/set stack interface supports ordered configured instances, bypass and
structural edits without mutation on failure.

## Seam and ownership

Composition owns ProcessingTarget, the processor registry and one canonical
processing collection, replacing the empty effects placeholder. Protocol imports
these schemas; 04 publishes processing.get/capabilities and edit.apply's
processing.set. Follow [processing](../processing.md), never effect.add/reorder
aliases or a second stack document.

## Work and review surface

Start with constant gain (finite nonnegative linear multiplier) at audio clip,
track, group and output targets. No automatic clipping/normalization. Store stable
step identities; new steps use normal batch allocation/labels. Implement complete
list replacement and empty clear. Defer window/curve syntax to 16 and visual
variants to 15; reject unsupported kinds/features explicitly until their owners
land. Get and normalized set receipts share the same canonical values.

```sh
node packages/test-harness/editing/processors.mjs --case ordered-edits
```

## Acceptance

Prove repeated instances, changed list order, bypass, copying settings with fresh
IDs, unknown/foreign/duplicate IDs, incompatible targets, no-op set, atomic failure,
clip duplicate/split/trim/delete, target removal, compatible replacement, explicit
reset and padded replacement propagation. New placement has no clip stack; parent
stack ownership stays unchanged. Preserve fractional timing and pure-split gain
function. Native output and real noncommuting order are later 08/15/15a gates.

## Failure boundary and discretion

Do not admit a stateful placeholder without its verified context/latency contract.
Internal modules are delegated; target ownership, fixed post-retime position,
get/set API and replacement preservation are settled. Update status/evidence and
README pickup. User scope changes propagate through execution and packaging owners.
