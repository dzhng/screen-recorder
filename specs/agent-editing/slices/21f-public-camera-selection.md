# 21f — Complete public selected-camera integration

Status: planned isolated implementation. Dependencies: [21a](21a-camera-discovery.md), [21c](21c-selected-camera-input.md) and [21e](21e-capture-project-adoption.md).
Physical acceptance remains under [20](20-camera-reproduction.md) and parent [21](21-webcam.md).

## Contract

An advertised optional camera selector reaches the complete input, source-result,
finalization and project path through CLI and MCP. No accepted selector is ignored.

## Seam and ownership

Add `cameraDeviceId` atomically across the existing protocol selection/native
start shapes, service allocation/replay fingerprint, app controller and native
input. Omission activates no camera; explicit unavailable/unauthorized identity
refuses without fallback or prompt. Changed-camera replay conflicts instead of
returning a different request’s take. Return truthful settled source/project facts
through the existing capture lifecycle/registry, with CLI/MCP as adapters.

Preserve menu-bar recording controls, microphone/system selection and cursor
evidence. No new editing UI, start-time authoring settings, installed switch,
compatibility layer or migration is part of this checkpoint.

## Work and review surface

Exercise actual isolated public CLI/MCP/service/controller paths with scripted
device boundaries and prerecorded native inputs: omitted/selected/denied/absent/
disconnected camera, pause/resume, cancel, restart, service loss, repeated
finalization and publication retry. Verify exact selector delivery, camera media,
project identity, source mapping, dependencies and explicit independent edits.
Negative controls must fail for ignored camera ID, omitted result, zeroed offset,
changed-camera replay or duplicate project. Controlled wiring is not live capture
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
