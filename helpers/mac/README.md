# Native capture

`ScreenRecorderCapture` owns device state, source selection, sample timing and media
writers. The app consumes `NativeCapture`; the JSON-file probe calls the same owner.
The service should invoke this object through the app's control channel and
respond to `onInterruption` by calling `stop()` to finalize and ingest partial media. The worker
executable remains separate because capture must run under the stable app identity.

`CaptureTypes.swift` is the Swift boundary. Source region coordinates are local to
the selected display, in logical points; emitted video dimensions are pixels.
Window capture follows the window through ScreenCaptureKit's independent-window
filter. System audio uses a separate whole-display stream so selecting a window
cannot silently narrow audio to that application. It excludes the recorder process.

All delivered tracks use the ScreenCaptureKit host timestamp domain. The first
complete video sample establishes source zero. Samples before source zero are
omitted. Pause intervals remove real elapsed time from all tracks, including late
samples delivered after resume. Audio buffers intersecting a pause boundary are
omitted rather than including speech recorded during the pause; their omission
contributes to omitted-sample counts. Dropped-sample counts separately report
writer backpressure; intentional pause omission does not count as an encoder stall. A pause event records its source boundary
and actual elapsed duration.

Video uses H.264 in MOV. Narration and system audio use separate float PCM MOV files.
System capture requests 48 kHz stereo from ScreenCaptureKit; microphone capture
retains the device's reported rate and channels. No app resampling or mixing occurs.
Each result reports submitted sample times, rate and channels. A submitted buffer can
extend beyond the clipped file end; those statistics are not decoded availability. Missing
requested tracks and stream failures return interrupted status, never successful
complete media. Healthy unchanged tails hold the last available frame and report
`heldTailUs`. Stopping routinely lands while the encoder is still draining, so
the held frame waits for the writer input to accept it instead of reading that
backpressure as a broken take. Only a writer that has stopped accepting samples,
or one that never drains within a bounded wait, truncates the take. An
interruption stops at the last available sample rather than inventing captured
tail media.

Hidden/minimized windows remain valid sources. ScreenCaptureKit can deliver
blank frames while a window is hidden; these are preserved as delivered, not
classified by pixel color. Visibility/acquisition metadata still needs the
geometry-journal slice before this condition is fully explained to consumers.
A closed window retained by its
application can be indistinguishable from a hidden one; the recorder does not
infer destruction from missing complete frames. Actual source destruction and
stream errors use ScreenCaptureKit's delegate signal. The native owner stops
streams and seals the clock immediately, then notifies `onInterruption`.

The app never requests permission or starts capture at ordinary launch. Probe
preflight only reads authorization. Explicit probe requests with a missing
permission fail before opening streams. The fixture command captures only its own
visible native window with both audio inputs disabled.

An explicit `--permission microphone` or `--permission screen` probe action invokes
the corresponding macOS authorization API without starting capture. This lets a
fresh installation request access before macOS exposes its permission toggle.
The future recording UI uses the same native action from its permission controls.
Denials still require the user's System Settings decision; ordinary launch and
preflight never open a permission prompt.

## Probe contract

Build the app first, then run `node scripts/native-capture-probe.mjs --preflight`
from the repository root. `--sources` lists available IDs only after authorization.
`--fixture [output-directory]` explicitly records the generated grid. `--request`
accepts a JSON file containing the following shape; `durationSeconds` includes the
pause and is bounded to one hour for this test driver:

```json
{
  "capture": {
    "source": { "kind": "window", "windowID": 123 },
    "outputDirectory": "/absolute/empty/source-directory",
    "microphone": false,
    "systemAudio": false
  },
  "durationSeconds": 6,
  "pauseAtSeconds": 2,
  "pauseSeconds": 2
}
```

The driver prints the capture result and writes `capture.json` beside media. It
returns a nonzero exit code on failures. The fixture-only optional
`closeFixtureAtSeconds` field exits a separate fixture-owner process to exercise
actual source destruction. `hideFixtureAtSeconds` and `minimizeFixtureAtSeconds`
exercise retained windows without treating them as destroyed. This is a bounded probe, not the app's
future long-lived service protocol. Do not infer microphone, source-loss, drift,
or framing acceptance from clock tests or a successful compile; those require
real captures and decoded/auditioned media.

## Recoverable acquisition

Writers emit movie fragments while recording so abrupt process termination can
leave a decodable prefix without a final stop callback. The initial fragment
limits the vulnerable opening; subsequent fragments bound ordinary unwritten
tail loss. A crash before the first fragment can leave no usable video. These
are process-crash guarantees, not a power-loss durability claim.

[CaptureJournal](Sources/ScreenRecorderCapture/CaptureJournal.swift) owns ordered
acquisition evidence beside the media. Identity, source clock and pause boundaries
are synchronized when written; audio sample ranges record which time spans actually
arrived. The reader retains the valid prefix after a torn final record and keeps
an unfinished pause open. A clean journal ending alone does not mean a take finished.
Geometry acquisition events can use the same append owner; this layer does not
compute edit-time transforms.

[MediaRecovery](Sources/ScreenRecorderCapture/MediaRecovery.swift) decodes each
source independently and returns intervals through the worker's `media.recover`
operation. Video determines the recovered take extent. Optional audio never
shortens video, and missing media retains an explicit per-track failure.
Recovery is read-only: package reconciliation belongs to the service.

AVFoundation can return silence for empty audio edit-list segments and unavailable
sample durations for decoded video. Recovery excludes empty segments, uses the
last decoded video's sample cursor for its duration, and clips to the track's
media range. Audio also intersects the acquisition journal: decoder padding must
not become evidence that speech was recorded. Adjacent audio ranges coalesce
within one microsecond to absorb timestamp conversion rounding. Without a journal,
physical audio ranges remain available but acquisition verification is false.

The worker returns a compact journal summary and relative journal filename;
consumers that need individual events stream that file. Types beside the reader
are the response contract. Native recovery tests drive the worker with FFmpeg-made
media fixtures; FFmpeg is a development fixture dependency, not an app dependency.
Real device audio fragmentation and interruption still require capture evidence.

## Frame inspection

[ScreenRecorderFrames](Sources/ScreenRecorderFrames) selects and decodes within a
kept interval supplied by the timeline owner. It never interprets edits. Sample
cursor timestamps belong to media time; edit-list mappings translate them into
the recording timeline before comparison. The selected exact native timestamp is
retained for decoding, and the response reports the actual sample time and distance.

The worker's `media.frame` request is defined by
[FrameOperation](Sources/ScreenRecorderWire/FrameOperation.swift). It writes a PNG
to a caller-allocated derivative path, validates crops against oriented dimensions,
and preserves the original even when directory aliases name it. This boundary
executes one request at a time; service-level cancellation, concurrency and caching
belong to the app-managed service.
