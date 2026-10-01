# 21f3c — Native crash-source publication recovery

Status: native implementation is merged-verified by the
[root source/runtime and focused check](../assets/21f3c-source-publication-recovery/merged-verification.json).
The complete native default gate also passes; atomic consumer integration remains separate. The
[scoped evidence packet](../assets/21f3c-source-publication-recovery/README.md) pins current source,
runtime, complete recovered specimens and refusals. No physical acceptance is added.
Prerequisites: [3a authority](21f3a-independent-publication.md),
[3b independent camera support](21f3b-independent-camera-clock.md) and the existing
media recovery owner. [Atomic selection](21f3-public-camera-selection.md) consumes
this checkpoint before exposing its selector.

## Contract and owner

An allocated source recoverable through existing `media.recover` either obtains
verified publication authority or returns an explicit source refusal. Positive
recovered duration cannot leave it permanently pending with no publication owner.
Recovery is mechanical: no project, layout, treatment or editorial decision.

MediaRecovery remains the operation owner; CaptureSourcePublication remains the
sole source-authority publisher/verifier. Reuse CaptureJournal's parser and one
CaptureJournalLease across canonical recovery, provenance checks and authority
publication. Its original-journal descriptor remains read-only. Retain exclusive
ownership, inode/directory checks and no-replacement member publication. The
service's existing native-idle proof and successful exclusive ownership authorize
recovery closure; filenames or duration do not.

Primary video support inspection currently belongs to the wire recovery module.
Extract that existing primitive into the shared native capture/media boundary
used by recovery and authority verification. Preserve its occupied-segment,
decoded-picture, sample-cursor tail, downward endpoint rounding and error rules.
Camera and PCM retain their existing publishers/verifiers; no second inspector
or support arithmetic is introduced.

## Recovery authority and immutable originals

Keep `source.publication.json` as the sole durable source authority and retain the
public CapturePublishedSource field shape. A newly recovered authority has an
explicit private recovery-provenance basis inside that same stored receipt. It
pins the complete original journal identity, consumed validated-prefix boundary,
sequence and identity, original unfinished/torn/corrupt disposition, actual origin
and binding, verified support/diagnostic and canonical/proof identities.

Primary recovery copies the entire leased original into `source.journal.jsonl`,
byte for byte, including any unvalidated tail. Camera recovery continues to pin
the whole original `capture.journal.jsonl`. Verify whole-file identity separately
from the prefix consumed by recovery. Neither path appends or synthesizes an
ordinary `finished` event. Source evidence keeps the original completion and
recovery disposition visible.

Receipts without recovery provenance retain every ordinary 3a completion,
whole-file, member, support and binding check. Receipts with that explicit basis
require the recovery proof and independent native support verification. Do not
upgrade or replace an existing receipt, weaken its checks or reinterpret it as
another provenance mode after corruption. Missing origin/header/binding can leave
ordinary media readable while captured-source authority is unavailable.

Snapshots and receipts are immutable and idempotent. Recheck original bytes,
prefix, canonical members and snapshot before committing authority. Occupied
inconsistent names refuse without replacement. A snapshot committed before a
crash can be reused only when its complete bytes and provenance match. A stored
receipt is always verified through its full private basis, never merely decoded
through its public projection.

## Worker and service seam

Extend existing `media.recover` with optional bounded
`sourceAuthority: { kind, sourceId, binding? }`, where camera binding is the full
recording/source/device tuple. The directory and expected authority come from
durable allocation, not a publication report. Validate that authority before
publishing bound artifacts. Directory-only recovery retains its existing behavior.

An authority-requested reply adds `inputsClosed` and `sourcePublication` to the
existing bounded RecoveryReceipt. The latter uses the canonical null/pending/
unavailable/published outcome; published carries unchanged public source fields.
A source-publication refusal must not hide a successfully recovered media result.
An outer media/ownership refusal retains its existing typed error. Closure is
reported only when native-idle and exclusive ownership have been established.
Do not send the complete timing model over this bounded boundary.

Use one native outcome/observation wire encoder for the actual CaptureController
callback and recovery response. Collapse the controller-local switch into that
boundary; do not add a wire-side duplicate or a second authoring model.

CaptureService uses its existing reconciliation task, lifecycle transaction and
source-admission notifications. Resolve both allocated directories, run their
bounded operations independently and persist each completed outcome immediately;
a verified camera cannot wait for primary publication. Physical closure and
publication remain separate facts. Operational refusal stays pending, invalid
provenance becomes unavailable, and ready acquisitions retain donor-independent
ownership under [23f](23f-capture-source-lifetime.md).

Reuse a retained observation generation. If none exists, establish and persist
one stable service-authored reconciliation identity in the existing publication
JSON before dispatch. It is explicitly a reconciliation identity, not a guessed
lost native generation or media timing provenance. Existing service-authored
sequence fencing rejects late native reports; retry/reopen reuse that identity.
No generation column, recovery table, queue or transition engine is added.

[21f3](21f3-public-camera-selection.md) owns this service integration and the complete
CLI/MCP/controller-to-project gate. This native prerequisite provides verified
source facts; it does not expose selection independently.

## Admission consumes the complete proof

Captured-source import must freeze and stage the complete `source.publication.json`
alongside its whole immutable journal and media proofs. It is a capture-admission
authority member, not another portable evidence inventory. Keep its private
recovery basis intact; the public source projection alone cannot authorize import.

