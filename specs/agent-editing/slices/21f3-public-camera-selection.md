# 21f3 — Atomic public camera selection and bound source outcomes

Status: selector-free 21f2, native
[independent publication](21f3a-independent-publication.md) and the
[camera-origin prerequisite](21f3b-independent-camera-clock.md) are merged-verified.
The [native crash-source prerequisite](21f3c-source-publication-recovery.md) is
merged-verified. The complete atomic selector checkpoint is in isolated integration;
its actual recovery/admission and complete consumer gates must pass before enabling
selection. This is the third checkpoint
of [21f](21f-public-camera-selection.md), reusing completed input, publication,
admission and caller-authored project mechanisms from 21a–21e.

## Contract

An optional bounded public `cameraDeviceId` reaches the actual native input and
returns independently addressable source outcomes. Omission opens no camera;
explicit denied or unavailable selection refuses without fallback or permission
prompt. Replay retains the exact allocated binding; changed selection conflicts.
Capture publishes sources and admission facts, never a project or composition.

## Owned seams

Protocol selection/native-start/report shapes, CaptureStore allocation and replay,
CaptureService control/recovery, the app controller and existing native input must
change together. Extend the existing recordings row with camera allocation and
bounded publication facts in the same catalog transaction; no auxiliary source
lifecycle table. Include selection in its existing replay fingerprint; native
receives the stored recording/source/device authority rather than inventing it.
Keep immutable allocation/replay arguments separate from evolving publication
facts. Retain each source's last accepted immutable receipt beside its current
native observation in that existing publication JSON. Receipt identity stays fixed
across operational refusal or terminal unavailability; eligibility uses only the
current native outcome and physical closure, never that cached receipt. This is
bounded source evidence, not a second transition engine or ownership table.
The shared catalog format fence covers both CaptureStore and its installed
RevisionStore specialization: advance that one format and create fresh scratch
catalogs rather than adding migrations, ALTER statements or schema modes. Older
catalogs are refused unchanged. The installed executable and library stay untouched;
verify its surviving transaction behavior with the current code on fresh catalogs.

The recording's publication JSON retains the last accepted immutable receipt for
each source beside its current native observation. This is receipt identity
history, not another transition engine. A later verification refusal may change
published to pending or unavailable while its sibling advances. Eligibility and
bounded public discovery use only the current outcome and physical closure;
retained receipt identity never implies current source availability.
The isolated implementation and verification are retained in the
[atomic selection packet](../assets/21f3-public-camera-selection/README.md).

NativeCapture, the shared input/clock and sole termination owner remain the
surviving mechanism. The app controller must retain the independent camera result
when reporting settlement. Publication callbacks snapshot the complete bounded
observation with take/source/generation authority before asynchronous sending,
using the existing journal-numbered lifecycle sequence. Later terminal reports
carry the same source facts so out-of-order delivery cannot lose a newer outcome;
the original finalizing acknowledgment remains immutable. Recovery and deletion derive both source directories
from durable ownership, never a path supplied by an untrusted report. Preserve
ordinary cadence, pause mapping and primary microphone/system/cursor behavior.

Admit sources separately through existing acquisition/import/jobs. Camera remains
ordinary video in its own acquisition. Its eligibility and expected binding come
from stored capture facts, and the complete normalized recording/source/device
binding must match before acquisition publication. A usable camera is not suppressed merely
because primary sourceDuration is null. Publication/admission failure and retry
remain independent per source; retry cannot drain or close the inputs again.

Extend 21f2's bounded sourceAdmissions discovery with the actual camera authority.
For an eligible published source awaiting queue admission, acquisition/job identity
is null and admissionError is null; this is pending admission, not success. A
durable request conflict remains explicit refusal. Preserve independent terminal
source unavailability and publication/admission failures explicitly. Nullable IDs
alone cannot classify a canceled or no-video outcome as pending work. After job
admission use its existing receipt and acquisition.get for full metadata. Reads
do not admit work. Do not add a second lifecycle, queue, admission table,
media role or camera-specific composition owner.

Existing app controls carry camera identity through selection decoding, apply,
start serialization and reconstructed restart requests. This contract adds no
picker, saved preference, editing UI or start-time authoring settings. CLI/MCP
continue deriving operations from the shared registry. Installed switching and
obsolete-owner deletion remain under 23.

