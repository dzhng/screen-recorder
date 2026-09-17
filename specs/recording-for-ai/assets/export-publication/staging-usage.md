# Private export storage accounting

The export owner attributes pending private files to their recording, even though
staging lives beside a user-selected external destination. `RecordingStorage` joins
that observation to its existing recording/global totals as `otherBytes`. Its existing
request coalescing, cancellation and shutdown drain also cover the export observation.
This is internally integrated; the app-managed service has not yet wired exports.

`Publication.usage` reads metadata through an identity-checked directory descriptor
without taking the writer's exclusive lock. Partial preparation therefore remains
measurable during a live export. Only the native publication owner's fixed disposable
file set is examined. It never opens the external movie or follows payload links.
Totals are live logical file lengths, not an atomic snapshot or physical allocation.

The payload is excluded when durable commit truth exists or its native link count
shows the extra link created by publication. That second case covers a process dying
between creating the external file and recording its receipt. This observation does
not authorize success, retry or cleanup: those still require the existing publication
receipt and recovery owner. Private receipt metadata remains counted until cleanup.

Confirmed acknowledgement/discard records `stagingCleared` while retaining the
original directory identity for future retirement. A partial index keeps cleared
history out of the scan. Storage reads therefore do not revisit an unavailable or
moved destination once its private bytes have been confirmed gone. Lost cleanup
acknowledgement remains measurable; a disappeared stage contributes zero only after
absence is confirmed beneath the original destination identity. Replacement fails.

## Evidence

The host build passes all eight tasks. All 44 publication/export native-service tests
and 79 focused core storage/jobs/library tests pass. Four new composed-owner tests
cover recording/global attribution, failed exports, cleared destination relocation,
replacement, and shutdown drain. Existing actual process-crash coverage now also
checks storage before reconciling the commit-before-catalog gap. Primitive tests
cover partial growth, symlink rejection and a sparse file above 32-bit length.

- [Native/export receipt](export-storage-native.txt)
- [Core receipt](export-storage-core.txt)
- [Initial missing-owner failure](export-storage-red.txt)
- [Commit-link negative control](export-storage-mutation-red.txt)
- [Restored crash-gap test](export-storage-restored-green.txt)

Independent review found the initial composed implementation counted committed
payload hard links. The native link-count observation and durable commit input fix
that defect; final review found no actionable issue. Reviewer native execution was
blocked by sandbox/toolchain cache access, so host runs supply that verification.
Types and touched-file lint pass. Shape review kept measurement and cleanup under
Publication, aggregation under RecordingStorage, and intent selection under exports.

## Remaining integration

Service composition must pass the export usage callback and preserve storage shutdown
before catalog close. Queued startup reconciliation, abandonment, size-appropriate
publication deadlines and public CLI/MCP/menu exports remain separate gates. Empty
private directories retain their identity until the existing retirement path removes
them; this byte-accounting marker does not claim directory retirement. Package
reservations remain distinct from observed file lengths.
