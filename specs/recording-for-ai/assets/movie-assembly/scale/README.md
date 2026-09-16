# Five-minute encoded A/V clock and memory proof

Generated media only. The production worker was built in an isolated worktree
from merged source revision `060b9ef44d58222728c30b8f7590f17f7a50e54a`, including
presentation traversal and movie assembly. The reports pin its SHA-256, OS,
FFmpeg version, source hashes and actual plans. No production change was needed.

The [final report](report.json) and [replicate](replicate.json) contain two complete
short/long measurements. Both use the same five-minute source files per run:
sparse one-frame-per-second video, mono 48 kHz AAC narration with encoded priming,
and stereo 44.1 kHz PCM system audio. Native-generated empty container edits remove
[4,5) and [151,153) seconds from video/system audio without moving source time.
Separate acquisition evidence includes missing narration/system intervals.

The real `RevisionStore`, `SourceEvidenceStore` and shared `planAudioTracks` resolve
all inputs. The same core revision drives native video spans and audio acquisition.
The long plan contains two middle cuts with fractional microsecond boundaries.
A bounded full-stream WAVE sink supplies a lossless numerical reference; this is
an optional test mode, not a larger public excerpt or another mixer.

## What passed

- Every video presentation timestamp matches the expected kept-source support:
  ten frames in the control and 299 in the long movie, maximum error **0 µs**.
  Binary-coded generated frame identities also match at the beginning, joins,
  gaps and far end. Empty video edits decode as the previously specified black.
- All eight long audio windows select **zero sample lag** against the shared PCM
  reference, including both joins and source time 299.5 seconds. Independent
  generated-signal phase/mix checks at the beginning, far end and both types of
  gaps prevent a shared mixer/decoder error from being mistaken for agreement.
- The long native decode holds **14,366,720 frames** at 48 kHz. Its exact movie/video
  duration is **299,306,670 µs**; audio presentation ends 3⅓ µs earlier, reflecting
  the existing cumulative sample rounding. FFmpeg returns 960 extra raw samples
  of codec padding, which are outside the audio presentation interval.
- Acquisition and container-gap unavailable ranges remain exact in both audio
  track reports. All original generated source SHA-256 hashes remain unchanged.

The native RSS peaks were approximately **52 MB short / 57 MB long** in both runs,
with only about 5 MB growth over a thirtyfold increase in retained duration. The
predeclared bound is `long <= short * 1.5 + 16 MiB`; it would expose accumulating
this stereo stream in memory. `/usr/bin/time -l` measures only the production
worker process. It excludes the JavaScript/decoder/reference harness, OS file
cache and separate system media services. This is not a system-wide GPU-memory
or maximum-resolution benchmark. Reported render wall times are diagnostic;
other machine activity is uncontrolled.

This proves encoded-media timing, **not five minutes of physical playback**,
audio-device latency, listening quality or adjacent-speech intelligibility. The
existing tiny-AAC consumer caveat remains; these ordinary-duration files do not
resolve every possible external decoder's behavior.

## Reproduce

Build protocol/core and native `screenrec-native` plus `ScreenRecorderAudioTests`.
Run `SCREENREC_MOVIE_SCALE_EVIDENCE=/absolute/empty/directory node packages/test-harness/movie-scale.mjs`.
It generates its own media, compiles small AVFoundation fixture/inspection helpers,
measures the real worker, and independently decodes the results. Full sources,
PCM references and five-minute output stay in that scratch directory; report file
names are relative to it. The committed [short control](control.mp4) demonstrates
the first cut and gap without storing hundreds of megabytes of reproducible media.

The final video-PTS and raw AAC-tail checks can also be applied to already-retained
outputs without rerendering; those post-render observations do not change the
recorded worker memory/time measurement. Existing native audio regression checks
remain separate from this optional duration-scale harness.

The final end-to-end harness run passed after adding the complete video timestamp
and raw AAC-tail gates. The existing native audio suite also passed, including
its exact thirty-second boundary and 27 invalid-input cases. Independent Codex
review found no actionable defects; it ran no media workloads and changed no files.