A published source must become discoverable and independently admitted even
while its sibling publication remains operationally pending. Derive capture
priority from actual physical closure: preparing/recording/paused and draining
inputs retain priority; already closed inputs awaiting publication do not hold
source admission indefinitely. Persist source outcomes through the existing
lifecycle transaction and native sequence; no second source transition engine.
Immutable source-journal authority comes from 21f3a. Resolve the logical journal
member from its published receipt, freeze the entire immutable file, and stage it
under the importer's existing journal name. Do not freeze the growing live journal
or relax whole-file identity. Stage the complete private source receipt and consume
the native-verified admission fact under the
[recovery proof contract](21f3c-source-publication-recovery.md#admission-consumes-the-complete-proof).
Missing ordinary completion does not authorize skipping its replacement support
proof. Existing recovery verifies each source's publication
authority independently through allocated paths, including the
[pre-completion crash prerequisite](21f3c-source-publication-recovery.md); a pending primary cannot hide a
verified camera. Cancellation fences and joins unfinished donor borrowers through
merged-verified 23f before discarding bytes. Ready acquisition originals retain
their independent ownership.

### Empty allocated sources

Startup can end after allocation but before creating a journal. Such a take must
settle truthfully instead of remaining operationally pending forever. The managed
reconciliation owner first proves actual controller idle/null status, persists
finalizing and prevents another start on that allocation. A native empty-source
observation relies on that composite ownership contract; a directory lock alone
does not prove capture is idle.

Only typed journal absence in an existing owned private source directory may use
this path. Validate the bounded allocated kind/source/binding, retain and
exclusively lock its directory descriptor, recheck directory identity and journal
absence, and inspect every entry. A literally empty directory returns the existing
zero-media recovery result with closed inputs and an unavailable source. It
creates no journal, snapshot, source receipt, media or lock file. Unknown or raw
members, a missing/replaced directory, permissions/I/O, contention or cancellation
remain outer refusal; nonempty media cannot be discarded by this shortcut.
Directory-only recovery and ordinary/recovered published-source authority remain
unchanged. Verify the original never-started-take preservation control through
the actual service and native worker, including retry/reopen and unchanged empty
directory bytes, before closing this atomic checkpoint.

The [native correction](../assets/21f3-empty-allocation-recovery/README.md) and
[merged focused proof](../assets/21f3-empty-allocation-recovery/merged-verification.json)
verify this narrow fallback and its retained-member/ownership/cancellation
refusals. Native default controls remain green. Actual managed allocation and
service retry/reopen stay part of this atomic checkpoint; no physical or installed
claim follows from the native result.

## Bounded verification

Drive actual CLI/MCP through the fresh service/private control and compiled actual
app controller/NativeCapture, substituting only the existing prerecorded device
boundary. Reuse the retained tiny numeric inputs through current publication
owners to produce proof for newly allocated identities. Historical supplied-binding
fixtures cannot be relabeled as freshly allocated evidence.

The existing NativeCapture input boundary can supply prerecorded sessions in its
package test target. Keep a real production dependency boundary at the app
controller if necessary to exercise it: inject the concrete NativeCapture with its
ordinary default unchanged. Compile the actual controller and ServiceHost with
the package input boundary; source rewriting and substitute controllers cannot
prove this gate. Do not add a test-only playback/capture mode. Compile source-identical app logic and pin all
participating source/runtime identities. Do not activate devices or create app
windows during these checks.

Verify omitted/selected/denied/absent inputs, exact identity forwarding,
changed-selection replay, independent source eligibility, pause/cancel/service
loss, repeated stop, publication/admission retry and reopen. Drop the selector or
camera result, change binding/offset, or duplicate admission as negative controls.
Prove the published acquisition reaches ready while its sibling is still pending,
and hold physical drain separately to prove admission cannot run early. Include
3b's absent-primary case and byte-identical refusal of prior-format catalogs.
Then exercise existing explicit project/edit operations against 21e's numeric
picture/PCM/offset oracle, including independent replacement and undo. The caller
supplies canvas, tracks and placement; no capture-finalization layout is chosen.

## Acceptance boundary and discretion

This establishes controlled allocation-to-project behavior. It does not establish
physical synchronization, live hardware interruption/shutdown, representative
image quality or the ten-second completed-stop deadline. Preserve those unchanged
claims under20/21 and all accepted audio/image evidence in its original scope.

Use existing offline code dependencies and separately pinned scratch builds.
No new hardware capture, model work, audible playback, frozen-worker replacement,
installed switch or historical journal rewriting is authorized. Run only affected
preservation gates; no accepted cohort or audition is repeated for activity.

Delegated: focused internal names, real dependency-boundary placement and bounded
fixture organization. Review shape, code, documentation and choices before
committing; publish evidence and current Status without declaring parent21 done.
