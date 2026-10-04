# Sequential video rendering checkpoint

The native video-only worker renders the core's pinned plan through one sequential
reader and writer. This is the first implementation checkpoint for
[13a](https://github.com/dzhng/screen-recorder/blob/2e1028cddc3f89d58018a4ebcbc8895b28a78ae1/specs/recording-for-ai/slices/13a-native-render-timing.md), not the completed preview/export
feature. Source files, source gap evidence and package timelines remain unchanged.

## Empty edits describe absent imagery; opaque movies need an appearance

A running default AVPlayerView was captured in an owned window before, during and
after a generated empty edit. No background color was configured. All captured
states are retained in `window-initial/`, `window-source/`, `window-rendered/` and the final
`window-reproduction/`;
each capture ledger brackets the screenshot with actual player times. The initial
source has a four-second gap; the reproducible source and rendered comparison have
a two-second gap. The content region is visibly black during all three gap captures,
with no residual frame. [Pixel metrics](window-pixel-metrics.json) measure zero in
every RGB channel of the declared rectangular interior. The title bar and rounded
window corners are excluded from those metrics, not hidden from the full images.

The export rule is therefore explicit: **opaque H.264 MP4 renders proven empty
track edits as opaque black**, matching this measured standard-player appearance.
It does not claim that the source contains black samples, that a nil output buffer
is inherently black, or that arbitrary player backgrounds must be black. Unknown
sample support still fails; it is never turned into either black or a held image.
The preceding [player-output measurements](../render-membership/review.md) distinguish
no-display references from decoder-produced duplicate images.

## Why use timed samples rather than passthrough edits

AVFoundation passthrough MP4 assembly preserves the internal empty-edit map and
AVPlayer clears at its boundaries. But the retained `same-encoder.mp4` exposes
interoperability limits: AVFoundation plays 5.03 seconds while FFmpeg reports 1.03
seconds and duplicates samples across internal edits. The matching FFmpeg ledgers
and [player ledger](assembly-playback.json) are retained. FFmpeg
[8.1.2's demuxer](https://raw.githubusercontent.com/FFmpeg/FFmpeg/n8.1.2/libavformat/mov.c)
specially skips only leading empty edits and clamps reported duration against media
duration. This explains why raw decoding is not a reliable empty-edit presentation
oracle. A trailing empty edit also disappears from AVFoundation export:
`trailing.mp4` is one second despite requesting one second of media followed by two
seconds empty. The SDK documents that inserting empty time at a composition's end
is unsupported; assigning a trailing empty track segment did not change the result.
No custom container writer is introduced to work around these platform limits.

The sequential writer encodes actual images and the measured opaque gap appearance.
Each CMSampleBuffer carries its retained duration and presentation time. This matters:
timestamp-only pixel-buffer append plus `endSession` can report the expected asset
duration while assigning the last sample an inferred shorter duration. The first
native tests exposed 1.0 versus 1.5 seconds for a trailing gap and a two-microsecond
shortfall across fractional cuts. Explicit sample durations fixed both; the same
independent decoder checks now pass. Cuts retain exact integer-microsecond plan
boundaries; sample PTS rounding is measured within one microsecond.

## Evidence and bounds

[The native tests](../../../../../helpers/mac/Tests/video-render.test.mjs) generate
asymmetric frame IDs, submit actual core render plans through `media.renderVideo`,
and independently decode output. [Receipts](report.json) retain the pixel identities,
PTS and exact durations for original, middle cuts, one-microsecond/sub-frame spans,
sparse support and leading/internal/trailing/only-empty outputs. Source hashes and
short playable inputs/outputs are alongside this report. Existing still-image
selection remains stricter about PTS membership and is unchanged.

[Streaming measurements](bounded-streaming.json) used the same 120-second generated
384×216, 30-fps source, retaining either ten seconds or all 120 seconds. Native process
maximum RSS was 41,385,984 and 42,024,960 bytes for 300 and 3,600 emitted samples;
elapsed times were 1.69 and 7.50 seconds. This is evidence of bounded decoded memory
at this size, not a release performance claim. The implementation keeps one decoded
sample, bounds its output pixel pool and disables Core Image intermediate caching.
It does not retain a whole movie of pixel buffers or perform PNG seeks per frame.

Output publication uses a private staging directory and an exclusive hard link.
An actual concurrent-destination regression creates a sentinel while a thousand-span
render is active: publication refuses it, preserves the sentinel and removes staging.
An independent code review found the original unsafe cleanup race; focused follow-up
review confirmed the fix. The [final visual review](visual-review.md) records residual color differences.

Reproduce after building core and the native worker:

```
node --test helpers/mac/Tests/video-render.test.mjs
SCREENREC_RENDER_PLAYBACK=1 SCREENREC_RENDER_WINDOW=1 node helpers/mac/Tests/render-membership.mjs
```

The second command opens only an owned generated-video window. The first can retain
its full generated fixture directory by setting `SCREENREC_VIDEO_RENDER_EVIDENCE`
to an absolute empty directory. The scale source was generated with FFmpeg's
`testsrc2=size=384x216:rate=30:duration=120`, H.264 ultrafast, yuv420p and no audio;
`/usr/bin/time -l` measured the native worker directly.

## Remaining gates

The native build and 19 focused native frame/visual/wire/render regressions pass.
On integration, rebuilding the root debug helper resolved a stale-binary
`UNKNOWN_OPERATION` result; all twelve renderer regressions then passed against
the merged source. The seven adjacent frame, visual-sample and wire checks
also pass on that build.
The complete optional membership/playback/window entrypoint also passes after
fixture sharing; the final reproduction shots are retained.

The worker is internal. Public heavy-job submission, cancellation and attempt-artifact
reclamation, revision mutation/undo and capture pause journeys, the named integrated
lab command and the full parent audio/pointer/export workflow remain open. A hard-killed
worker can leave an unpublished private staging directory; the future job owner must
reclaim attempt artifacts after the worker is terminal. This pass does not add another
process owner or advertise a public preview endpoint. Dimensions must currently be
even and at most 8192 pixels; other sizes fail explicitly without resizing content.

## Actual capture-file timing

The optional [capture-render gate](../../../../../apps/macos/tests/capture-video-render.mjs)
records only the app-owned fixture window with microphone and system audio disabled.
It pauses/resumes through the service, reads the actual immutable revision, then
uses the shared timeline owner to plan a trim and middle cut. The native renderer
processes that capture file; FFmpeg independently decodes the result and checks its
frame count and exact planned duration. The original SHA-256 remains unchanged.
The [merged receipt](capture-render.json) records the actual plan and dimensions.
The harness reaps its app/service and removes only its own temporary recording.

Run after building the app, core and debug native helper:

```
node --test apps/macos/tests/capture-video-render.mjs
```

This establishes capture-file compatibility and duration, not a visual join,
physical cursor, audio, public preview or export result. The app's capture owner
already rounds encoded dimensions to even values and caps the longest edge at
4096 pixels; the native renderer's current even-dimension limit therefore covers
these app-generated sources. External-media import remains outside release scope.
