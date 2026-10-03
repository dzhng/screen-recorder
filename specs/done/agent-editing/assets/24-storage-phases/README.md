# Storage inventory phase diagnostic

The unchanged five-second inventory test passed a baseline and two concurrent
instances. [Measured phases](report.json) separate setup (including350 durable
reservations and700 file writes) from the contained scan. Baseline total was
302.68ms; concurrent totals were357.75–359.90ms. Most added time appeared in setup;
scan durations remained141.53–146.76ms, with thousands of sibling catalog reads
progressing. Reservation time is a subset of setup, not an additional phase.

This bounded result does **not** reproduce the earlier concurrent native-build
failure, explain its cause, or establish general load immunity. No production
optimization, deadline change or fixture reduction follows. The original failure
remains recorded in the integration evidence and the parent scale gate remains
open. No additional load combinations were tried.

[evidence.tar.xz](evidence.tar.xz) contains the original test, temporary instrumented
copy, phase JSON and all logs. The first three passing runs lost their console
timing to reporter suppression; they are preserved separately. The same baseline
and pair were repeated with post-assertion scratch-file output. The instrumentation
only adds clocks around the original operations and writes the final measurements;
all assertions and the default deadline remain unchanged. The repository test was
restored byte-for-byte afterward. Observer overhead was not separately measured.

Each process used its own ordinary scratch library. No model/native build,
installed state, capture or active library cleanup was involved. The named test
is `large file and reservation inventories yield while unrelated catalog reads
keep working` in `packages/core/src/storage.test.ts`, invoked with
`--maxWorkers=1`; the pair was launched concurrently in separate processes.
