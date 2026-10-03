# Physical flash and beep evidence

The retained [screen/camera fixture](../../../../../fixtures/screen-camera-timing/README.md)
contains observable flashes and microphone beeps. This evidence separates that
physical correspondence from timestamp bookkeeping and from ordinary media import.
It does **not** pass the 33 ms residual bound or establish whole-take camera sync.

[The report](summary.json) owns the source hashes, event pairings, one initial
calibration per source comparison, measured residuals and uncertainty brackets.
Camera flashes 2–16 provide about 70 seconds of strong visible-patch evidence;
later slivers are retained separately and excluded from that result. Camera numbers
were not individually OCR-verified: the early visible number and five-second cadence
associate the sequence with the screen events. The [clipped marker](flash17.png)
and [brief later return](candidate38.png) illustrate why visibility limits the claim.

The microphone has fifty matched beeps across approximately 245 seconds of admitted
media. Frequency controls distinguish the 1 kHz signal from nearby frequencies;
full-rate controls also rule out aliases introduced by the cheap initial sampling.
Subtracting only the first matching event leaves worst measured camera and microphone
residuals of 48.29 ms and 57.16 ms. Frame intervals and detector windows make those
measurements uncertain; the retained brackets do not establish a 33 ms bound.

## Coordinates and physical payload

Visual timestamps are FFmpeg `-copyts` decoded-frame PTS. They differ from the
native import's normalized timing. Initial offsets therefore include decoder
interpretation and must not be presented as product playback latency. No fitted
slope, time stretch, median recentering or later recalibration was used.

Direct `mdat` extraction is valid **only for this frozen microphone file**: its
only stream is `pcm_f32le`, and the capture journal declares mono interleaved
float32 little-endian samples at 48 kHz. Concatenated payload bytes exactly match
23,823 contiguous physical append records: 12,197,376 frames, or 254.112 seconds.
Declared and physical frame positions coincide, with no journal gaps. Source time
adds the recorded 142,041 microsecond phase to the packed sample time. The extractor
checks these facts; it is not an arbitrary-container decoder or an admission path.

The native import exposes only packed frames `[0, 12048384)`: 251.008 seconds.
Journal mapping puts that end at source time 251.150041 seconds; the remaining
148,992 physical frames (3.104 seconds) are outside admitted support. The physical payload includes a
zero-size final `mdat` extending to EOF and an additional beep beyond that admitted
interval. That last event is preserved but excluded from comparisons. Extra payload
is not proof of native playback support, finalized recovery, or a canonical movie.
The original fixture remains untouched.

## Reproduction and review

[Scripts](scripts) are fixture-specific research evidence. They accept a fixture
root and scratch output directory (`visual-samples.py`, `pcm-payload.py`,
`audio-events.py`), or just that output directory (the remaining scripts). Run PCM
payload extraction before audio event/control analysis and visual sampling before
visual event analysis. `visual-events.py --slivers` means passing `--slivers`
after its scratch directory to retain the supplementary lower-threshold candidates.
`summarize.py` recalculates the numerical tables into a new
scratch report; the retained report additionally records source identity and review
limitations. Python's native float array assumes the little-endian host used here.
No script captures devices, prepares models, or changes source media.

[Compressed telemetry](telemetry) retains decoded brightness, PTS logs and complete
audio detector windows. The compact event/control JSON retains the accepted and
supplementary detections. The long unrelated screen whitening and ambiguous moving
camera candidates are excluded explicitly rather than counted as timing signals.
Source identities tie all results to the existing fixture, so derived PCM and a
second copy of the recordings are unnecessary.

Review kept this as evidence only: no production API, generalized test framework,
or fixture mutation was introduced. The 70-second camera visibility limit and the
physical/admitted audio difference remain unresolved limitations, not green gates.
