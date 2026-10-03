# 20d — canonical publication and admission proposal

Design only, based on main d632c938 (including validated journal prefix65d31fc8).
No callback/layout activation or production edits. The20c candidate representation
is still under investigation; this proposal does not select a container-writing API.

## Owners and concrete gaps

- NativeCapture.stop owns stream shutdown, generation and CaptureTermination;
  CaptureWriter currently closes writers and records finished before returning.
  New publication must complete inside that same termination lifetime, before the
  settled report. Repeated publication must not call finishWriting again.
- MediaRecovery.inspect is currently read-only. CaptureService.reconcileStranded
  calls it without proving another native process stopped. Mutating recovery needs
  kernel ownership in addition to the service queue/generation checks.
- NewFile.publish fsyncs its file, publishes by no-clobber link (not rename), and
  checks the published inode. It does NOT sync the parent directory. Preserve that
  no-replacement property and add directory synchronization at the take publisher.
- ManagedFiles.lockPrivateDirectory already uses nonblocking flock on an admitted
  descriptor. It lives in Wire; Capture must not import Wire or extract its entire
  directory/deletion framework for this purpose.
- AcquisitionImporter.prepareImport freezes only journal and three canonical MOV
  identities. executeImport copies only journal before native source export, then
  imports media. MediaRecovery cannot guard that path. Portable acquisitions retain
  only journal/normalized evidence, and stagePortable currently trusts their normalized
  audio rows rather than re-deriving them against a canonical publication.

## One take lease; no lock-file registry

Use flock(LOCK_EX|LOCK_NB) on the already-owned schema2 journal descriptor, with
O_CLOEXEC. Hold it throughout active writing, finalization/publication and cleanup.
A recovery opens that same regular journal inode O_NOFOLLOW|O_CLOEXEC and acquires
the same exclusive lease; EWOULDBLOCK is a retryable busy result, never a poll loop.
Normal publication uses its existing live journal lease, not another open that
would conflict with itself. Process exit releases ownership automatically.

Pin the source directory descriptor and journal dev/inode. Before publication or
cleanup, ensure its directory entry still names the leased inode; hash/parse via
that inode. Replaced/renamed journal means refusal with recoverable inputs retained.
A newly created replacement inode must not let an older lease publish into the
replacement take. The source directory stays private and cooperating writers never
replace its journal. No PID files, timestamps-as-locks or stale-lock cleanup.

Missing journal means no schema2 mutation/publication and no invented empty journal.
Existing read-only diagnostics may describe surviving bytes as unverified. Packed
filenames remain excluded from media discovery. Existing schema1 recovery stays
read-only until its independently established legacy-support gate is satisfied.

CLOEXEC covers writer/recovery descriptors and any duplicates. Explicit descriptor
transport for read-only admission must not include the lease FD. Test that a child
cannot keep a dead writer's lease alive. Service serialization/generations and
existing deletion quiescence remain complementary; status alone is not the lock.

## Minimal publication record, per audio role

Choose one immutable final receipt per role, narration.publication.json and
system.publication.json. This allows one role to succeed while another retains
an unresolved candidate, and later recovery can publish the missing role without
rewriting a successful receipt. A missing receipt means unpublished audio, even if
that role's canonical filename exists. No receipt is needed to turn a failed role
into an invented empty acquired track; valid video remains independently usable.

Proposed version1 record (bounded fields, no packet/run array):

- sourceId and role; journal schema2 and its validatedPrefix {bytes,sha256}.
- Pinned packed payload {file,bytes,sha256}; file is the fixed role working name.
- acceptedFrames A, provenCommittedFrames C, representedFrames R.
- canonical {file,bytes,sha256}, complete represented PCM digest, and exact declared
  source-support digest using the shared20c verifier's specified stable encoding.
- physicalDecodeReachedCleanEOF and explicit excluded-tail reason. Cleanup eligibility
  is derived, not a persisted authoritative Boolean.

Exact64-bit counts/lengths remain canonical decimal strings. Receipt version binds
its interpretation; no generic format negotiation. Rate/channels/phase are checked
against the pinned journal track rather than assigned by a second timing owner.
Container segment internals are NOT fields in this record.20c's shared verifier
owns sample identity, exact support and digest meaning.

## Publication order and restart cases

Under the one lease, use one bounded private attempt directory per role inside the
existing take. An immutable intent pins payload identity, journal prefix, role and
candidate locator before materialization. The shared materializer writes there and
returns independently checked candidate facts. After complete PCM/support verification,
write a prepared receipt in that directory, fsync candidate/receipt and directory.

Publish canonical role.mov by the existing no-clobber link primitive, verify identity,
and fsync the source directory. Then publish the prepared receipt under its final
role.publication.json name and fsync the source directory. A canonical filename alone
never grants admission. Reuse NewFile's publish primitive; the smallest helper change
is exposing its checked staged-file publication to the capture publisher's recovery
path, not creating another atomic writer. A recovery validates its intent/candidate
identities before calling that primitive. Never replace an occupied canonical name.

Restart interpretation:

