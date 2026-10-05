# 08 — Camera primary device and clock

Status: TODO. Dependencies: 02, 04.

User scope update: finish with live-device checks UNVERIFIED and keep verification
lean. Physical/frozen-reproduction and expanded fixture gates below no longer
block implementation. Reuse existing acquisition/audio owners; app compilation
and a quick UI review are the final checks. Do not add verification machinery.

## Contract

Unlock Camera Only video through the production native input path, without screen IO or cursor sampling. The question is selected-camera acquisition, source zero and joined device lifetime.

## API seam and ownership

Use NativeCapture/CaptureInputPreparation/CaptureInputSession as existing acquisition and termination owners. Reuse the exact selected AVFoundation camera/session seam and normalized primary-video ingress from 02. First usable delivered camera-primary picture establishes primary zero through CaptureClock; convert timestamps using the session synchronization clock into host time. Camera-primary dimensions come from the selected format; no screen geometry/cursor evidence is fabricated. For this gate both audio choices are false. Do not allocate an empty primary plus camera sibling or a second CameraWriter for the same pictures.

## Runnable or reviewable artifact

A proposed PrimaryCameraInputTests.swift fixture drives production NativeCapture start/pause/resume/finish/discard/interruption with prerecorded asymmetric frames and scripted session/loss. Then one scoped physical camera-only confirmation can establish device/SDK behavior not proven by the fixture.

## Verification and what stays green

Test first: exact selected device; disabled/denied/missing camera opens no IO; screen denied and audio off performs no screen authorization/shareable-content/SCStream preparation; no first video leaves elapsed/origin unavailable; first usable primary video establishes zero; writer acceptance/backpressure and published availability remain separate facts; pre-origin pauses and delayed paused callbacks preserve omission; unavailable clock refuses; format/dimension change cannot silently corrupt or reinterpret the fixed-format take; cancellation/delayed SDK start drains exactly once; disconnect/interruption stops at available support; healthy held tail preserves current policy; recovery/admission sees only primary media. Keep NativeCaptureInputTests, CaptureClockTests, DeferredPauseTests, CaptureTerminationTests and independent companion camera origins/publication green. Decode fixture pictures to check orientation/content, not just file existence.

This slice requires no visual shot. If a visual artifact is added, declare its variable/crop and apply compare-screenshots where a target exists, then unprimed screenshot-critique as the last visual acceptance check and non-blocking preview-shots review, per [verification.md](../verification.md).

## Delegation and feedback boundary

Session plumbing/private ingress names and equivalent safe format selection are delegated. No mirrored/cropped/retimed camera treatment, audio mixing or new clock/lifecycle/publication owner. A physical permission absence leaves that confirmation OPEN; fixtures cannot certify live capture.

Human feedback changes this slice when it revises the stated contract or reveals a concrete native constraint. Record that change in the owning spec; do not silently absorb it into unrelated work. Routine reversible review does not block implementation. Update the README Next Agent Prompt and this slice's evidence/status before ending a pass.
