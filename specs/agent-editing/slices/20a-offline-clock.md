# 20a — Offline clock and separate-source plumbing

Status: partial. Controlled clock conversion/pause mapping, separate-source decode and unfinalized camera recovery verified; delivered PCM timing fails the endpoint check. Dependencies: [00](00-corpus.md).
Parent [20](20-camera-reproduction.md) remains open through real physical capture.

A feature-owned executable feeds explicit prerecorded screen/camera/audio sources
through controlled CMTimebases, Apple's clock conversion and the existing
CaptureClock pause map. Simulated rate/offset observations are not device clocks.
Production capture's timestamp interpretation remains unchanged.

Separate source directories exercise the existing MediaRecovery owner without
pretending the current writer's non-video role is a camera. This directory layout
is a probe boundary, not a new capture-to-project mapping contract. Reject live
mode without enumerating devices, starting capture or prompting for permissions.

Verify converted timestamps, non-zero offsets, completed-pause delayed deliveries,
audio spanning a pause, declared source gaps, independently decodable media and
recoverable unfinalized camera fragments. A conversion-bypass mutation must fail;
missing selected input must refuse rather than select another source. Retain raw
source PTS, simulated PTS, host conversion and mapped timestamp observations.

Use the planned `camera-reproduction.mjs --case shared-clock` harness. Keep all
writes in a caller-selected evidence directory and pin input/binary/source hashes.
The existing capture clock/recovery tests remain the production preservation gate.
Offline markers prove plumbing, never ten-minute physical drift or sensor alignment.

[Planning audit](../assets/20a-offline-clock/planning-audit.md) records the SDK/API
sources, current owner constraints and concrete physical setup. Parent20 owns the
explicit selected-camera/microphone/screen authorization and measured shared-event
capture. No live mode is necessary to make this offline checkpoint actionable.


## Banked mechanism and unresolved delivery

The executable and JS oracle convert controlled rates/offsets, preserve one shared
pause map, retain all raw observations and detect bypassed clock conversion.
Separate selected inputs decode and survive a fresh-process repeat; an
unfinalized camera fragment recovers through MediaRecovery. Missing prerecorded
microphone input refuses, and live mode is unsupported before any native work.

The current PCM output does not preserve the admitted discontinuous timeline.
Mapped audio ends at 1.700 s, decoded support at 1.588 s; the existing journal exposes
the pause-overlap hole but cannot repair packed payload positions. The receipt
therefore reports `completed: true` and `deliveredTimelinesPreserved: false`.
There is no generic pass or physical synchronization claim. [Evidence](../assets/20a-offline-clock/README.md)
separates these outcomes.

Next: reproduce the same discontinuous PCM buffers through the actual
CaptureWriter callback seam without starting SCStream, using production settings
and observed control timestamps. Compare input buffer grouping, admitted support,
container segments and decoded sample positions/values with this feature-owned
writer. Establish the causal owner before proposing a fix. Do not conceal the
hole with a new clock, invented padding, or journal-only relabelling of later audio.

The probe's role-isolated directories and offline journal headers are test evidence,
not final capture asset mapping. Native video recovery treats decodable sample
coverage as verified; audio additionally intersects its recorded support. Neither
flag makes prerecorded evidence into physical capture.
