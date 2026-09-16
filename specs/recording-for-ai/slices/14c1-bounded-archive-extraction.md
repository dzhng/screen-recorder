# 14c1 — Bounded archive extraction transaction

Status: feasibility gate planned, tiny parser probes completed; no production extractor,
package handle or accepted hostile-archive boundary yet. Depends on 14a and 14b3.
The single verdict is whether a generated no-narration archive can be completely
verified inside a descriptor-owned transaction, or fail and clean up safely.

## One owner per concern

Core keeps `validateManifest`, revision/history validation and exact inventory
comparison. Native code owns ZIP decoding, CRC checks, actual byte counts, SHA-256,
and filesystem descriptors. Use the system libarchive **seekable ZIP reader only**
through a minimal SwiftPM C system module (pinned upstream public headers and
license, system `archive.2` linker library, no Homebrew runtime dependency); no handwritten ZIP parser, pathname extraction,
second manifest validator, library catalog or new inspection engine. This is the
selected implementation candidate, conditional on the acceptance tests below;
[parser research](../assets/portable-inspection/archive-candidate.md) records why.

The internal core seam is `verifyPackageArchive(input, options): Promise<Receipt>`.
Input supplies the archive path and expected owned cache-root identity; options
carry cancellation and explicit limits. Receipt contains the validated manifest,
selected revision/history identities, inventory count/bytes and archive digest,
**not** a usable staging path or package handle. Resolving means verification and
cleanup both finished. A cleanup error must never be reported as success.

The target shape is a one-shot native worker emitting bounded inventory plus
manifest/revision bytes after complete extraction and cleanup. Core validates that
immutable receipt with its existing owners; it does not need native descriptors
alive after the response. Never return a staging path and reopen it for core
validation. Limit protocol bytes independently of media bytes. This receipt-only
checkpoint proves extraction, not retained package access; 14c's retained owner
must later adopt the same extraction result before cleanup under a separately
proven FD lifetime, rather than introduce another verifier.

**Run these feasibility gates before substantial implementation:**

1. Prove name validation against embedded NUL and Unicode-path override fixtures.
   `archive_entry_pathname` is decoded and NUL-terminated; it cannot by itself
   prove the raw-name policy below. Require a supported parser signal/API, or
   explicitly revise the policy with containment/inventory evidence. No private ZIP
   scanner to repair the missing signal. Candidate selection remains conditional.
2. Prove cleanup ownership after an unresponsive parser is killed. One acceptable
   shape is an attempt owner retaining the root FD and passing it into parser and
   cleanup children; another is a native supervisor retaining the FD while its
   parser child is killed. Demonstrate actual descriptor transfer/lifetimes before
   selecting; the existing one-shot wrapper cannot retain a dead child's FDs.
   Parent/root crash recovery is a separate explicit failure case, not successful
   cleanup. Do not grow a resident service or new request protocol for this proof.
3. Resolve check-to-unlink replacement with a real ownership/exclusion contract.
   Directory FDs prevent traversal escapes, but stat then unlink is not atomic.
   Existing ManagedFiles does not establish protection against arbitrary same-UID
   mutation between those calls. Test that exact barrier and name which actors can
   mutate the private tree; do not claim a mode-0700 directory excludes same-UID
   processes. Either prove exclusion for the declared threat model or retain an
   explicit cleanup failure/remaining-directory result. Do not silently weaken the
   parent's no-external-write requirement.

These unresolved choices are the next work, not delegated implementation details.
Record their proof and settle this section before adding production extraction.

## Filesystem and parser contract

- Open the source with ancestor-aware no-follow semantics and require a regular
  file. Copy through that FD into an exclusive private snapshot under the pinned
  cache directory before parsing; charge compressed bytes while copying. This
  accepts the copied byte sequence, not an atomic snapshot of a concurrently
  modified external file. The archive digest identifies those exact copied bytes.
- Create a random private root through `mkdirat`/`openat`, mode 0700; files use
  exclusive descriptor-relative creation, mode 0600. Resolve every component
  beneath pinned directory FDs, reject symlinks, retain UInt64 device/inode
  identities, and never restore archive permissions, timestamps or extended data.
  Reuse the existing ManagedFiles descriptor/identity primitives where valid;
  settle its unlink race in the feasibility gate before promising shared cleanup.
- Disable `zip:mac-ext` so resource-fork members cannot disappear from enumeration.
  Enable no other archive formats or filters. Reject encrypted archives, links,
  sparse/special entries and unsupported entries explicitly. Accept only normal
  parser success and final EOF; warnings, retries, failed reads and CRC errors fail.
