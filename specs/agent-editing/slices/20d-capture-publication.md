# 20d — Canonical capture publication and recovery rollout

Status: verified prerecorded canonical-publication rollout. [20d8](20d8-pause-terminal-boundaries.md) closes the aggregate audit's pause and interrupted-terminal gaps; its tests and public journey also pass on integrated main. Physical20/21 and installed cutover remain separate. Dependencies: [20c](20c-sparse-capture-materialization.md), [20d1](20d1-recovery-continuation.md), [20d2](20d2-asset-metadata-pages.md), [20d3](20d3-package-asset-metadata.md).

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
results; keep the [physical 20 retained-take](20-camera-reproduction.md) drift and
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
optional cleanup distinct from capture failure. The native activation checkpoint
below verifies prerecorded NativeCapture/writer/publisher and recovery budgets.
The physical input seam includes cursor acquisition and preserves existing start
teardown/geometry.


[Missed-terminal cancellation evidence](../assets/20d-cancel-recovery/README.md)
requires recovery before cancellation when native has forgotten the take. Any
recoverable or ambiguous remaining source bytes survive; only proved absence permits
canceled deletion. Explicit library deletion remains a separate authority.


[Physical input lifetime evidence](../assets/20d-input-session/README.md) exercises
actual NativeCapture and writer with prerecorded video through the package-only
input boundary, preserving production selection/geometry/observation order. The
native activation checkpoint below covers the full controller/audio publication
and admission gate.


[Acquisition lifetime evidence](../assets/20d-acquisition-lifetime/README.md) proves that orphaned native source/probe workers block whole-acquisition startup cleanup through the existing directory lock. Recovery returns actionable busy without deleting their inputs or pending reservations; it completes after the child exits. This does not resolve the separate large-work source/admission deadline gate.

## Verified source and metadata prerequisites

[Source normalization](../assets/20d-source-budget/README.md) verifies the public
100,000-run workload and native cancel/drain under the scoped canonical work
allowance. [Source lifetime](../assets/20d-source-lifetime/README.md) covers
per-generation orphan reclamation and whole-recording deletion. Global control
framing and client deadlines remain unchanged.

[Probe file delivery](../assets/20d-probe-file/README.md) carries complete metadata
through an owned file and verified receipt. [Physical-row admission](../assets/20d-probe-rows/README.md)
retains both edge gaps around every supported occupied span. [20d2](20d2-asset-metadata-pages.md)
owns bounded public metadata pages; [20d3](20d3-package-asset-metadata.md) owns
complete resource/history hydration before package readiness. Their combined
public journey preserves all rows and selected undo history. None of these
metadata gates substitutes for physical capture or the remaining cleanup work.

### Terminal diagnostic disclosure

[20d7](20d7-terminal-diagnostics.md) preserves the original bounded diagnostic
through recording reads, timed evidence and portable receipt verification,
including no-video recordings. It does not overload unfinished finalization errors.

### Native activation checkpoint

Actual CaptureWriter callbacks now admit PCM prospectively, commit clock/address
state only after successful append, and journal exact accepted frames. Ordinary
capture writes working packed audio and exposes only verified canonical publication.
Normal stop and restart recovery share the publisher; missing roles, verified zero
prefixes, integrity conflicts and operational failures remain distinct. Independent
roles continue after a role failure, and temporary read/write access does not become
an irreversible terminal result. Native finalization diagnostics use the same
bounded retryability translation as recovery and flow into the recording's existing
finalizationError owner.

[`20d-activation`](../assets/20d-activation/README.md) retains actual prerecorded
controller/writer/publication and recovery parity, real journal failures, independent
PCM, long finalization/cancellation, public acquisition/audio/clean-frame delivery,
and the scoped native one-microsecond mask gate. No physical capture was activated.
[20d6](20d6-settled-cleanup.md) verifies settled cleanup replay and
[20d7](20d7-terminal-diagnostics.md) verifies terminal disclosure. Source-admission
operational retry is verified by [20d4](20d4-source-admission-retry.md). The aggregate acceptance audit found two missing prerecorded proofs; both now pass
[20d8](20d8-pause-terminal-boundaries.md): both-role pause runs through actual packed
finalization/recovery, and recovery after canonical publication with an absent or
torn terminal diagnostic record. Integrated native and CLI/MCP/restart gates pass.
Physical20/21 remains separate; reconstructed filesystem states do not claim
hardware power-loss testing.
