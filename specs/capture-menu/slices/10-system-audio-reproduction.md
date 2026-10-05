# 10 — System audio without screen-video reproduction

Status: TODO. Dependencies: 08; 09 supplies narration expectations but this probe can keep microphone off.

## Contract

Prove the existing whole-system audio substream can accompany a camera primary without producing screen-video media. This is a bounded platform reproduction, before production integration.

## API seam and ownership

Reproduce the current CaptureInputSession audio-only SCStream configuration/output registration and use the current clock/PCM owners. It may use display metadata and explicit screen/system-audio authorization for the requested system sound. With system sound off, the camera path must touch none of those boundaries. No .screen output, screen-video sample writer or screen file is permitted; internal platform rendering is not claimed to be absent. Do not introduce a Core Audio tap backend or a second permanent recorder.

## Runnable or reviewable artifact

An explicit proposed camera-system-audio reproduction uses caller-owned evidence and a bounded take. Record request/source IDs, authorization, SDK streams/output types, actual callbacks, host conversions, source members/decoded tracks and shutdown. A controlled supplied audio signal is preferred over live ambient/system content; do not play sound or take desktop focus during ordinary automated runs.

## Verification and what stays green

Read the existing CameraReproduction/native probe owners first; reuse or extend their explicit fixture seam rather than create a new package. Establish denied-required-access refusal, authorized whole-system scope, disabled-path no IO, pause/resume PCM omission and joined stop/cancel. Freeze successful code/dependencies/configuration/inputs/report/media by SHA-256 before 11. One unchanged failure is retained, not retried indefinitely. Pass only with camera primary plus requested system PCM and no screen-video output. Failure requires reslicing this branch and disclosing any capability/scope tradeoff; it does not authorize silent screen capture or silently dropping system audio.

This slice requires no visual shot. If a visual artifact is added, declare its variable/crop and apply compare-screenshots where a target exists, then unprimed screenshot-critique as the last visual acceptance check and non-blocking preview-shots review, per [verification.md](../verification.md).

## Delegation and feedback boundary

Probe naming, evidence encoding and existing-runner extension are delegated. System sound meaning, no-screen-video-output requirement, resource drain and explicit authorization are fixed. No recording of unrelated personal media is needed; use controlled fixtures wherever possible.

Human feedback changes this slice when it revises the stated contract or reveals a concrete native constraint. Record that change in the owning spec; do not silently absorb it into unrelated work. Routine reversible review does not block implementation. Update the README Next Agent Prompt and this slice's evidence/status before ending a pass.