- Enumerate and fully stream **every** member, including the tail after the last
  expected manifest file. Validate raw names before normalization: ASCII relative
  slash-separated paths only, no backslashes, empty/dot/parent components, NUL,
  absolute roots or ambiguous encodings. Reject duplicate/case-fold collisions
  and file/directory conflicts before any second creation.
- Explicit directories must be zero-byte canonical ancestors of inventoried files;
  extra directories fail too. Implicit parent creation is not an archive member.
  Manifest is the sole inventory exception and cannot list/hash itself. Reject
  unlisted/missing members and mismatched actual sizes/hashes. Existing 14a still
  rejects narrated complete packages until accepted 08 payload validation exists.
- Hold file identities through core verification, and read metadata by those
  descriptors. A descriptor pins identity, not immutable contents: recheck streamed
  file size/hash before accepting if any writable lifetime remains. No reopening
  an unchecked absolute staging pathname during verification or cleanup.
- Cleanup operates on the owned tree, checks identity before unlinking its name,
  never follows replacements and never removes a foreign replacement. If a hostile
  rename makes the original directory name unreachable, empty owned contents via
  its FD and report explicit cleanup failure rather than deleting another root.

## Explicit resource policy

Defaults are admission bounds, not a throughput promise. Limits are injectable
only at the internal seam so small fixtures can test exact boundaries.

| Resource | Default |
| --- | ---: |
| Copied compressed archive / total actual expansion | 16 GiB each |
| One regular member | 8 GiB |
| Members, including explicit directories | 25,000 |
| Path / component / depth | 512 ASCII bytes / 128 bytes / 16 components |
| Manifest / aggregate revision JSON / history records | 8 MiB / 4 MiB / 1,000 |
| Parser input before first header / I/O chunk | 8 MiB / 64 KiB |

These bounds accommodate the measured 30-minute fixture's 6,459 index images plus
normalized evidence pages without assuming every long recording fits. Pass the
matching limits into the existing manifest owner. Actual reads/writes count even
when header sizes lie. Stop before exposing an over-budget chunk to the parser or
writing it; preserve the callback's limit/cancellation error even when libarchive
has no diagnostic. Libarchive eagerly reads the central directory before its first
header: meter **all callback bytes, including rereads**, from open until that first
header so entry-count checks cannot follow an unbounded metadata allocation.
Afterward enforce entry/path/actual expansion limits with fixed-size buffers.
Use a 30-minute transaction safety deadline, with prompt cooperative cancellation
and bounded process termination if native work stops responding. This is not a
performance acceptance claim. No retry loop for invalid input.

## Acceptance and runnable evidence

Add a small generated-archive harness at this seam; no capture devices or models.
Use standard fixture writers, with byte mutations only in tests. Record parser/OS
version, limits, structured result and owned process/FD cleanup. Verify:

1. Valid generated no-narration manifest, pinned old revision and complete admitted
   history: exact receipt; original input unchanged; private stage gone on return.
2. Valid expected members followed by malformed central/local tail, underreported
   entry count, aliased offsets, extra macOS metadata, corrupt CRC and inventory
   SHA: no successful receipt. A mere inventory subset match must not pass.
3. Each byte/count/path/depth limit at and over its bound, declared-size lies,
   highly compressible data and many empty central entries. Measure bounded RSS
   and cancellation while the parser reads metadata before returning any header.
4. Duplicate/case collisions, traversal, absolute/backslash/NUL paths, links,
   special/encrypted entries, extra directories and file/directory collisions.
5. Rename/replace source, cache/stage ancestors and entries at controlled barriers;
   external sentinels unchanged. Cancel, pipe EOF, parser failure, disk-write fault
   and verification rejection drain the process and remove only owned contents.
6. Keep manifest/history, ManagedFiles deletion and relocated inspection suites
   green. Mutate the tail-completion and no-follow guards separately and show red.

No visual surface is changed. Human review is the bounded receipt/error matrix.
Internal type/file names, fixture builders and C-module packaging are delegated;
new limits, owner changes or parser substitutions need a recorded rationale.

## Deliberate next boundary

14c1 always disposes the extracted tree. Later 14c must retain it with a safe read
resolver: current OrderedPages/retained-image leaf-only O_NOFOLLOW and a prior root
inode check do **not** prevent ancestor replacement. Pin every read's traversal and
native media input lifetime before exposing a context. Then integrate context-scoped
cache/jobs/leases, close/drain/revocation and public open/close; preserve all parent
14c same-UUID isolation and relocation gates. No public ZIP route ships from 14c1.
