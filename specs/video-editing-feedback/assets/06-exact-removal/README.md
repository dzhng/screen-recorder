# Exact removal checkpoint

`remove.ranges` now consumes the existing exact selection contract. Partition,
ripple, source projection and processing already retained rational coordinates;
the input admission was the missing link. Other structural point controls keep
their existing integer contracts.

The [persisted-owner tests](../../../../packages/core/src/exact-removal.test.ts)
exercise actual project transactions, revisions, replay and undo. Only native
probe admission is supplied as an external boundary control; these stream/font
controls are never decoded. Source-byte identities and the accepted request,
returned revision, compiled joined frame and caption support are retained in
[receipt.json](receipt.json). Caption support remains exact before sidecar
serialization rounds outward to milliseconds.

Run the focused checkpoint from the repository root:

```sh
bun run --cwd packages/composition build
bun run --cwd packages/core test src/exact-removal.test.ts
```

Set `YAP_EXACT_REMOVAL_RECEIPT` to an absolute writable JSON file to retain another
accepted receipt. The test file owns the case names and independent expected
endpoints; this document does not duplicate their oracle.

## Verdict

The 24fps tracer failed before the schema change with `INVALID_PARAMS`: exact
endpoints were rejected as objects where numbers were required. The shared exact
selection schema earned green without changing partition, ripple or compilation.
The first tracer proves two-times retimed source endpoints, linked A/V,
content-attached text, original opacity phase at the joined picture, restart,
replay and undo. Further checks cover exact adjacent/overlapping 30000/1001 frame
union and atomic refusal of synchronization loss and malformed intervals.

Focused verification passed on 2026-10-05: the three persisted-owner tests,
152 existing composition tests across edits, source projection, processing state
and temporal geometry, and composition/core type checks. No native render,
inference or full suite ran; this change adds no native lowering. The final
real-media gate remains in slice 34.

Review found one existing owner for exact ranges and no new mechanism, storage
format, dependency or compatibility bridge. The [decision ledger](../../choices.md)
records the verification boundary. Independent read-only Codex review found no actionable defects. Its type
checks and lint passed; its Vitest attempt was refused by sandbox filesystem
permissions. The successful focused runs above were executed outside that
reviewer sandbox.