| durable boundary | action |
|---|---|
| intent only / partial candidate | preserve inputs; resume/rebuild only that owned candidate from the same pins |
| verified candidate + prepared receipt | revalidate identities/PCM/support, then publish |
| canonical linked, receipt absent | verify canonical against prepared receipt and pinned inputs; finish receipt publication, otherwise retain/refuse |
| final receipt present | revalidate receipt, canonical identity and pinned journal prefix before using it |
| receipt present, payload already removed | canonical identity/PCM/support plus pinned journal evidence must still verify; never trust receipt text alone |
| cleanup partly complete | repeat identity-checked removal of remaining owned working entries; ENOENT is success |
| conflicting canonical or receipt | no replacement and no deletion of recoverable input |

A source may append finished/lifecycle records after the mapping prefix. Extend the
existing journal reader to validate/read exactly a declared token boundary, including
its newline and SHA, so later appends cannot enlarge represented support. Do not add
a second parser. Earlier malformed data, a boundary inside a record, shorter files,
or altered prefix bytes refuse. Tail diagnostics remain distinct from this valid
prefix. New completion events are not a mapping authorization.

Delete the packed working file only after durable publication and actual canonical
verification, when clean physical EOF is proven and R=C<=A (every physical frame is
represented). If decoding stopped on a corrupt tail or C>A leaves unjournaled bytes,
retain that sole unresolved payload and diagnostics. This is justified retention,
not the default second original. Old/user-imported sources are never cleanup inputs.
Remove candidate hard links/attempt files last and sync affected directories.

Normal stop caches its closed-writer result while publication retries; it stays in
its existing finalizing/termination owner rather than closing AVAssetWriter twice.
Mandatory publication failure retains an actionable stop/recovery retry against the pinned attempt, without an automatic no-progress loop. The current stop guard must deliberately allow finalizing continuation using that closed result. Optional staging-cleanup failure does not revoke already admitted canonical availability; retain the diagnostic and owned cleanup work for an explicit retry. Explicit discard remains the escape
through existing cancellation/deletion ownership. An intrinsically unavailable role
may settle interrupted after other roles publish, retaining its unresolved bytes.
Recovery must likewise finish required publication work before the service authors
its settled catalog outcome. No new job manager or autonomous cleanup service.

## Immutable admission without another full media copy

Freeze the two optional publication members (including absence) alongside existing
journal/media admission. Copy these small proof members into acquisition staging.
Use existing worker descriptor inheritance: open the admitted canonical files with
identity checks, keep read-only leases across the native evidence export, and pass
those descriptors to the same canonical verifier. Native normal recording export can
use its owned files directly. Recheck source identities after verification.

SourceEvidenceExport becomes publication-aware: schema2 audioAcquired comes only
from the pinned accepted mapping clipped to R and verified canonical support. It
returns verified canonical byte identities and publication identities. Missing or
invalid role proof produces no audio binding for that role; valid video/other role
still works. It never opens packed files as source assets. Existing source clock
normalization remains at AssetStore/acquisitionContext; no TS timing implementation.

Then AssetStore's existing copy/hash admission must enforce the verified SHA before
ANY catalog publication, including the already-cached-asset branch. The smallest
seam is an optional expected content digest in the existing copyImportedFile
expectation, not a second staging store or transaction framework. The original file
identity plus the verified content digest prevents a donor replacement between
verification and import from changing the admitted media. Publish the acquisition
only after those imports and normalized evidence agree; existing abort cleanup and
ResourceReferences retain/release remain authoritative.

Public integer support projection is still a gate: the shared native projection
must preserve the admitted timeline under the existing source-origin conversion,
including100001us phase and real1us external masks. Receipt metadata cannot select a
new rounding policy. Legacy schema1 discontinuous packed audio must be refused when
physical source placement cannot independently support its rounded journal claim;
positive old continuous/canonical controls remain required. Do not silently reinterpret
or rewrite old bytes. Changed evidence policy needs a new generation, not overwriting
retained evidence/history.

## Package and deletion closure

Extend Acquisition/PortableAcquisition with bounded optional per-role receipt member
identities; resourceMembers includes their bytes/hashes. Packed payload/candidate
files are not portable dependencies. Existing immutable asset identities carry the
canonical files. Package stagePortable revalidates the receipt+prefix against the
staged immutable canonical asset paths already supplied by AssetStore.stagePortable,
and compares re-derived audio support with normalized rows before shared publication.
Do not accept the normalized artifact merely because its row count matches a receipt.
No donor path or mutable receipt is consulted after admission/relocation.

All new working files stay beneath the existing recording root. Acquisition proof
copies stay beneath its existing generation directory. Reuse recording quiescence,
job drains, ResourceReferences and ManagedFiles recursive owned deletion; no orphan
side-store. Publication must finish/release its lease before those owners remove it.

## Bounded gates before implementation/rollout acceptance

Use frozen actual-writer payloads and ordinary capture/import/package paths. Cover
A<C, A>C, no mapping, corrupt interior/tail, both roles, missing journal, child-FD
inheritance, replaced journal inode, concurrent recovery refusal, partial publication,
every boundary above, canonical/receipt mutation, donor changes after admission,
receipt absence becoming presence, package relocation/tampered support, repeated
finish/discard and retirement. Verify actual decoded sample identity/support and
surviving input bytes, not only states or receipt fields. Process-kill/fsync evidence
is not a claim of tested power-loss hardware durability.

20c's shared verified candidate owner is prerequisite. Only after these20d gates
wire and enable the new schema2 callback transaction; physical20/21 remain open.

Materializer representation: existing bulk AVMutableComposition is the settled candidate mechanism; its feasibility evidence includes 100k runs. Receipt identity remains independent of this platform implementation.
