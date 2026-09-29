# 20d — Canonical capture publication and recovery rollout

Status: partial prerequisite; publication/admission rollout remains open. Dependencies: [20c](20c-sparse-capture-materialization.md), [20d1](20d1-recovery-continuation.md), [20d2](20d2-asset-metadata-pages.md), [20d3](20d3-package-asset-metadata.md).

## Contract and owner

Wire the shared materializer into the existing capture finalization and recovery
lifecycle before enabling packed audio writes. Only independently verified canonical
source-time files reach source adoption, AssetStore, project initialization or public
inspection. Packed staging is unpublished working data; discovery must never mistake
its file timestamps for source placement. Other valid roles remain recoverable if one
role cannot be canonically published. Keep existing interruption/cancellation and
late-callback generation boundaries authoritative.

Admission must bind normalized acquisition support to the canonical file's verified
represented prefix. [AcquisitionImporter](../../../packages/core/src/acquisitions.ts)
currently exports evidence from an admitted journal-only directory before importing
media; a successful MediaRecovery call elsewhere does not guard this path.
[SourceEvidenceExport](../../../helpers/mac/Sources/ScreenRecorderWire/SourceEvidenceExport.swift)
must not project every accepted append as playable support when canonical recovery
retained fewer frames. Freeze whatever publication evidence proves that prefix with
the admitted files, and preserve it through package relocation. Do not let a mutable
donor receipt or an unverified journal suffix expand an imported asset's support.

The persistent journal discriminant separates new packed layout from existing takes.
Old source bytes remain immutable. Existing canonical/continuous takes keep their
behavior; an old discontinuous packed take must not claim later acquisition verified
from rounded journal support alone. Preserve its bytes and expose only independently
established support, or explicitly refuse the ambiguous role. Do not invent exact
addresses or migrate old media automatically. This preserves real files, not a
compatibility path for unshipped intermediate implementations.

## Publication and cleanup

Publish from a validated temporary canonical candidate through the existing take
owner. Pin the exact payload/journal prefix and verified canonical identity so a
restart cannot finish a different attempt. Define and test actual durable publication
ordering, including directory/file synchronization where required. A completion
receipt alone is not proof that media bytes or placement are correct.

Packed staging may be cleaned only after independent canonical PCM/segment verification,
durable publication and restart-safe ownership handoff. Do not retain an indefinite
second original by default, and do not delete the sole recoverable payload on a
failed/uncertain attempt. Original user imports and older source assets retain their
existing immutable retention contract. Reuse existing inventory/package/deletion
ownership; new filenames must not evade accounting. Cleanup is idempotent and
interruptible, including a restart between canonical publication and staging removal.

A known accepted/committed count mismatch is unresolved evidence, even if every
decodable frame fits in the canonical prefix. Automatic cleanup requires matching
accepted, proven committed and represented frame counts, complete indexed-media
decode and no unresolved tail diagnosis. In particular, accepted frames beyond
physical EOF retain the working payload. This tightens the earlier proposal's
`represented = committed <= accepted` condition. The proof concerns committed,
decodable PCM and underlying indexed sample extent; it does not claim forensic
classification of arbitrary unindexed container bytes or require a new parser.

## Acceptance and review surface

Through actual prerecorded CaptureWriter callbacks and normal service finalization,
prove continuous preservation plus omitted/pause-run original sample positions for
narration and system audio. Normal and recovered sources must agree for the same
committed prefix. Exercise repeated finish, cancellation, missing requested role,
independently valid video, journal failure and restart at every publication boundary:
export in progress, after verification, after rename, after receipt, during diagnostics
and before/after staging cleanup. Corrupt or mismatched candidates never permit deletion
of recoverable input. Partial results carry truthful failure/support rather than
pretending the entire take passed.

The public orchestration already bounds native control and recovery workers through
[protocol deadlines](../../../packages/protocol/src/framing.ts),
[client operation budgets](../../../packages/protocol/src/operations.ts) and
[the worker owner](../../../apps/service/src/worker.ts). Exercise finalization and
recovery workloads exceeding their old short-operation budgets, including retries
and cancellation. Preserve truthful finalizing state and existing attempt ownership;
do not widen every operation's timeout or infer public success from an unbounded
standalone native call. Any per-operation budget must cover its actual consumed
work and remain consistent with the outer client wait.
The concrete service continuation, persisted finalization error and survived-native
restart boundary are owned by [20d1](20d1-recovery-continuation.md); its gates are
required before enabling this rollout.

Run public source get/list, audio evidence/read, asset adoption and project placement
on the canonical files; cover restart, history/package dependency closure and take
retirement so publication does not strand bytes or relabel staging as an asset.
Preserve capture/recovery, cursor/geometry, source-audio and capture-to-project tests.
Use delivered samples and exact support, not state-only receipts. Retain a bounded
failure/recovery artifact with source and worker hashes and independent review.

Only after these gates enable the new writer layout, replacing transitional test
wiring in the same rollout. Close 20a's PCM delivery prerequisite from actual-owner
results; keep the [physical 20](20-camera-reproduction.md) ten-minute drift and
interruption gates and [21](21-webcam.md) public webcam integration gates open.
No live capture, prompts, installation or permissions are authorized by this plan.

