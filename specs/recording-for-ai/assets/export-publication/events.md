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
interruption flag. Bounded page reads validate hashes, row shapes and canonical
projection. Before declaring a package complete, the assembler must additionally
await `validateTimelineEventPages` with its pinned source/scene readers: this
bounded comparison detects omitted, invented or reordered events. A self-consistent
hash alone cannot prove that the complete timeline was included.

Both serialization and full validation yield while consuming source evidence,
including long spans whose events are all cut away and scene pages with no visual
changes. Pages become readable only when the final metadata member is published;
cancellation leaves cleanup to the enclosing owned export workspace.

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
[core](events-core.txt) and [native](events-native.txt). Full package export assembly,
public timeline operations and narration completeness remain separate gates.