Extend existing `media.sourceEvidence` with an explicit expected published source
and the frozen receipt's whole byte count/SHA-256 for this admission path. That
identity belongs to the capture intent; the public source projection contains no
self-hash. The sole source-authority verifier reads the full staged receipt,
verifies its provenance and compares its public projection
with that expectation. Resolve every required canonical media member through the
existing pinned descriptor overrides; missing overrides refuse. Journal, receipt
and proof members stay stage-local. Primary's logical `source.journal.jsonl`
resolves only to the byte-identical staged `capture.journal.jsonl`, checked against the receipt's
whole-file identity. Camera already uses that name. No live-donor journal fallback
or second exclusive lease on the donor is allowed: a published camera must remain
admissible while primary publication still holds its native journal lease.

Return a bounded native-verified authority fact for the importer to compare before
evidence ingestion and asset publication. Ordinary receipts still require their
positive recorded completion to equal the source duration. Explicit recovery
receipts instead require the shared inspector's verified recovered support to
equal that duration. A missing completion is never a reason to skip verification.
Preserve unfinished/torn disposition in normalized source evidence; do not insert
a synthetic completion. Keep generic source-evidence and portable READY-acquisition
formats unchanged. Consume and strip this capture-only verification fact before
source-evidence ingestion; portable re-verification reproduces the same generic
receipt without capture authority. After verification and import work succeed,
remove the transient staged authority before READY publication through existing
attempt-workspace ownership. The capture intent retains its frozen identity for
unfinished retries; failure cleanup already owns
the entire stage. No new public member namespace or retained donor dependency is
introduced.

## Numerical and production gates

Use an explicit tiny oracle: primary origin 1,000,000 us and pictures at source
0, 100,000 and 200,000 with verified support ending at 300,000; camera origin
1,040,000 with the same source support. Neither journal has ordinary completion.
Require exact source/binding, support and 40,000 us host correspondence. Add an
unvalidated final record and prove original/snapshot whole hashes remain unchanged
while the consumed prefix ends before it. Actual persisted frames, not offered
callback counts, determine recovered support.

Drive actual NativeCapture through its prerecorded boundary in an owned process,
terminate before normal completion, then recover through actual native Wire
`media.recover`. Normal stop cannot manufacture this crash fixture. Retain complete
requests, original journals, raw/canonical proofs, decoded support, snapshots and
receipts. Cover absent-primary usable-camera support and actual host pauses.

Retain red controls for absent recovery provenance, duration-only authority,
changed binding/origin, original bytes changed outside the valid prefix,
snapshot/canonical/proof changes and substitution of a growing live journal.
At actual import, omit or alter the staged private proof, substitute a different
journal or canonical descriptor, and require refusal before READY. A truthful
unfinished source must pass only through native verification of recovered support;
ordinary positive-completion controls remain unchanged. Reopen a READY acquisition
and perform the existing portable verification after donor deletion to establish
that capture-only authority introduces no donor dependency or new evidence format.
Cover active leases, replaced inode/directory, permissions, cancellation, occupied
names, no video and requested audio loss. Crash between snapshot and receipt,
then lose the reply after receipt commit; retry/reopen must preserve receipt bytes.
In the atomic consumer gate, hold primary operationally pending and admit verified
camera first, then reverse the roles. Hold physical drain separately to refuse
early admission. Do not suppress a sibling or add another teardown.

Preserve the complete default media-recovery controls: unfinalized fragmented
video, edit-list tails, empty gaps, optional-audio bounds, packed publication and
bounded receipt size. Verify existing ordinary 3a receipts without regenerating
their evidence. Keep historical workers and packets frozen; use separately pinned
current-source offline CODE builds for these newly named functional gates.

## Scope and discretion

No historical journal rewrite, migration, authority upgrade, second lifecycle,
queue/table, new source engine, selector exposure or project authoring. No hardware,
model preparation/inference, audible playback, installed switch, frozen-worker
replacement or accepted-cohort repetition. The retained four-minute take and
saved auditions remain unchanged. Physical synchronization, live hardware
interruption and completed-stop deadlines remain open.

Delegated: internal names, placement of the existing shared inspection primitive,
bounded private provenance encoding and fixture organization. Original whole-file
identity, ordinary verification, public field shape and truthful support are fixed.
Review shape, code, docs and choices; retain exact source/runtime and complete
artifacts before committing the scoped native claim.

## Native implementation receipt

The source publisher stores private recovery provenance in its one immutable receipt while the
wire keeps the existing public projection. Complete original/snapshot hashes remain distinct from
the parser's validated prefix. Shared inspection verifies the full support digest and duration;
ordinary completion authority keeps its previous checks. The staged source-evidence path verifies
the full receipt hash and canonical descriptors through its own lease, then returns the transient
`verifiedSourceAuthority` fact for the atomic importer to consume.

The focused SourcePublicationRecoveryTests gate and the complete default capture suite exit 0.
They cover actual owned-process pre-completion crash recovery through the bound production input,
whole unfinished/torn/corrupt journals, camera-only/pause support, operational refusal, cancellation
after snapshot publication, immutable retries and staged proof/descriptor refusal. The packet
retains the first direct-probe locator mismatch with its precise fixture scope and failed-runtime
pin limitation. The shared fixture provider has one home for the later controller consumer.

Shape, diff and documentation review preserve one authority, parser, lease and support inspector.
The implementation choices ledger records the bounded recovered diagnostic and full-support
digest. Existing frozen cohorts were not replayed or replaced. Controller/core/service integration,
READY portable verification after donor deletion, physical synchronization, live hardware and
completed-stop acceptance remain unclaimed here.
