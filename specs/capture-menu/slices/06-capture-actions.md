# 06 — Capture actions and inline state

Status: TODO. Dependencies: 04, 05, 08, 09 and 11; first native geometry fixture remains usable before acquisition completes.

## Contract

Unlock the real menu capture flow using the existing state/action owner. The question is correct action applicability and understandable recovery across lifecycle states.

## API seam and ownership

Bind Display/Window/Area/Camera Only, camera/device rows, microphone/system sound/countdown, transport, Settings, Quit and Open Library directly to ControlsState and ControlsAction through RecordingControls.perform. Area uses existing region picking. Camera is optional for screen takes, required for camera primary; no-camera/unavailable selection shows inline reason. Source/audio input mutations are rejected in shared actions while a take is starting/live/finalizing, not merely disabled in the view. Idle defaults retain protocol/preferences meaning. Countdown remains persisted by Preferences, but its popover and Settings edits use one shared recording-default action/snapshot. Replace SettingsModel's independent direct countdown write when the new consumer arrives; both open surfaces must reflect the same setting. Changing that default never alters an already-running countdown or take. Countdown cancel allocates no take. Native elapsed time drives transport; no UI clock or view-owned lifecycle. Keep pause/resume/finish/restart/cancel and unanswered-start identities.

## Runnable or reviewable artifact

The real popover uses production facts in idle, countdown, recording, paused, selecting, service unavailable, camera denied/disconnected and finalization states. Shortcut failures reveal their inline reason. The fixture and app use identical components/actions.

## Verification and what stays green

Invoke write-tests and extend controls SelectionTests/MenuStateTests/SettingsTests/OverlayTests plus recording-controls.test.mjs where the old menu interface changes. Test locked inputs for an externally started take, explicit camera choice, optional-camera off, required-camera state, countdown cancel, menu/Settings countdown default agreement and persistence without changing an active countdown, stale selection, permission actions and exact transport/retry targets. Keep Settings/shortcuts/overlay semantics green. Capture publication remains authoritative: a failed sibling or unresolved start cannot become Ready merely because a button completed.

## Visual variable and crop

State and recovery legibility only. Crop selected-source/device-required row, inline permission/service/finalization block and complete transport block. Compare corresponding sharp concept states; all controls remain inside the scrollable/reachable surface. Geometry is frozen and palette waits for 12.

Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named frozen target and native before/after where applicable, recording measurements and a verdict. Resolve discrepancies, then run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Follow the full sequence in [verification.md](../verification.md). Show shots with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); this review is **non-blocking**, about five minutes while independent work continues. If silent, record an evidence-based decision, close Preview and proceed.

## Delegation and feedback boundary

Native chooser/menu presentation, tooltips, error wrapping and keyboard order are delegated. No automatic permission request on opening; no camera preview/PIP, automatic retry, source substitution or editorial project. If a new source-specific capability mechanism is needed, reslice instead of inventing a parallel readiness model.

Human feedback changes this slice when it revises the stated contract or reveals a concrete native constraint. Record that change in the owning spec; do not silently absorb it into unrelated work. Routine reversible review does not block implementation. Update the README Next Agent Prompt and this slice's evidence/status before ending a pass.
