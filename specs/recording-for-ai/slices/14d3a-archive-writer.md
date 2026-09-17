# 14d3a — Descriptor-owned ZIP byte producer

The [archive writer](../../../apps/service/src/archive-write.ts) produces private
ZIP bytes for the existing Publication owner. It does not select prerequisites,
certify transcript readiness or create another export lifecycle. Package creation
remains unsupported until the complete consumer is connected.

## Ownership and bounds

The caller lends private input and scratch directory descriptors and a regular
member-plan descriptor through the native worker lifetime. The plan contains only
selected relative names, expected sizes, SHA-256 hashes and file identities; it is
bounded by the existing archive metadata budget. A file carries the plan because
the supported package manifest can exceed the control wire's request-frame limit.
The caller must register workspace identities before writing any data. Durable
scratch registration, accounting and cleanup through export deletion remain part
of the later assembly integration, not a capability supplied by this byte helper.

Native archive.write uses libarchive with stored ZIP entries: media is already
compressed, and avoiding another compression pass keeps resource use predictable.
It opens each selected member beneath the retained root with no-follow component
checks and verifies regular-file identity, size and hash. Only one member and a
fixed copy buffer are active at a time. Existing archive byte/name/entry limits
apply to observed work, including ZIP container overhead. The metadata plan is
bounded in memory; media is streamed.

Output is an exclusive payload.zip in previously admitted empty scratch. Returned
bytes are opened through IdentifiedFiles and lent directly to Publication.prepare.
The existing no-clobber commit controls all external publication. Input directories
and scratch remain locked through inherited open-file descriptions. Killing the
service does not authorize cleanup while a native writer still owns those locks.
Cancellation waits for worker exit before private cleanup. Missing, substituted or
unsafe workspaces fail; a moved locator cannot redirect cleanup to its replacement.

The byte deadline now lives with Publication and is shared by video copying and
ZIP writing. Its formula is unchanged and uses admitted input byte totals, checked
again against the actual plan. No second timer or queue owner is added.

## Evidence and limits of the claim

The writer test fixture drives native writing, Publication and the independent ZIP
reader. Focused faults cover same-byte inode substitution, expected-hash mismatch,
mutation during a stopped pread, symlink ancestors, destination-locator replacement,
output budgets, entry/name bounds, canceled partial copying and actual service
SIGKILL with a surviving stopped native worker. Cleanup is fenced until that worker
exits. A generated 128 MiB member is streamed below a 96 MiB native peak-resident
bound. Removing the member digest comparison makes its regression fail; restoring
it passes.

The existing generated retained-package relocation test now uses this producer
and Publication instead of an external ZIP command. It compares actual frame
pixels, retained screenshots, history, scene/coverage data and audio bytes after
relocation with the original library unavailable. The assembly supplying that test
is still a generated fixture, including its event construction. This verifies the
byte producer and reader, not production package prerequisite selection, durable
scratch registration or narrated completeness. Those remain explicit gates in
[the package plan](14d3-processed-package.md).

Verification receipts: [113 native writer/video/reader/publication cases](../assets/export-publication/zip-writer-native.txt),
[generated media relocation](../assets/export-publication/zip-writer-relocation.txt),
[19 manifest/deadline/worker checks](../assets/export-publication/zip-writer-unit.txt),
and the digest mutation [red](../assets/export-publication/zip-writer-hash-red.txt)/[green](../assets/export-publication/zip-writer-hash-green.txt).
Fresh core/service/native builds, service types, lint and format passed. Independent
Codex review found no actionable defects and passed types, deadline and nine writer
cases; its two process-barrier cases were blocked by sandbox access to ps. The
host native receipt above is the authority for those process tests.

## Root integration

Merged with the public video lifecycle, including destination-admission shutdown
and cache-before-dependency startup ordering. Fresh bundle build and type checks
pass; [56 combined native checks](../assets/export-publication/zip-integrated-native.txt)
cover writer, video owner, actual bundled exports and retained package relocation.
The [8 shared publication-budget/worker checks](../assets/export-publication/zip-integrated-unit.txt)
also pass. The shared deadline moved without changing its formula. These integration
checks preserve the producer-versus-complete-consumer boundary above.
