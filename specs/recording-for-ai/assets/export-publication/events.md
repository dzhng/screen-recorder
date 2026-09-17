# Portable timeline events

The [event-page owner](../../../../packages/core/src/event-pages.ts) serializes
pinned source and scene evidence through the shared timeline projection. It
retains pause markers at either retained boundary, omits markers wholly inside
removed footage, and emits explicit cuts. Capture interruption comes from the
pinned capture state; a completed recording does not acquire an interruption
merely because it ends.

Each portable row carries its playback position and ordinal. Equal-position rows
form one logical event group and may cross a page boundary; readers continue by
ordinal and coalesce adjacent rows with the same playback position. Journal
sequence orders simultaneous pause and geometry events. Scene and interruption
markers follow journal markers at the same source position; cuts retain the
existing timeline owner's tie behavior. No complete event-group array is needed.

Metadata pins the source and scene identities, full validated revision and capture
interruption flag. Writer and reader use the same projection of trusted identity
arguments, so callers may pass full source or scene metadata; extra fields in the
untrusted portable metadata still fail exact validation. Bounded page reads validate
hashes, row shapes and canonical
projection. Before declaring a package complete, the assembler must additionally
await `validateTimelineEventPages` with its pinned source/scene readers: this
bounded comparison detects omitted, invented or reordered events. A self-consistent
hash alone cannot prove that the complete timeline was included.

Both serialization and full validation yield while consuming source evidence,
including long spans whose events are all cut away and scene pages with no visual
changes. Pages become readable only when the final metadata member is published;
cancellation leaves cleanup to the enclosing owned export workspace. Validation
also yields between output pages, including cut-only pages that consume almost no
source events. Canonical cuts are looked up by their unique source position.

The internal file reader permits up to 1,000 rows per call for bounded assembly
work. The public CLI/MCP event schema enforces the contract's maximum of 500 entries.

## Verification

The actual-store tests in [event-pages.test.ts](../../../../packages/core/src/event-pages.test.ts)
cover multiple portable source and scene pages, simultaneous journal ordering,
retained/deleted pause markers, cut boundaries, late scene markers, acquired versus
absent interruption, mismatched generations, a correctly rehashed invalid projection,
missing event pages and cancellation during a static scene scan. These generated
fixtures prove serialization semantics, not physical capture or speech fidelity.

The native retained-package fixture also writes these production pages, validates
them after moving the ZIP and deleting its original library through retained
`FileAccess`, and rejects reads after package close.

Independent review found repeated scene-page decoding and cancellation starvation
on static recordings. Reading bounded chunk batches and yielding between consumed
pages fixed both. The regression was deliberately reverted: its canceled scan read
257,616,217 bytes against a 7,648,418-byte input-derived allowance, then passed after
restoration. See [negative control](events-negative.txt). No threshold was relaxed. A fresh independent review found no actionable
regressions and independently passed all 320 core tests and the core type check.
The final host run also passed the native relocation test.

Final full-core and native relocation results are recorded in
[core](events-core.txt) and [native](events-native.txt). [Public timeline inspection](../timeline-inspection/README.md) uses the same
projection owner. Full package export assembly and narration completeness remain
separate gates.


### Cut-only validation followup

A small actual-store fixture with two source markers, two static scene chunks and
300 cuts showed that cancellation scheduled with `setImmediate` could lose to a
validation loop containing only microtask waits. The original reader resolved
successfully instead of rejecting; yielding between validated pages makes that
same test reject and leaves a subsequent uncanceled validation successful.
[Red](events-cut-cancel-red.txt) and [focused green](events-cut-cancel-green.txt)
record the result. Thirteen event/timeline tests and the core type check passed;
unchanged broad native/core suites were not repeated for this followup.

A separate 3,000-cut probe took 2.68 seconds with repeated linear cut lookup and
179 milliseconds with exact lookup by unique source position. Those single-run
figures illustrate the measured problem, not a timing gate. The lookup still
compares the complete projected row. The tests now pass full source/scene metadata
through both writer and reader; removing trusted-input normalization reproduces
rejection, while extra fields in on-disk metadata remain rejected.

Review of the followup kept projection math, page format and public contracts
unchanged. It resolves the existing bounded-work and identity contracts and adds
no new product choice, scheduler, table or policy.
