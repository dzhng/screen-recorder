# 03 — Structural edits and attachments

Status: in progress; batch foundation, splitting, gap-preserving removal and trim verified. Dependencies: [01](./01-composition.md), [03a](./03a-exact-edit-boundaries.md).

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

The checkpoint establishes the shared batch contract; structural operation
progress is tracked below. The full edits probe and public service remain open.

## Split checkpoint

Splits preserve exact source mapping for linked or selected clips, recursively
partition attached media, and rebase normalized anchors on held parents. Left
children retain identity; right children and surviving right synchronization
groups receive deterministic identities. Optional right-child labels make these
pieces addressable later in the same batch. Splitting at an existing boundary
has no net change. Only actually split selected members lose synchronization.

[29 composition tests](../assets/03-edits/split/tests.txt) and type checks pass.
A [rounded-boundary mutation](../assets/03-edits/split/rounding-mutation.txt) fails.
Both independent reviews found that an untouched selected member could lose its
link; the [regression](../assets/03-edits/split/selected-members-red.txt) failed
before filtering by actual partition results and now passes. Full slice acceptance
still requires move/insert/replace/retime/duplicate and ripple.

Final independent Codex review found no actionable defects after the selected-member
fix and right-label support. A separate exhaustive probe checked 1,326 small
retimed splits and all 12,376 integer project samples without a mapping change.
Attachment traversal and linked-group expansion visit each edge/group once.


## Removal and trim checkpoint

[36 tests](../assets/03-edits/removal/tests.txt) verify range unions, full deletion,
selected-only removal with untouched counterpart samples, attachment restriction
and deletion, repeated deletion, and 595 small retimed range cases. Trimming
expands into the two removed project windows around its kept interval; linked
members outside those windows remain untouched. The same partition owner handles
split, removal and trim, preserving original source mapping and left-survivor IDs.

Requests and selected intervals are merged before intersection; the reducer does
not materialize their Cartesian product. Batch identities remain occupied after
deletion, preventing delete/add from reusing an occurrence identity; the
[regression](../assets/03-edits/removal/identity-reuse-red.txt) failed before this
fix. Independent review found no actionable defects in the removal/trim logic;
type checks, build and the previous split grid pass. Ripple is currently explicitly
`none`; explicit ripple tracks and move/insert/replace/retime/duplicate remain open.
