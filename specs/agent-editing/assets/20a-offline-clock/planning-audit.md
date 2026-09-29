# Slice 20 camera/shared-clock prerequisite audit

Read-only audit, 2026-09-28. No capture device was enumerated or activated, no
permission prompt was requested, no app was installed, and no repository file was
changed. I read the current main source/specs and local SDK headers; no builds or
native capture tests ran. Slice 20 and 21 remain unverified.

## Recommendation

The smallest useful next pass is the planned feature-owned
`packages/test-harness/editing/camera-reproduction.mjs --case shared-clock`, backed
by a native reproduction that uses the existing ScreenRecorderCapture clock,
writer/lifecycle rules and Apple's capture APIs. First prove timestamp conversion
and separate-source plumbing with prerecorded/synthetic buffers. Then use the same
conversion seam with an explicitly selected real camera. Do not add a new capture
backend, media store, presenter compositor, generic service or production camera
operation before this measured prerequisite.

A shared coordinate is not established by subtracting the first timestamp from
each file. Convert every source PTS from its owning capture synchronization clock
to the common host clock, then apply ONE existing origin/pause map. Preserve source
PTS and converted host PTS so this strategy can be disproved by measurements.

## Existing owners and concrete constraints

- `helpers/mac/Sources/ScreenRecorderCapture/NativeCapture.swift` owns permission
  refusal, selected display/window/region, SCStream startup, optional explicitly
  selected microphone, separate system-audio SCStream, disconnection observation
  and terminal lifecycle. Microphone discovery is read-only; an unavailable named
  microphone is refused rather than silently choosing another. There is no camera
  request, discovery, input session or output path today.
- `CaptureWriter.swift` owns a serial queue for samples and controls, one
  `CaptureClock`, source-zero selection from the first usable screen frame,
  separate `video.mov`/`narration.mov`/`system.mov`, fragmented writing and journaled
  partial results. It currently treats SCStream sample PTS converted to integer
  microseconds as host time; it does not call synchronization-clock conversion.
  This is the exact assumption to instrument, not evidence of a demonstrated bug.
- `CaptureClock.swift` removes the same pause intervals for every accepted sample,
  rejects delayed/overlapping paused samples, places deferred pre-origin pauses,
  and seals elapsed source time. Existing CaptureClockTests cover those cases.
  `CaptureHostTime` in CursorGeometry.swift owns cursor/control host-time reads.
- The private TrackWriter selects video only when `role == "video"`; all other
  roles are audio. A new `camera` role cannot safely be bolted onto that string
  branch. For the reproduction, make media kind explicit at the shared writer seam
  (or a minimal explicit video writer), preserve camera's own format/dimensions,
  and audit other video-only assumptions such as held tails. Do not accidentally
  apply screen idle-frame holding to a disconnected camera.
- `CaptureJournal`, CaptureTermination, CaptureGeneration and recovery tests
  already own durable progress, stale callback rejection, partial finalization and
  restart semantics. Reuse them; do not invent a parallel recording state machine.
  Existing journal summaries are bounded; raw per-buffer observations should
  stream to a feature-owned append-only evidence file, not accumulate in memory.
- `apps/macos/Sources/ScreenRecorder/CaptureProbe.swift` is an app-identity probe,
  not a free CLI camera backend. It already accepts duration/pause parameters and
  refuses unapproved screen access. Its automatic fixture path explicitly rejects
  microphone/system audio. `scripts/native-capture-probe.mjs --fixture` IS live
  screen capture, even though the window is synthetic; it is not safe to call as
  an offline test under the present instruction.
- `apps/macos/Info.plist` has microphone and screen descriptions but no
  NSCameraUsageDescription. Public protocol capture selection/permissions/sources
  also have no camera fields. The missing camera usage description is a prerequisite
  to an authorized camera-enabled app/probe, not a reason to request permission now.
  The native package and app already target macOS 26.

## Documented clock candidate (not yet measured)

Apple says SCStream.synchronizationClock is the timebase for its output buffers
and is intended for synchronization with AVCaptureSession. AVCaptureSession's
output timestamps use its read-only synchronizationClock. Use CMSyncConvertTime
with CMClockGetHostTimeClock as the common destination; record conversion validity
and relative rate/anchor observations rather than assuming callback arrival time
is exposure/presentation time. Apple's conversion accounts for measured clock
drift; it does not prove physical sensor, display or audio pipeline alignment.

Local SDK verification resolves a misleading search-page beta badge:
SCStream.h declares synchronizationClock available macOS 13.0;
AVCaptureSession.h declares its synchronizationClock read-only, macOS 12.3.
Both are within this project's target. Do not attempt to assign a shared clock to
AVCaptureSession.synchronizationClock: it is read-only. Refuse or defer samples
when a required clock is unavailable/non-numeric, retaining the observation.