Delegated: internal publication helper names and reversible diagnostic presentation.
Durability/cleanup evidence, canonical-only admission and old-source truth are fixed.

## Banked ownership prerequisite

[Journal lease evidence](../assets/20d-journal-lease/README.md) establishes cooperative inode ownership, close-on-exec release and exact validated-prefix replay through the existing parser. Ordinary schema1 writers now hold that lease; no packed layout or schema2 admission is enabled. The [publication proposal](../assets/20d-journal-lease/publication-proposal.md) defines the remaining caller integration.

[Offline publisher evidence](../assets/20d-publication/README.md) covers pinned per-role intents/receipts, no-clobber restart and verified optional cleanup. Actual stop continuation and schema2 publication/admission rollout remain open. Cleanup requires healthy A=C=R, clean indexed decoding and no unresolved diagnostic; the older <=A proposal is superseded.

The rollout gate includes actual public stop/recovery work beyond their old 10s/30s
outer deadlines and cancellation. Existing finalizing/attempt ownership must allow
completion or actionable continuation; repeated timeout/restart without progress is
not support. Keep any justified work deadline specific to these operations.

[Canonical admission evidence](../assets/20d-canonical-admission/README.md) now binds
acquisition support and project-package readiness/adoption to native-verified R,
immutable canonical bytes and actual media metadata. [Recording-package evidence](../assets/20d-recording-package/README.md) extends that same admission owner to processed-package assembly and readiness, binding the retained audio pages as well as raw evidence. Packed writer activation still waits on the lifecycle/large-work gates above and actual callback/recovery integration.


[Stop continuation evidence](../assets/20d-stop-continuation/README.md) verifies
finalizing acknowledgment, retained terminal ownership, early explicit cancellation,
and completion winning optional-cleanup cancellation through existing controller,
termination and service owners. Native-proved finalizing after an unanswered start
must not trigger recovery of still-owned media. CaptureResult.cleanupFailure keeps
optional cleanup distinct from capture failure. Ordinary schema1 remains enabled;
actual prerecorded NativeCapture/writer/publisher, typed unavailable roles, recovery
budgets and layout rollout remain required. The physical input
seam must include cursor acquisition and preserve existing start teardown/geometry.


[Missed-terminal cancellation evidence](../assets/20d-cancel-recovery/README.md)
requires recovery before cancellation when native has forgotten the take. Any
recoverable or ambiguous remaining source bytes survive; only proved absence permits
canceled deletion. Explicit library deletion remains a separate authority.


[Physical input lifetime evidence](../assets/20d-input-session/README.md) exercises
actual NativeCapture and writer with prerecorded video through the package-only
input boundary, preserving production selection/geometry/observation order. The
full controller/audio publication/admission gate remains open until activation.


[Acquisition lifetime evidence](../assets/20d-acquisition-lifetime/README.md) proves that orphaned native source/probe workers block whole-acquisition startup cleanup through the existing directory lock. Recovery returns actionable busy without deleting their inputs or pending reservations; it completes after the child exits. This does not resolve the separate large-work source/admission deadline gate.

## Source normalization budget and next metadata gate

[Source budget evidence](../assets/20d-source-budget/README.md) establishes public 100,000-run source normalization readiness and native cancel/drain with a scoped canonical segment-work allowance; legacy/global/client budgets are unchanged. It does not establish whole 100,000-run acquisition or package support. Actual native probing returns 15,428,144 bytes and 200,000 physical segment rows (100,000 occupied runs plus empty gaps), independently exceeding the 8 MiB response transport and the asset schema's 100,000 physical-row cap.

The next metadata delivery checkpoint must retain exact complete physical segment meaning and canonical descriptor authority, reuse bounded file/descriptor evidence mechanisms for bulk metadata, and reconcile the existing physical-row and occupied-run domains explicitly. Preserve both red refusals, empty segments, normalized probe validation, package relabeling controls and cancellation. Do not raise global framing, drop gaps or treat a transport-only fix as domain closure. [Source lifetime evidence](../assets/20d-source-lifetime/README.md) covers per-generation orphan reclamation and whole-recording deletion authority, including independent descriptor-removal red controls. Actual writer/recovery activation remains separate.

[Probe file delivery](../assets/20d-probe-file/README.md) now carries complete native
metadata through a caller-owned file and verified compact receipt. Existing strict
metadata validation, inline native consumers, global control frames and package
manifest limits are unchanged. The physical-row bound is the next admission
prerequisite; public asset metadata delivery and portable metadata inventory remain
separate gates. Previously failed immutable import requests retain their result;
capability expansion is exercised with an explicit fresh request ID.

[Physical-row evidence](../assets/20d-probe-rows/README.md) establishes the 2N+1
bound, preserving both edge gaps around N=100,000 occupied spans. The actual
100,000-run source now reaches ready through public acquisition with a fresh
request ID. Full public asset metadata and portable manifest delivery remain the
next independent prerequisite; acquisition readiness alone does not close them.

Remaining metadata delivery is split into [20d2 public asset pages](20d2-asset-metadata-pages.md)
and [20d3 inventory-bound package metadata](20d3-package-asset-metadata.md). These
preserve one AssetStore metadata owner and separate response delivery from complete
pre-ready portable dependency/canonical verification.
