# 03 — Structural edits and attachments

Status: accepted for pure structural editing. [Integration evidence](../assets/03-edits/integration/README.md), 69 tests and prior focused reviews pass. Dependencies: [01](./01-composition.md), [03a](./03a-exact-edit-boundaries.md).

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

## Current implementation evidence

The [pure reducer](../../../packages/composition/src/edits.ts) validates each
operation before returning an immutable next document. Batch labels and supplied
identity namespaces make expansion replayable. The receipt reports net change,
created identities, clip lineage, link changes and removed/fixed attachments.
`clipLineage` covers partitioning, copying and replacement expansion; it describes origin
relationships without implying that the original was deleted.

Partitioning shares one owner for split/remove/trim and attachment rebasing.
Move, duplication and retime share the exact project-time transform.
Duplication gives copies new identities and preserves their internal dependencies;
move/retime retain existing attachment kinds. Detach and reanchor preserve the
resolved interval. Pitch policy is authored metadata until native retiming lands.
The [contracts](../contracts.md) own operation semantics and scope rules.

[69 composition tests](../assets/03-edits/padding/review.md), type checks and build
pass. The suite includes linked offsets, held/content anchors, source gaps,
selected subgroups, copy labels, fractional boundaries, no-ops and failed-batch
immutability. Prior independent probes cover 1,326 retimed splits and 12,376
source queries; removal and ripple each cover 595 small exact cases; insertion covers 756.

Independent reviews identified and verified fixes for selected-member links,
missing-ID ripple, retained subgroup links and an incorrect gap-test expectation.
Regression evidence is retained with [split](../assets/03-edits/split/tests.txt),
[removal](../assets/03-edits/removal/tests.txt), [ripple](../assets/03-edits/ripple/tests.txt),
[move](../assets/03-edits/move/tests.txt), [anchors](../assets/03-edits/anchors/tests.txt),
[duplicate](../assets/03-edits/duplicate/tests.txt) and
[retime](../assets/03-edits/retime/tests.txt).

Insertion partitions linked clips and attachments at the boundary, then opens
project time on named roots through the same ripple owner used by removal. Fixed
project clips on unnamed tracks stay fixed and are reported. Child-only scopes
and scopes breaking synchronization reject. A same-batch place fills the opened
gap. Independent review and additional probes found no actionable defects;
[red evidence](../assets/03-edits/insert/red.txt) predates the operation.

Ripple retime shifts later roots by the duration change and excludes the
already-transformed target roots from that shift. Target root tracks must be
included explicitly. An attached target without its root must be detached first;
unaddressed content crossing the old end rejects. Both growth and shrinkage are
verified, including independent fractional-adjacency and failed-input probes.
[Initial red evidence](../assets/03-edits/ripple-retime/red.txt) precedes support;
independent review found no actionable defects.

[Ripple move](../assets/03-edits/ripple-move/review.md) combines closure and insertion
before judging overlap or synchronization. It maps the destination back to the
original timeline for exact splitting, then applies one displacement per root.
Regression tests retain temporary-overlap and temporary-link failures; invalid
final states still reject. Additional grids check integer and fractional source
preservation. Normal model validation remains unchanged.

[Interval-preserving replacement](../assets/03-edits/replacement/review.md)
retains the occurrence identity and unchanged linked media. Source changes remove
old descendants; identical source replacement preserves them. Source admission
and bounds validate before explicit trim/stretch fitting. Independent review
caught and verified the source-end validation regression.

Ripple replacement reuses the retime owner to adopt the source duration and
shift later named roots; its [review](../assets/03-edits/replacement/ripple-review.md)
verifies independent audio/video behavior.

[Authored silence](../assets/03-edits/silence/review.md) is an asset-free audio
occurrence with ordinary identity, placement and edit behavior. It preserves
project duration without fabricating captured-source evidence. Independent review
and the existing media corpus gate pass.

[Padding expansion](../assets/03-edits/padding/review.md) preserves the target
interval through linked media/tail pieces and shares exact placement construction
with partitioning and transforms. Independent review verified the existing-group
identity fix; 420 additional fits/retimes preserve their envelopes and source maps.

The full [linked-replacement probe](../assets/03-edits/integration/README.md) passes.
Processing lifecycle belongs to 03c; public storage and commands remain in 04.
