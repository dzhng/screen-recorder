# Capture duration is a usable source boundary

A finalized revision must end on the same microsecond clock as the bytes it
references. AVAssetWriter's default movie and video timescale was 600 Hz on the
measured host. A requested stop at 4,316,788 µs produced a file ending at
4,316,666⅔ µs; rendering the full original correctly refused that oversized plan.
The renderer must remain strict, rather than pad media or silently shorten edits.

CaptureWriter now specifies microsecond movie and video timebases before writing.
This preserves the existing stop/source-clock authority in the actual container.
Audio inputs keep their native sampling timebase: the SDK prohibits setting
`mediaTimeScale` for audio, and PCM sample-grid semantics are independent of movie
presentation time. No new readback scan, duration cache, or parallel clock owner
is introduced.

Recovery has a different responsibility: it must conservatively describe media
already on disk. Its video sample and segment ends now round down to supported
integer source ticks. Rounding 4,316,666⅔ up would falsely admit 4,316,667. The
[unchanged-source regression](legacy-container.json) shows the old recovered bound
refused by the strict movie renderer and the corrected 4,316,666 µs bound accepted.
This is less than one tick of unrepresentable fractional support, not a renderer
clamp or changes to source bytes. Audio recovery rounding is unchanged. Existing
already-finalized library revisions are not migrated by this development fix.

## Proof

The native tests drive the real CaptureWriter with generated sample callbacks;
they open no devices or capture streams. Their equality check failed before the
fix and passes afterward at ordinary and beyond-fragment-interval endpoints,
plus an interrupted take retaining exactly 33,333 µs of generated video.
They compare the actual asset rational duration, finalized result and recovery.
A separately generated fractional container fails recovery's support-bound check
before the rounding fix and passes after it. Existing capture, clock, pause,
termination, journal, fragmented recovery and audio-acquisition tests remain green.

The [actual capture receipt](actual-capture.json) uses only the app-owned window
with both audio roles disabled. It pauses/resumes capture, requires exact equality
between the source track's rational duration and published `r0`, then independently
decodes a full-original silent movie and the existing cut-render case. The final
source timebase is 1/1,000,000 and its endpoint is exactly 2,415,997 µs. Source
hashes remain unchanged. Two actual runs passed; the retained final run also
includes the independent rational source-duration assertion.

The reproduction remains the optional
[capture/render gate](../../../../apps/macos/tests/capture-video-render.mjs), with
native generated cases in
[the capture tests](../../../../helpers/mac/Tests/ScreenRecorderCaptureTests).
The isolated app bundle was rebuilt from the changed capture owner before testing;
the native decoder/render worker was rebuilt separately. These are timing tests,
not new color, pointer, audio-audition or physical-device claims.

Independent read-only review found no actionable defects. Service capture/lifetime
checks passed (28 tests), and lint/diff checks passed. The focused production change
is explicit writer timebases plus conservative recovered video endpoints; no
schema, public route, dependency or process owner was added.

The [merged native capture/recovery suite](merged-native-tests.txt) also passes on
main after preview publication and sequential pointer policy integration. The actual
owned-window capture evidence above uses the isolated built app containing this fix.
