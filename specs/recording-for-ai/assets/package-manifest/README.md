# Pinned package metadata checkpoint

[The core module](../../../../packages/core/src/package-manifest.ts) owns structural
manifest validation and prerequisite planning. The catalog captures revision and
history boundary together; the timeline owner validates supplied revision contents
using the same constructors as live editing.

[Generated examples](examples.json) demonstrate no-narration metadata and waiting
speech alongside an old revision with all history known at admission. These are
metadata fixtures, not exported packages or accepted speech. Ready transcript
reports can be modeled by the planner, but manifest validation rejects narrated
packages until the accepted transcript payload owner exists. Unknown acquisition
waits for source evidence and cannot silently become no-narration.

The validator checks references, roles, durations, time domains, path collisions,
canonical revision contents and required finite metadata limits. It does not open
files, verify their actual hashes, parse evidence payloads or claim ZIP containment.
Source names match the existing capture layout; inventory names are ASCII so case
and Unicode normalization cannot create ambiguous extraction paths. Policy IDs and
numeric/boolean options are retained metadata; executing supported policies remains
the inspection owner's responsibility.

Run `bun run --cwd packages/core test src/package-manifest.test.ts`.
Set `SCREENREC_PACKAGE_MANIFEST_EVIDENCE` to a new JSON file path to emit the internal
fixture report. No public operation or native process is introduced. The tests use
real catalog paging, cover absent/pending/failed narration, reject stale identity
and generation, and exercise malformed history, references, paths and size limits.

Mutation checks reproduced failures when the history cursor used the selected
revision's ordinal, when stale generations were accepted, and when the narrated
manifest guard was removed. Independent review also found two gaps: an unknown
acquisition hid another required dependency's failure, and a file could occupy the
`revisions` root itself. Both have reproduced red/green regression tests.
