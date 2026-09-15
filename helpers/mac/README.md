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
acquisition evidence beside the media. It owns each event's name, payload type and
durability, so the writer and the reader cannot drift apart. Identity, source clock and
pause boundaries are synchronized when written; audio sample ranges record which time
spans actually arrived. The reader retains the valid prefix after a torn final record and
keeps an unfinished pause open. Every payload decodes through its written type: a record
whose field will not decode is rejected and named by `invalidAtSequence` rather than
silently leaving a boundary empty, and nothing after it is believed. That is distinct from
`incompleteTail`, which means only that the last line has no terminator — a crash
boundary, not corruption. A clean journal ending alone does not mean a take finished.
Geometry acquisition events can use the same append owner; this layer does not
compute edit-time transforms.

[MediaRecovery](Sources/ScreenRecorderCapture/MediaRecovery.swift) decodes each
source independently and returns intervals through the worker's `media.recover`
operation. Video determines the recovered take extent. Optional audio never
shortens video, and missing media retains an explicit per-track failure. Audio the
journal header never requested is reported as an allowed absence rather than a loss;
without a header an absence stays unexplained. Recovery is read-only: package
reconciliation belongs to the service.

AVFoundation can return silence for empty audio edit-list segments and unavailable
sample durations for decoded video. Recovery excludes empty segments and clips to the
track's media range. A take's last frame has no successor to bound it, so its duration
comes from the sample cursor that states it — positioned through
[ScreenRecorderMediaTime](Sources/ScreenRecorderMediaTime), because readers report asset
time while cursors navigate media time. When no cursor confirms that sample, the recovered
interval stops at the last decoded timestamp and the track fails with `UNKNOWN_TAIL`; the
gap to the previous sample is not evidence of how long the last one lasted, and an empty
successful track is not an acceptable answer. Audio also intersects the acquisition
journal: decoder padding must not become evidence that speech was recorded. Adjacent audio
ranges coalesce within one microsecond to absorb timestamp conversion rounding. Without a
journal, physical audio ranges remain available but acquisition verification is false.

The worker returns a compact journal summary and relative journal filename;
consumers that need individual events stream that file. Types beside the reader
are the response contract. `ScreenRecorderCaptureTests` generates its own media through
AVFoundation, including an unfinalized fragmented take and a take whose edit list separates
the two time domains; the worker-level tests drive the same operation with FFmpeg-made
fixtures. FFmpeg is a development fixture dependency, not an app dependency. Real device
audio fragmentation and interruption still require capture evidence.

## Cursor sampling and capture geometry

[CursorGeometry](Sources/ScreenRecorderCapture/CursorGeometry.swift) owns pointer sampling and the
source transform. `CursorSampler` reads `NSEvent.mouseLocation` and
`NSEvent.pressedMouseButtons` on its own queue at a 60 Hz cadence, only while a take is actually
recording: pausing suspends the cadence and sealing ends it. There is no event tap, no keyboard
observation and no Accessibility authorization; screen recording permission is the only one this
adds to. The handoff to the capture queue is bounded, so a capture queue that falls far behind
refuses further readings and counts them rather than queueing without limit. Ticks the queue misses
are reported as skipped; a gap in the evidence is never filled with movement nobody observed.

AppKit reports the pointer in a bottom-left space anchored to the display at the global origin,
which is not necessarily `NSScreen.main` — that one follows the key window. `GlobalPointSpace`
converts through the zero-origin display's height, and each take journals that height whenever it
changes, so a reading can be re-derived from raw evidence.

`CaptureGeometry` is built from each delivered frame's own `SCStreamFrameInfo` attachments,
including idle and blank frames whose pixels are never written. `contentRect` places the content
inside the surface in points, `scaleFactor` converts surface points to output pixels, and
`contentScale` is the source-point to surface-point ratio: a window that grows past the surface is
letterboxed rather than rescaling the take, so fixed output dimensions do not imply fixed source
geometry. `screenRect` reports the captured window's onscreen rect; measured on this host it is the
window frame in global display points with a top-left origin, on the origin display and on a second
display whose global origin is negative. Display and region captures have no per-frame screen rect,
so the request's own global rect explains them; a region's display-local points are offset into its
display once, natively.

Geometry that differs from the current one opens the next epoch of the take, and every sample
carries the epoch it was taken under. Samples record source time, unclamped output-pixel
coordinates, the raw global point they came from, button state, eligibility and that epoch. A point
outside the capture keeps its projected coordinates and is marked `outside`: it is never pulled onto
an edge it never touched. Eligibility means the point falls inside the captured content, not that
macOS was drawing a pointer — `CGCursorIsVisible` has been unsupported since 10.9 and this recorder
never renders a cursor into the source at all.

The journal owns these records like any other acquisition evidence. Geometry epochs and cursor
batches are ordinary writes, and their file order guarantees an epoch is written before the samples
citing it. `inspect` keeps only counts, the sample range and the last geometry, so a summary never
grows with recording length; `streamCursorEvidence` streams the individual records for a consumer
that needs them.

`node scripts/cursor-geometry-lab.mjs` (`bun run lab:cursor-geometry`) records this process's own
fixture window with both audio inputs disabled, moves and resizes it, sends it to another display,
pauses and resumes, and parks it under the pointer. It then measures where the fixture's fiducial
squares actually landed in decoded video, and pairs one-shot captures of the same window with and
without a drawn pointer to measure the pointer itself. Predictions come from the native owner
through the journal; the script only locates blobs and subtracts coordinates. A one-shot capture
carries no frame metadata, so its prediction uses the take's journaled geometry at the same host
time, and the fiducials visible in both confirm the two surfaces agree. Pointer comparisons are
only valid while the pointer is still, so each one reports the drift measured around it.

## Frame inspection

[ScreenRecorderFrames](Sources/ScreenRecorderFrames) selects and decodes within a
kept interval supplied by the timeline owner. It never interprets edits. Sample
cursor timestamps belong to media time; the edit-list mappings in
[ScreenRecorderMediaTime](Sources/ScreenRecorderMediaTime) translate them into
the recording timeline before comparison, and recovery reads them through the same owner
so the two cannot disagree about where a sample sits. The selected exact native timestamp is
retained for decoding, and the response reports the actual sample time and distance.

The worker's `media.frame` request is defined by
[FrameOperation](Sources/ScreenRecorderWire/FrameOperation.swift). It writes a PNG
to a caller-allocated derivative path, validates crops against oriented dimensions,
and preserves the original even when directory aliases name it. This boundary
executes one request at a time; service-level cancellation, concurrency and caching
belong to the app-managed service.
