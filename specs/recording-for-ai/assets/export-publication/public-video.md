# Public video export composition

The bundled app composes the same recording export owner used by CLI and MCP.
Creation pins a revision before destination validation; a repeated export UUID
replays that intent. Video and processed-package are the only format identities.
Until the package producer exists, package creation fails before reserving work.

The shared queue owns waiting dependencies, execution and recovery. Service startup
and capacity events admit reconciliation; status reads only metadata. Source cleanup
respects active export pins. Storage includes private export bytes, deletion and
abandonment drain their owners, and completed external files stay untouched.

A commit's output path is the canonical destination recorded at publication. It is
historical information, not a claim that the user has left the file at that path.
Moving a completed movie does not cause retry to recreate it.

## Destination admission lifetime

Destination validation precedes queue admission and can outlive a disconnect.
Export shutdown fences new creates, cancels that validation, and drains it before
catalog closure. The existing native worker carries cancellation; no new scheduler
or deadline owner is introduced. A held validation reproduced early close in the
[negative control](admission-red.txt); the [fixed owner](admission-green.txt) waits
for release and leaves no intent or destination file.

## Startup ordering

Deferred admission is installed only after cache reconciliation settles. A published
preview can otherwise be valid on disk but temporarily unavailable to the cache
reader, turning a persisted waiting export into a failed job. Independent Codex
review found this ordering gap; the actual bundled startup reproduces it in the
[negative test](startup-red.txt), then [passes](startup-green.txt) after gating admission.
Persisted runnable video jobs also await reconciliation. Recovery-only jobs remain
independent so cache failure cannot hide a file already committed externally.

## Verification scope

The actual bundled-app journey creates through CLI and polls through MCP, cuts the
recording concurrently, independently decodes the exported duration, and compares
source/output hashes. It exercises lost-response replay, changed-format conflict,
existing-destination preservation, cancellation/abandonment, storage removal,
restart after moving the output, historical retry and recording deletion.

Disabling the bundled service's export dispatch produces the expected
[failed export](dispatch-red.txt); restoring the dispatch makes the journey pass.
The combined [native suite](public-native.txt) passes 45 checks, including the
bundled package-reader neighbor. [Core checks](public-core.txt) pass 317 with four
workers, [CLI checks](public-cli.txt) pass 21 and [protocol checks](public-protocol.txt)
pass 11. The [service suite](public-service.txt) passes 99. Build, type checks, touched-file lint/format and documentation links pass.
The initial default-parallel core run exceeded the unchanged five-second limit in
[two I/O-heavy cases](public-core-initial-timeouts.txt); a core-only retry still
[timed out in one](public-core-isolated-timeout.txt). Four workers passed all cases
without changing tests or thresholds. This is bounded-worker evidence, not a claim
that the default parallel runner is free of host-load sensitivity. A run overlapping
the format-schema merge used stale build output and is excluded from integration
proof; the fresh build supplies the reported result.

Independent Codex review reported the cache-startup ordering bug above. Its actual
bundled regression goes red before the fix and green after it. Local shape review
keeps all publication policy in RecordingExports/Publication, with thin shared
operation dispatch and no new scheduler or export table. Documentation points to
those owners, and the choices ledger records lifecycle and output-path semantics.
 This does not close physical menu interaction, power-loss durability,
narrated exports, complete package writing or installed-copy acceptance.
