# Deferred native pause markers

Date: 2026-09-16. Generated clock/journal fixtures; no screen or audio capture.

## Contract and fix

A first video frame can arrive after pause/resume controls while still carrying a
valid timestamp before those controls. Its media clock removed the paused interval,
but the earlier journal resume could not name a source boundary before source zero
was known. An AI reading normalized evidence therefore lacked the required pause
placeholder.

The native clock now places completed intervals once when origin becomes known,
using the same excluded-time arithmetic as media. Intervals wholly before origin
remain unplaced prologue observations because retained source time never crosses
them. Existing valid delayed media is retained. The writer journals source zero
and each resulting marker before appending that frame's media.

`pausePlaced` is a new internal journal event with the existing PauseEvent payload.
It records timing without pretending another resume occurred, so a newer open pause
survives recovery. Ordinary already-origin resumes still carry their marker in
`pauseEnded`. The parser validates and streams both to the existing normalized
`pause` event. No public schema, TypeScript mapping, retrospective journal rewrite,
or whole-journal collection is introduced. Old journals missing these events remain
incomplete evidence; the exporter does not invent replacements.

## Verification

The initial regression failed: a delayed first frame established source zero and
media time correctly excluded a pause, but `clock.pauses` was empty. It passes after
the acquisition-owner correction.

Three generated fixtures place origin before, between and after two completed
pauses, with a third pause still open. Their independently expected marker pairs
(source boundary, elapsed duration) are [(50,100),(150,200)], [(50,200)] and [].
The corresponding media-clock coordinates at host 600 are 250, 150 and 50. Recovery,
streaming and actual normalized-file export reproduce the same marker values
exactly once; source journals remain byte-identical after export. Repeated origin
and resume calls add no duplicates. Completing the open pause adds one ordinary
marker, and no deferred marker clears it early.

The full native capture executable passes its clock, cursor, journal and generated
media recovery checks; native debug build passes. All 15 source-evidence/recovery
wire tests pass, including malformed deferred markers retaining the trusted prefix
and open-pause state. A 100,000-marker worker export stays below the existing 128 MiB
budget at 22,167,552 bytes peak RSS, returns a receipt under 2 KiB, and preserves the
first and last normalized marker values. Export streams each bounded event; only
the capture clock's existing interval/marker collections grow with actual controls.

Independent Codex review found no actionable defects in the changed and new files;
its test execution was blocked by Swift toolchain/sandbox errors. The checks above
ran successfully outside that review sandbox. Shape review kept the clock and
journal parser as the only timing owners, and the doc pass removed the stale
remaining-edge claim from the geometry evidence.

These are generated timing and journaling proofs, not a physical capture or
power-loss durability claim.

Root integration at 03da965: rebuilt app/type checks, full Swift capture fixture
executable and all 15 source-evidence/recovery wire tests pass. The real own-window
clean-frame/CLI/MCP test and generated public source-timing test also pass after
the clock and journal changes. This adds no physical microphone, display/region
or power-loss claim.
