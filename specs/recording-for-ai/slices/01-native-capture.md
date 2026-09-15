# 01 — Native capture and separate audio

Status: partial implementation on `implement/native-capture`, not yet integrated
or accepted. Dependencies: 00. Own-window video probes do not close the separate
display, region, microphone, system-audio and A/V timing gates.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

## Contract and API seam

Record each promised source type with separate narration/system audio and a canonical source clock.

Implement a minimal capture probe in helpers/mac and run it through the stable native app identity. ScreenCaptureKit delivers screen/audio/microphone samples; AVAssetWriter writes clean video and separate labeled audio tracks. Set 30 fps, SDR and the capture resolution ceiling. Implement the native clock mapping, including pause/resume sample retiming and real elapsed pause events. No library service or editing UI yet.

## Runnable checkpoint

Run bun run lab:capture. Select display, window, region; narrate a short labeled fixture and play browser tones through headphones. Record, pause, resume and stop. Decode each track, inspect media time metadata, and listen to isolated narration/system audio. Deny permissions once and disconnect a selected microphone/source.

## Acceptance

All three source choices work. Pause contributes no media/cursor time and an explicit event; a five-minute fixture meets timing target in verification.md. Permissions/source loss produce clear errors without claiming usable complete media. System audio is labeled whole-system, not tab-only isolation. Document the actual track offsets and any resampling.

Source-loss detection must preserve valid hidden, minimized and static windows.
Lack of new frames or offscreen status alone is not destruction. Exercise actual
source-owner exit separately from hiding/minimizing. Use the native stream failure
signal for observable loss; document cases where the OS retains a closed window
and cannot distinguish it from a hidden live source. Healthy static tails may hold
the last frame with an explicit duration; failed recordings retain only their valid
prefix. Do not introduce an inactivity timeout just to make a loss fixture pass.

## Decisions delegated and scope firewall

Native encoder buffering and AVFoundation internals are delegated. If SCK microphone is unusable, a separate AVAudioEngine capture branch must prove clock alignment before promotion. No silent downgrade to one mixed track.

## Visual review

Capture framing/readability only; cursor overlay and menu styling are out of scope. Compare the captured asymmetric grid with the browser source at a matched crop, then screenshot-critique last.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

A failed source/audio case changes the native implementation, not capture scope. Retain a minimal reproduction and reslice that boundary before depending on it.
