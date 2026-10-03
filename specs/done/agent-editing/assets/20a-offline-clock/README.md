# Offline camera-clock prerequisite: partial result

This is an executable prerequisite, not accepted camera capture. The
[run report](run/report.json) says `completed: true` and
`deliveredTimelinesPreserved: false`. No device discovery, capture start,
permission request, app installation or production timestamp change occurred.
Parent 20 and 21 remain open; 20a is partial.

Run `node packages/test-harness/editing/camera-reproduction.mjs --case shared-clock
--out /tmp/your-empty-output`. The harness builds the feature-owned Swift executable,
or accepts an explicit `SCREENREC_CAMERA_PROBE` binary. `--live` refuses before
native execution or output-directory creation. Inputs are the existing hashed
00-corpus screen/camera-role clips and audio file, explicitly named in the request.
The roles describe simulations, not real devices.

## Banked mechanisms

Controlled CMTimebases model distinct rates/offsets. CMSyncConvertTime maps them
to host time, then the existing CaptureClock supplies one source origin and pause
map. Raw media timestamps, simulated clock PTS, converted host times, interval
lengths and admitted/omitted results stream to JSONL. A JS fixture oracle independently
checks expected offsets and pause-overlap omission. Bypassing conversion refuses;
a missing selected prerecorded microphone refuses without choosing another input.
A fresh process reproduces the same mapping and recovered support.

Separate screen and camera movies retain distinct source dimensions and actual
presentation timestamps. The microphone uses its own PCM MOV. MediaRecovery
inspects each role-isolated directory and a copy of an unfinalized camera fragment.
The partial fragment has real decodable samples; the writer was still writing
when copied. This is an offline crash-file surrogate, not physical disconnection
or process-kill capture proof. The directory layout is not the future project's
capture asset mapping contract.

The actual CaptureJournal records the simulated origin, pauses and admitted audio
support. Its recovery flags refer to that evidence and media decoding, not real
sensor acquisition. Video recovery may include decoder-generated samples; frame
counts are not treated as captured-camera counts. Actual delivered video PTS are
also independently checked through ffprobe. No presenter is flattened into pixels.

## Unresolved delivery observation

The audio samples admitted after the simulated pause end at 1,700,000 us, but decoded
PCM support ends at 1,588,000 us. Journal intersection preserves the declared gap as
[100,000,782,667) and [894,667,1,588,000); it cannot restore the late payload's
intended positions or missing endpoint. Receipt timestamps alone are insufficient.
The report explicitly rejects delivered timeline preservation rather than treating
successful decoding or clock conversion as synchronization acceptance.

The probe matches production's MOV container, Float32 PCM output settings,
real-time input flag, microsecond movie timescale and five-second/one-second
fragment intervals. It still uses AVAssetReader's prerecorded buffer grouping and
a small feature-owned writer, not CaptureWriter callbacks or actual hardware.
Therefore this is not yet a production bug claim. The next causal reproduction
must feed equivalent discontinuous samples through the actual CaptureWriter owner,
compare grouping, segment tables, sample values/timestamps and acquired support,
and identify the cause before changing production. Do not add padding, a second
timeline or a journal remap to make shifted payload appear correct.

## Verification and limits

The native probe builds, conversion-bypass/missing-input/live negatives refuse,
and the existing ScreenRecorderCaptureTests executable passes its clock, journal,
writer, deferred-pause, termination and recovery checks. Independent read-only code
review found no actionable defect in this deliberately partial scope; it explicitly
kept PCM delivery unaccepted. Logs and raw JSONL are gzip-compressed without byte
changes. No visual synchronization or listening pass is claimed for prerecorded
sources; they cannot establish physical latency or drift.

[The retained audit](planning-audit.md) contains official Apple API links and exact
physical setup/authorization requirements. Local SDK declarations are in
[sdk-availability.txt](sdk-availability.txt): SCStream synchronizationClock is
available from macOS 13, AVCaptureSession's read-only synchronizationClock from 12.3,
within this project's macOS 26 target. The executable typechecks both getter APIs
without constructing a live capture source. Real ten-minute simultaneous capture,
shared-event residual drift after one initial offset, actual loss/denial and
capture-to-project production parity all remain required by 20/21.

## Reviewed choices

CMTimebases are controlled simulations so conversion can be tested without opening
devices; they do not stand in for measured hardware clocks. CaptureClock and
MediaRecovery remain the existing owners. A bounded writer loop and streamed
observations avoid an unbounded buffer cache. Role-isolated directories let the
existing recovery seam inspect separate files without changing production's
video-versus-audio role assumptions. No live mode was added because an offline
reproduction does not need an unauthorized activation path. The partial PCM
failure is retained as the next question, not normalized into a passing fixture.