Sources (official Apple documentation):
- [SCStream synchronizationClock](https://developer.apple.com/documentation/screencapturekit/scstream/synchronizationclock)
- [AVCaptureSession synchronizationClock](https://developer.apple.com/documentation/avfoundation/avcapturesession/synchronizationclock)
- [CMSyncConvertTime](https://developer.apple.com/documentation/coremedia/cmsyncconverttime(_:from:to:))
- [Relative rate](https://developer.apple.com/documentation/coremedia/cmsyncgetrelativerate(_:relativeto:))
- [Device identity](https://developer.apple.com/documentation/avfoundation/avcapturedevice/uniqueid)
- [macOS capture authorization](https://developer.apple.com/documentation/bundleresources/requesting-authorization-for-media-capture-on-macos)

## Minimal reproduction seam and output

An explicit request supplies selected screen/window/region ID, camera uniqueID,
microphone uniqueID or an explicit disabled choice, output directory, intended
frame rate and duration/pause schedule. Camera/microphone are never selected by
first-entry/default fallback after an explicit ID fails. A device-selection-only
preflight reports identity/format/authorization without constructing capture inputs
or starting sessions. The live branch only runs after explicit capture authorization.

Use SCStream for the existing screen/microphone route and AVCaptureSession plus
AVCaptureVideoDataOutput for the selected camera. Keep microphone acquisition in
its current owner initially; a second microphone recording is not needed to test
three-source alignment. Each callback contributes raw CMTime value/timescale/epoch,
clock identity/generation, converted host timestamp, callback arrival host time,
duration, role, output source timestamp and acceptance/drop reason. Record sampled
clock conversion rate/anchor evidence at start, around pauses and periodically.
Keep callback delay diagnostic; never use it as media time.

One screen-established origin and pause ledger maps all sources. A camera that
begins later retains its positive offset; pre-origin material must not silently
re-zero the camera or change screen zero. Preserve actual support gaps, format
changes, dropped/omitted samples and interruption reasons. Emit separate raw
screen/camera/microphone assets plus manifest/journal/timestamp observations.
No camera inset, blend or inferred timeline correction is baked into pixels.

A normal end, failed camera and process interruption should yield the existing
truthful terminal/partial-result semantics. Start with the existing stop/finalize
policy on selected-device loss rather than inventing continued-screen capture as
an implicit new product policy. Freeze the measured mapping before slice 21
extends CLI/MCP selection and adopts linked project clips.

## What can be established without live capture

1. Compile-time API and request validation, unique-ID matching and honest absence/
   denial results with injected device descriptors. This does not prove TCC prompts,
   actual device enumeration or access.
2. Feed prerecorded frames/audio through the same ingestion/mapping/writer seam.
   Exercise non-zero source offsets, 29.97/30 fps, disordered callback delivery,
   delayed first usable screen frame, pauses crossing audio buffers, interrupted
   camera support and restart generations. Pin exact written PTS/endpoints and
   separate output tracks; explicitly label simulated device behavior.
3. Reuse CaptureClockTests, CaptureWriterTests, DeferredPauseTests,
   CaptureTerminationTests, CaptureJournalTests and MediaRecoveryTests. Their real
   file writer/partial recovery cases are useful, but simulated camera interruption
   is not the physical loss gate.
4. Existing `00-corpus` clips and `fixtures.mjs` have deterministic picture/audio
   markers. `audio-video-drift.mjs` demonstrates decoded flash/impulse measurements
   for exports. Reuse its measurement approach for prerecording plumbing; its
   thirty-minute edited movie is NOT evidence of hardware capture clock drift.
   The `10c` capture evidence/interruption fixtures validate retained provenance
   and source gaps, not simultaneous physical camera/screen capture.
5. Verify public asset import and independent composition placement of resulting
   prerecorded sources. Full capture-to-project production/public parity remains
   slice 21, after the native strategy is frozen.

## Exact physical test and user action still required

There is no current runnable camera option. First implement and review the small
reproduction and its permission boundary. Then present the concrete capture request
and local destination for authorization. Needed user choices/actions:

- Identify the exact camera and microphone (or confirm advertised uniqueIDs after
  read-only discovery) and the specific screen/window/region to record. Explicitly
  authorize a local simultaneous take; prior unrelated recording consent does not
  select devices for this one.
- Allow the chosen signed app/probe identity in macOS Camera, Microphone and
  Screen & System Audio Recording settings if not already authorized. The app
  needs its camera usage-description key first. The user must respond to any OS
  prompts and relaunch if macOS requires it. Do not reset TCC, silently install an
  app, or substitute another process identity to bypass denied access.
- Arrange the selected camera so it can see the selected screen's flash region
  (an external camera aimed at the monitor is simplest); the microphone must hear
  the paired audible event. If a built-in camera cannot see the screen, the user
  must choose a physical arrangement that gives all sources a common landmark.
  A generated screen flash and audible pulse can provide repeatable landmarks,
  but measured light/sound arrivals—not scheduled playback calls—are the oracle.
- Run at least ten minutes of active simultaneous capture, plus a declared pause
  interval if needed, with landmarks near start, periodically, around pause/resume
  and near end. Declare output fps in advance (e.g. 30 fps gives a 33.333…ms frame).
  Align each source pair once using its declared initial landmark offset, then
  report residuals/drift without fitting away a slope or re-aligning every event.
  Bound landmark uncertainty from camera exposure/display refresh/audio detection;
  a coarse observation cannot honestly establish a tighter one-frame threshold.
- In separate short controlled takes, physically disconnect the selected external
  camera during recording, test an unavailable selected microphone (and actual
  mic disconnect if available), exercise pause/resume and deliberately staggered
  start. Confirm explicit errors, positive offsets, truthful gaps and independently
  decodable partial files after interruption/restart. A nonexistent ID tests
  selection refusal, not physical disconnect. Denied camera is a user-controlled
  authorization scenario, not a permission reset the agent should perform.
- Inspect/listen to shared landmarks and retain synchronized context/crops and raw
  timestamp evidence for fresh critique. A tutorial take plus public independent
  replacement belongs to slice 21, not this prerequisite's initial success.

The real ten-minute take, physical interruption/permission behavior and measured
cross-source synchronization remain absent. No offline result should check slice
20 or 21 complete. The immediate implementation checkpoint can nevertheless be
fully reviewable without recording anything: request/clock observation seam,
separate prerecorded writers, deterministic replay tests and explicit live refusal.
