# 14c1 — Bounded archive extraction transaction

Status: internal extraction implemented and reviewed; evidence below. This proves
container enumeration, containment, hashes and existing 14a manifest/history rules.
It does not certify media/evidence payload semantics, expose a package handle, or
close parent 14c. Generated fixture payloads are deliberately not playable media.

## One owner and a concrete lifetime

[verifyPackageArchive](../../../apps/service/src/package-archive.ts) receives an
absolute no-symlink archive path, an already-open empty private workspace directory
FileHandle, the existing native worker and optional cancellation/limits/deadline.
The caller owns that directory exclusively and keeps its handle open until the
promise settles. Provisioning a package-cache directory and crash recovery remain
with the later retained-context owner; this pass never invents library rows.

Preparation validates device/inode identity, owner/mode and emptiness, then takes an
advisory exclusive lock on the inherited FD. The parent retains the same open-file
description, so the lock and cleanup authority survive preparation/extraction child
exit. A second independent open cannot claim the workspace. Calls on one owned
FileHandle are serialized by its caller; the lock is not protection against the
owner starting two operations on its own shared descriptor.

[mediaWorker](../../../apps/service/src/worker.ts) passes `descriptors` into child
FDs 3 onward and retains its existing close-before-settle behavior. Extraction
inherits the workspace at FD 3 and returns one bounded receipt, including manifest
and revision bytes. Core's [receipt verifier](../../../packages/core/src/package-archive.ts)
uses the existing manifest/history validators plus exact observed inventory/hash
comparison. No native FD must survive solely for core JSON parsing, and no staging
pathname is reopened for verification.

After extraction success, parser failure, validation failure or cancellation,
cleanup inherits the **same parent-retained FD** in another bounded worker. The
parser is already reaped, including SIGKILL, before cleanup starts. The promise
resolves only after cleanup empties the workspace; its root remains caller-owned.
A failed preparation never clears a directory it could not admit empty. A cleanup
failure returns `ARCHIVE_CLEANUP_FAILED`, preserving both operation and cleanup
messages; the owner retains the handle for recovery. Parent-process death and
persistent startup reclamation are later context-lifetime work, not success cases.

## Filesystem and decoding policy

[ArchiveOperation](../../../helpers/mac/Sources/ScreenRecorderWire/ArchiveOperation.swift)
uses system libarchive's seekable ZIP reader only, with `zip:mac-ext` disabled so
resource-fork entries remain visible. Its minimal C binding vendors licensed,
unmodified upstream 3.7.4 public headers and links the SDK's `archive.2` stub; the
SDK has no archive headers. No Homebrew runtime, bundled library, shell extraction
or handwritten parser is used. Receipts record the actual runtime version.

The native owner opens the input without following ancestor symlinks, copies it
through that FD into an exclusive bounded snapshot, and hashes those copied bytes.
Replacing the input pathname cannot switch the opened source. Concurrent in-place
writes may yield an invalid snapshot; this does not promise an atomic snapshot of
an external file. Parsing and extraction operate on the private copied bytes.

Names are the parser's **effective decoded names**, then restricted to ASCII
relative components. A safe Unicode-path override may represent an inventoried
ASCII member. Raw encoding purity is not required: NUL/Unicode aliases cannot
bypass full enumeration, duplicate/case collision checks, exact inventory or SHA.
Traversal, absolute/backslash/empty components, links, special/sparse/encrypted
entries and file/directory collisions fail. Explicit directories must be empty
canonical ancestors of inventoried files. Every member is streamed, including any
tail after all expected files; parser warnings/errors and CRC failures reject.
Manifest is the sole inventory exception and cannot inventory itself.

All directory traversal/file creation uses pinned directory FDs with no-follow and
exclusive file creation. Permissions are fixed (0700 directories, 0600 files);
archive permissions, extended attributes and timestamps are never restored.
[ManagedFiles](../../../helpers/mac/Sources/ScreenRecorderWire/ManagedFiles.swift)
owns shared directory locking, identity and recursive cleanup primitives. Cleanup
never removes the caller's root by pathname. It does not claim stat+unlink is
atomic against a hostile same-UID process replacing every syscall target. The
threat model is hostile archive content, cooperating service ownership, and
controlled ancestor/member replacement: replacements are never followed and
observed ownership loss fails explicitly. Arbitrary same-UID memory/FD mutation
is outside this boundary.

## Resource policy

The [core limit owner](../../../packages/core/src/package-archive.ts) defines
independently enforced maxima: 16 GiB compressed/expanded, 8 GiB/member, 25,000
entries, 512-byte paths, 128-byte components, depth 16, 1,000 history records,
2 MiB manifest, 1 MiB aggregate revisions, and 7 MiB encoded receipt. The metadata
limits were reduced from the draft to fit the existing 8 MiB transport; no new
streaming protocol is needed. Lower limits can be injected for focused tests.

A 64 KiB buffer bounds each copy/decode step; actual bytes count before writing.
All read-callback bytes, including rereads, are capped at 8 MiB until the first
header because libarchive eagerly allocates central-directory state. Entry checks
alone would occur too late. The parser never receives a byte beyond that initial
budget. Deadline defaults to 30 minutes as a safety bound, not a performance SLA;
cleanup has its own 30-second deadline and ignores the canceled extraction signal.

## Verification and continuation

Run `swift build --package-path helpers/mac --product screenrec-native`, build
core/protocol/service, then `bun run --cwd packages/test-harness lab:package-archive`.
`SCREENREC_NATIVE` can select another built worker; `SCREENREC_ARCHIVE_EVIDENCE`
records compact receipts. No devices, recordings or models are used. The native
fixture uses Python's ZIP writer with test-only header mutations.

[Extraction evidence](../assets/portable-inspection/archive-extraction.md) records
real malformed tails, undercounts, metadata aliases, CRC/hash errors, exact limits,
RSS, input/ancestor/member replacements, lock exclusion, SIGSTOP→kill cleanup,
write faults and explicit cleanup failure/recovery. Tail and no-follow mutations
must fail. Keep manifest/history, worker and ManagedFiles deletion suites green.
No visual surface changes; review is the bounded native receipt/error matrix.

Next [14c2](14c2-retained-package-inspection.md) retains the same extracted content under an owned context and promotes
this extraction/validation flow rather than adding a second verifier. It must pin
read-time traversal and native media lifetimes: current OrderedPages/retained-image
leaf-only O_NOFOLLOW and a prior root check do not protect ancestor replacement.
Then add cache/jobs/leases, close/drain/revocation, startup recovery and public
open/close with parent 14c's same-UUID isolation and relocated-media parity gates.
Narrated manifests remain blocked by the accepted 08 payload-validator dependency.
