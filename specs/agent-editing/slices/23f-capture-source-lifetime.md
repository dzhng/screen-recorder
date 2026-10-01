# 23f — Captured-source deletion and verified working-file cleanup

Status: source-only lifetime reconnaissance complete; implementation proceeds from
merged [21f2 capture coordination](21f2-capture-coordination.md). Later21f3 uses
this same borrower lifetime; completion of parent21f is not a prerequisite. Installed
switching and obsolete-owner removal remain under [23](23-cutover.md).

## Contract

Explicit recording deletion fences and joins every producer still borrowing the
recording directory before removing it. Capture cancellation/discard must use that
same unfinished-borrower lifetime before deleting donor bytes; early independently
published sources in21f3 cannot create an unjoined reader. Independently ready acquisitions and the
assets/evidence/history they own survive donor deletion. Explicit verified audio
working-file cleanup preserves canonical media and unverified inputs. Neither
operation creates a composition or a new asset-GC policy.

## Existing ownership

Adapt surviving RecordingDeletion and CaptureCleanup to real CaptureStore facts,
shared queue, CaptureService quiescence and descriptor-anchored ManagedFiles.
Recording cleanup jobs use the existing recording target with revisionId null;
no span revision is created or required. Keep one deletion fence/restart journal
and one queue. The installed editing specialization retains its actual transaction
and artifact retirement until hard cutover; do not replace it with a no-op facade.

Fresh capture, admission, file removal and aggregate storage share the existing
library managed root. Native file operations receive the same verified root and
directory descriptors. Old installed paths remain untouched before cutover.
Storage counts active, unfinished and deletion-pending bytes honestly; there is
no per-project allocation or second storage scanner.

An unfinished capture acquisition is an acquisition-owned job, so draining only
recording jobs is insufficient. For unfinished acquisitions, fence admission/retry against the recording's
deletion state and join their attempts before donor removal. Already-ready
acquisition recovery keeps its independent publication contract.
Use the existing shared recording-directory lease and native descriptor lifetime
for donor reads; an acquisition-workspace lease cannot protect another tree.
Share the unfinished-borrower fence/drain inside cancellation without invoking
the complete RecordingDeletion path: its capture.quiesce re-enters the serialized
capture queue. Keep quiescence with the existing capture owner.
Retire attempt/job resources through their existing owners and preserve durable
replay identity. Startup resumes fenced deletion through the same owner.

A ready acquisition already owns copied journal/proof/media and resource references.
Recording deletion removes its donor tree, not those acquisition-owned originals,
project dependencies, generated/imported assets or historical outputs. Do not purge
acquisition evidence by treating it as recording evidence. Existing recording-scoped
artifacts on the installed path still retire at their real owners until23 removes
them; absence of those artifacts in the fresh path must not introduce dummy owners.

CaptureCleanup keeps its existing audio publication proof and role results. It
authorizes only verified audio working-file removal, never canonical media,
unverified input, camera raw data or arbitrary unreferenced assets. A missing or
refused proof remains a truthful retained/failed outcome, with explicit retry.

## Verification boundary

Exercise actual fresh public recording.delete/cleanup, queue and acquisition owners
with owned scratch donors. Pin deletion before/during source admission, refused
admission/retry after fencing, descriptor/lease refusal, joined cancellation,
failure/reopen/retry, repeated deletion and discovery. Discovery hides fenced recordings
while the deletion request remains retryable. No completed deletion may leave a
late attempt publishing donor-dependent state.

Admit a source and author a project explicitly, then delete only the donor recording.
Verify acquisition/source media, evidence and project history/inspection remain
usable with the donor unavailable. Assert exact originals and no project mutation;
reuse existing retained media rather than generating speech or repeating auditions.
A control that omits acquisition draining or its donor lease must fail.

Use existing pinned native file/cleanup operations only on scratch paths where
necessary to prove descriptor and proof semantics. Scripted worker controls isolate
coordination but do not claim actual native removal/proof acceptance. Verify source
and runtime identity before reuse; no frozen-worker replacement or native rebuild
is implied by this contract. Keep installed deletion/cleanup preservation green
through meaningful focused checks.

## Acceptance boundary and discretion

No hardware capture, model installation/inference, audible playback, installed
switch, old-library mutation or asset GC is authorized. Source lifetime, cleanup
and storage are the judged contracts; physical synchronization and stop performance
remain separately open. Native menu wiring follows this service primitive port;
a menu-model assertion cannot stand in for completed public deletion.

Delegated: internal type/refactor boundaries and bounded fixture organization.
Use existing owners and remove redundant adapters. Review shape, code, docs and
choices; retain failed controls and actual outputs with their scope before commit.
