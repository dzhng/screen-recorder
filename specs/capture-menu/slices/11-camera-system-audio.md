# 11 — Production camera-primary system audio

Status: TODO. Dependencies: 10 passed/frozen; 09.

## Contract

Unlock the proved system-sound path through normal capture.start and restart, with parity to the reproduction. The question is production integration preserving the passed platform contract.

## API seam and ownership

Extract/reuse the existing whole-system audio input under CaptureInputSession so screen and camera primaries share one audio acquisition/configuration owner. Bind it to current host-clock/PCM writer/publication and NativeCapture termination. Keep requested narration/system media independent. Screen access is required only when the proved system-sound path needs it; inline explanation must name system sound as the reason on Camera Only.

## Runnable or reviewable artifact

A proposed CameraPrimarySystemAudioTests.swift fixture and matched public/native production journey compare against frozen slice-10 requests and outputs. Differences may be managed allocation IDs/directories and presentation, never source scope, selection, timing or teardown.

## Verification and what stays green

Invoke write-tests; compare computed request, stream/output inventory, callback roles, canonical members, decoded support/PCM and complete lifecycle against 10 before another physical run. Verify disabled sound avoids screen discovery/access; enabled denied access fails honestly; requested whole-system scope survives window/source changes; pause/disconnect/start cancellation/service loss joins resources; replay never starts twice. Keep existing screen-system-audio and companion camera cases green. Remove reproduction-only routing from production; retain the deliberately invoked evidence probe as an independent oracle, not a parallel recorder.

This slice requires no visual shot. If a visual artifact is added, declare its variable/crop and apply compare-screenshots where a target exists, then unprimed screenshot-critique as the last visual acceptance check and non-blocking preview-shots review, per [verification.md](../verification.md).

## Delegation and feedback boundary

Internal shared audio-input factoring is delegated; the accepted reproduction fixes acquisition/configuration behavior. No migration, unrequested screen media, fallback backend or automatic media treatment. If production cannot reproduce the frozen outcome, reslice before broadening the change.

Human feedback changes this slice when it revises the stated contract or reveals a concrete native constraint. Record that change in the owning spec; do not silently absorb it into unrelated work. Routine reversible review does not block implementation. Update the README Next Agent Prompt and this slice's evidence/status before ending a pass.
