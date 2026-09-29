# Stable PCM representation at the capture writer

AVAssetWriter accepted later audio buffers while interpreting their bytes through
the first input format. A successful append did not prove conversion: float32→int16
lost half the later frames, int16→float32 doubled them, stereo bytes became extra
mono frames, and a later sample-rate change was written at the established rate.
Initial int16 conversion and unchanged float32 were correct. Removing the input
format hint made the original controls byte-identical; it was rejected as a fix.

CaptureWriter now presents one canonical float32 interleaved input representation
for each role's established rate/channel count. Representation conversion belongs
to the existing audio-track owner, with one replaceable platform converter and
current-buffer storage. Identity channel mapping prevents layout-derived mixing.
Original timing and frame count survive; incompatible rate/channel changes stop
before acceptance. No resampling, new source clock, padding, schema2 writer mode,
or canonical publication is introduced.

[Apple's PCM conversion API](https://developer.apple.com/documentation/audiotoolbox/audioconverterconvertcomplexbuffer(_:_:_:_:))
performs same-rate format conversion. The bounded converter controls prove packed24,
planar float32, float64, int16 and canonical float32 preserve asymmetric stereo PCM.
The actual writer gate then proves both representation transitions, first-int16,
canonical fast paths, stereo ordering, packed/planar/float64 input and rate/channel
refusal. Accepted decoded PCM equals independent FFmpeg conversion of the exact
input buffers. Journal source bounds are unchanged. Refusals retain only the exact
first accepted buffer. The original writer fails the same final harness at the
representation assertion; this is the retained negative control.

Run `node packages/test-harness/editing/capture-audio-format.mjs --out EMPTY_DIR`.
The default native capture suite and actual EFBIG journal-failure cases also pass.
Raw inputs, MOVs, expected/decoded PCM and reports are retained; gzip preserves raw
byte content. The float64 actual-writer fixture is an uncompressed float64 WAV:
AVAssetReader's requested output-settings API refuses 64-bit requests, so that
fixture-generator limitation is not mistaken for a capture input restriction.

This is offline owner evidence. No stream starts, device queries, permissions or
live capture occurred. Actual schema2 append transactions and 20c/20d canonical
materialization/publication remain open, as do physical 20/21 capture gates.

Independent read-only Codex review found no actionable defects in memory ownership,
converter lifetime, timing, channel order or evidence. The shape pass keeps the
representation boundary with the existing track, without adding a clock, service,
persistent format or per-format cache.
