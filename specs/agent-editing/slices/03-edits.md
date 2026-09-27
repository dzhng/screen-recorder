# 03 — Structural edits and attachments

Status: in progress; batch foundation, splitting, removal, trim, explicit removal ripple and non-ripple move verified. Dependencies: [01](./01-composition.md), [03a](./03a-exact-edit-boundaries.md).

## Contract

A deterministic batch performs structural edits, linked/independent changes and attachment propagation with no partial document on failure.

## Seam and ownership

`applyBatch(document, operations, identityContext)` in composition returns the next document, normalized expansion, created IDs, clip lineage, removed attachments and link changes, or one typed error. Implement the operations table in contracts.md.

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
type checks, build and the previous split grid pass. Move/insert/replace/retime/duplicate remain open.


## Ripple checkpoint

[41 composition tests](../assets/03-edits/ripple/tests.txt) pass, including 595
retimed ripple cases. The named root tracks shift once; attached descendants
inherit that displacement. Child-only scopes and unequal linked displacements
reject with stable track information. Unaddressed content crossing a collapsed
window rejects instead of being silently trimmed. Fixed project overlays remain
unchanged and are listed for review.

Explicit ranges collapse their union, including empty project time, provided at
least one addressed occurrence exists. Whole-occurrence removal collapses the
selected occupied envelope union. An entirely absent selection is a no-op; its
[regression](../assets/03-edits/ripple/absent-target-red.txt) failed until ripple
windows were suppressed. Final independent Codex review found no actionable
defects; package type checks and build pass. Exact time serialization and domain
errors have one shared owner for partitioning and displacement.


## Move checkpoint

A move places the earliest start of the expanded selection at `atUs` and applies
one exact displacement. Descendants keep their anchors when their parent moves;
a child moved alone updates its existing anchor within the parent interval.
Source selection and duration remain unchanged. Selected moves retain links
within both moving and stationary subsets; a zero displacement preserves links.
The stationary subgroup keeps the original identity when both survive.

[44 composition tests](../assets/03-edits/move/tests.txt), type checks and build
pass. The [subset regression](../assets/03-edits/move/subset-red.txt) failed when
moving members lost their mutual link. Independent Codex review found no
actionable defects. The graph closure is shared with partitioning, avoiding two
owners for attachment and link expansion. This checkpoint accepts only explicit
`ripple: none`; insertion/ripple move, destination track changes and explicit
reanchoring remain required, along with replace/retime/duplicate.


## Anchor and destination checkpoint

Detach stores the exact resolved project interval, including fractional boundaries,
without changing source selection, links or descendants. Reanchor changes the
dependency while requiring the same project interval; moving and retiming stay
explicit operations. Move accepts named destination tracks only for its expanded
selection, with normal model validation for stream kind and overlap. A track-only
move does not unlink synchronized media.

[46 tests](../assets/03-edits/anchors/tests.txt), type checking and build pass.
Restoring both edited implementation files to the previous checkpoint makes only
the [two new behavioral tests fail](../assets/03-edits/anchors/red.txt). Independent
Codex review found no actionable defects. Ripple move, insert, replace, retime
and duplicate remain open.


## Duplicate checkpoint

Duplication gives selected occurrences and descendants new identities. Explicit
linked scope also copies synchronized counterparts. Copied roots use the requested
project destination; copied internal anchors point to copied parents. Sources,
original occurrences and their synchronization groups remain unchanged. Optional
track destinations and copy labels support overlay placement and later edits in
the same batch. `clipLineage` now covers both partitions and copies; it reports
origin relationships, not an instruction to delete the original.

[48 tests](../assets/03-edits/duplicate/tests.txt), type checks and build pass;
the [initial tests](../assets/03-edits/duplicate/red.txt) failed before the operation
existed. Independent review found no actionable defects and additionally probed
fractional destinations, group copies, rejected destinations and failed-batch
immutability. Relocation shares one exact mapping owner with move.
