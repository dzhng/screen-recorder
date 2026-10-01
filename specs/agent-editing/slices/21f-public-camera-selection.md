# 21f — Complete public selected-camera integration

Status: **complete in controlled scope**. Atomic public selection, independent
recovery/admission and explicit project use are
[merged-verified](../assets/21f3-public-camera-selection/merged-verification.json).
Physical synchronization, live lifecycle and installed acceptance remain open.
Dependencies: [21a](21a-camera-discovery.md), [21c](21c-selected-camera-input.md) and [21e](21e-capture-project-adoption.md).
Physical acceptance remains under [20](20-camera-reproduction.md) and parent [21](21-webcam.md).

## Contract

An advertised optional camera selector reaches the complete input, source-result,
finalization and caller-authored project journey through CLI and MCP. No accepted
selector is ignored.

## Seam and ownership

Add `cameraDeviceId` atomically across the existing protocol selection/native
start shapes, service allocation/replay fingerprint, app controller and native
input. Omission activates no camera; explicit unavailable/unauthorized identity
refuses without fallback or prompt. Changed-camera replay conflicts instead of
returning a different request’s take. Return truthful settled source/admission
facts through the existing capture lifecycle/registry, with CLI/MCP as adapters.
Capture stop does not create a project or choose composition settings.

The fresh project service now reuses the existing CaptureStore/CaptureService
allocation, private control, recovery and shared queue. Its selector-free gate is
merged-verified under21f2. Terminal capture seeds no span revision or project.
Atomic selection reuses that coordinator; final installed switching/removal remains
under23.

Preserve menu-bar recording controls, microphone/system selection and cursor
evidence. No new editing UI, start-time authoring settings, installed switch,
compatibility layer or migration is part of this checkpoint.

## Implementation checkpoints

The completed selector checkpoint joins these owners:

1. [Extract durable capture facts](21f1-capture-facts.md): the existing catalog-backed allocation, lifecycle sequencing,
   discovery and deletion fences from the mixed revision store. CaptureService
   retains control order, recovery and shutdown. The installed recording path's
   source attachment and original span creation currently share a transaction;
   preserve that atomic rollback at its editing owner. Moving it into the
   coordinator's caught notification callback would silently weaken the contract.
   Fresh capture facts create neither span revisions nor a project.
2. [Fresh-service coordination](21f2-capture-coordination.md) and its
   [durable admission seam](21f2a-capture-admission.md) are merged-verified. Reuse
   their actual control/recovery/priority and source/job discovery contracts.
3. [Atomic public camera selection](21f3-public-camera-selection.md) follows the
   selector-free gate and verified [21e](21e-capture-project-adoption.md). First
   reuse merged-verified [independent native publication authority](21f3a-independent-publication.md)
   and [independent camera clock/support](21f3b-independent-camera-clock.md);
   establish [crash-source recovery authority](21f3c-source-publication-recovery.md),
   then expose schema, allocated binding, controller input and source outcomes
   together through the complete caller-authored project path. [23f](23f-capture-source-lifetime.md)
   supplies the shared donor lifetime for cancellation after early admission.

These are internal implementation checkpoints, not parallel capture owners or
new authoring operations. Preserve the installed path until 23; physical and
completed-stop acceptance retain their separate evidence requirements.

## Work and review surface

Exercise actual isolated public CLI/MCP/service/controller paths with scripted
device boundaries and prerecorded native inputs: omitted/selected/denied/absent/
disconnected camera, pause/resume, cancel, restart, service loss, repeated
finalization and publication retry. Use existing explicit project/edit operations
for the fixture composition. Verify exact selector delivery, camera media, requested
project identity, source mapping, dependencies and independent edits.
Negative controls must fail for ignored camera ID, omitted result, zeroed offset,
changed-camera replay or duplicate source admission/requested project. Controlled wiring is not live capture
or physical synchronization acceptance.

## Acceptance

Keep the relevant [preservation gates](../verification.md#preservation-matrix) and
[single-owner rules](../architecture.md) green. Record the bounded fixture result,
source/runtime identities, failures and limitations under this child’s assets and
in the parent handoff. Prepared wiring, actual media parity and physical acceptance
are distinct verdicts. The one-frame synchronization and ten-second completed-stop
gates remain unchanged. No new capture, audible playback or installed switch.

## Visual acceptance

Judge synchronization and represented support at named retained/fixture landmarks;
styling is outside this gate. Compare full output frames and temporal crops against
the named fixture using [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md).
Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md)
as the last visual check before acceptance. Preserve shots and verdicts. Missing
physical or listening evidence remains unverified; silence cannot supply it.

## Failure boundary and discretion

Delegated: internal names, compact typed result structure and fixture organization
within the existing owners. No editorial policy, second lifecycle/catalog, silent
fallback, weakened preservation gate or fabricated physical verdict. A failure
reslices its actual owner rather than broadening into unrelated work.

User feedback changing the named contract requires updating this child and its
dependents before expansion. Existing accepted auditions and the selected 200 ms
room-tone recipe retain their exact-media scope and are not repeated here.
