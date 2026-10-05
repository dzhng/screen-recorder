# 09 — Camera-primary microphone audio

Status: TODO. Dependencies: 08.

User scope update: finish with live-device checks UNVERIFIED and keep verification
lean. Physical/frozen-reproduction and expanded fixture gates below no longer
block implementation. Reuse existing acquisition/audio owners; app compilation
and a quick UI review are the final checks. Do not add verification machinery.

## Contract

Unlock requested narration beside camera-primary video with no screen permission dependency. The question is preserving selected microphone PCM and its camera-relative timing.

## API seam and ownership

Add requested AVFoundation microphone output under the existing input-session lifetime, using exact selected device or existing system-default meaning. Convert its output clock through the shared host ingress and append to current primary narration/PCM publication. The primary camera video establishes zero; audio does not. Disabled microphone opens no audio device. Keep current missing-selected-microphone preference semantics; do not rewrite the preference while choosing a fallback for a different contract.

## Runnable or reviewable artifact

A proposed CameraPrimaryNarrationTests.swift scenario supplies authored sample times/PCM values through the production input/clock/writer boundary. A small decoded report shows before-zero omission, pause crossing omission and preserved accepted PCM. A scoped camera/mic device reproduction confirms clock mapping only after deterministic gates pass.

## Verification and what stays green

Invoke write-tests. Check selected/default/off inputs, denied/missing/disconnected microphone, delegate routing that distinguishes AVFoundation audio versus video outputs, first-video timing, buffers before zero, crossing a pause and delivered after resume, exact decoded PCM identity/support, interrupted finish and retry/recovery. Keep PCMJournalTests, CaptureAudioPublicationTests, source admission and source-lifetime checks green. Physical output gets focused frame/audio inspection; do not generate an editing project or retime/mix sources to make sync pass.

This slice requires no visual shot. If a visual artifact is added, declare its variable/crop and apply compare-screenshots where a target exists, then unprimed screenshot-critique as the last visual acceptance check and non-blocking preview-shots review, per [verification.md](../verification.md).

## Delegation and feedback boundary

Use the same AVFoundation session for camera/microphone when supported; private session factoring is delegated if it preserves the same host/termination contract. Separate source media and original PCM identity are fixed. The permitted audio-format choice follows existing capture defaults; no new automatic gain/noise processing.

Human feedback changes this slice when it revises the stated contract or reveals a concrete native constraint. Record that change in the owning spec; do not silently absorb it into unrelated work. Routine reversible review does not block implementation. Update the README Next Agent Prompt and this slice's evidence/status before ending a pass.
