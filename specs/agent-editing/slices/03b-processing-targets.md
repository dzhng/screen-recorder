# 03b — Processing targets and nested routing

Status: accepted for pure routing. [Evidence](../assets/03b-routing/README.md): 73 tests, type checking, build and independent review pass. Dependencies: [03](./03-edits.md).

## Contract

A validated media-kind forest assigns each track/group exactly one parent and a
stable sibling order, independently of clip timing and synchronization.

## Seam and ownership

Composition owns group schema, routing edits and the leaf ordering consumed by
inspection/compiler. Follow [processing](../processing.md); no second timeline,
routing graph or effect inheritance owner. The first pass adds topology only.

## Work and review surface

Implement group.add/remove, routing.set and layers.reorder; extend track.add with
parent and replace unshipped global track.reorder. Groups are audio/video typed,
parent defaults to output, order is local to siblings. Preserve clips and sync
links. Validate without recursive traversal that can overflow on a deep input.

```sh
node packages/test-harness/editing/processors.mjs --case routing
```

## Acceptance

Through applyBatch prove nested groups, label references, moving a populated track
between groups without changing source/time mappings, leaf ordering, whole-sibling
reorder, cycles, foreign/mismatched parents, duplicate order, nonempty removal,
no-ops, replay identity and late-operation atomic failure. Empty groups produce
no duration. Existing structural/corpus probes stay green. These are topology
proofs, not native processing acceptance.

## Failure boundary and discretion

An audio/video synchronization group is not a processing group. If grouping changes
project time or synchronization membership, fix ownership before continuing.
Internal lookup/index representation is delegated; media compatibility, no parallel
routing, one parent and sibling order follow the canonical contract. Update status,
evidence and the README handoff before ending the pass. User feedback changing
routing scope requires updating compiler and execution slices too.
