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
Each result reports actual first/last sample times, rate and channels. Missing
requested tracks and stream failures return interrupted status, never successful
complete media. Healthy unchanged tails hold the last available frame and report
`heldTailUs`. An interruption stops at the last available sample rather than
inventing captured tail media. Abrupt termination recovery belongs to the
capture-journal slice.

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
