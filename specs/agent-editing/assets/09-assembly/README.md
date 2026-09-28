# Native composition assembly

This is the native execution seam, not public preview or slice 09 acceptance.
`media.renderCompositionMovie` consumes one compiler frame stream, audio schedule,
processing tree, and asset binding list. The video renderer writes H.264 once;
the existing movie mux copies those pictures and consumes the composition PCM
source directly. The WAVE operation consumes that same one-shot PCM source.
No recording role/span plan or intermediate WAVE translates the composition.

Run after building the native worker and cancellation helper:

```sh
swift build --package-path helpers/mac --product screenrec-native
swift build --package-path helpers/mac --product ScreenRecorderCompositionVideoTests
SCREENREC_NATIVE="$PWD/helpers/mac/.build/debug/screenrec-native" \
  node packages/test-harness/editing/composition-movie.mjs
swift run --package-path helpers/mac ScreenRecorderCompositionAudioTests
```

The production-entry harness compares the movie's decoded AAC with the lossless
PCM operation, checks picture NAL units against an independent native video render
(excluding encoder-generated SEI timestamps), independently parses exact movie
header and every track edit-list duration, exercises strict malformed schedule
rejection, and cancels a real NativeWire task after it acquires staging.
The stream test separately pins relative-zero block positions, bounded awaited
consumption, one-shot ownership, and sink cancellation without a completion report.
The full audio harness also remains green after extracting the stream.

## Exact movie time and discrete audio reporting

The fractional window `[123457,812349)` owns exactly 688892 microseconds and
33067 PCM samples: `floor(812349*48000/1000000) - floor(123457*48000/1000000)`.
The movie header and both track edit lists encode 4133352 ticks at 6000000 Hz,
exactly that duration. FFprobe exposes AAC duration as `33067/48000`, approximately
688895.833 microseconds, and rounds its format duration to 688896 microseconds.
That reporting difference is below one audio sample; it does not justify dropping
a compiler-selected sample or changing the authored duration. The report retains
raw stream/format values and exact container ticks rather than calling FFprobe's
rounded duration exact. A positive one-microsecond video window with zero audio
samples produces video only, with no fabricated PCM sample or AAC track.

Broader codec/mux conformance, public job/publication/cache journeys and listening
remain integration gates. The unrelated baseline recording two-cuts converter
failure remains documented in [PCM mux prerequisite evidence](../09-pcm-mux/README.md).
