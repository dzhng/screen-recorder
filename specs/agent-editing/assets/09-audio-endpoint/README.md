# Retained-audio endpoint coverage

The production-wire two-cuts movie failed before assembly because the last 44.1 kHz
narration interval produced 167998 of 167999 owed 48 kHz frames. This is reproduced
in [the unchanged failure](before.txt) and isolated by [decoder diagnostics](diagnostic.txt).
It was not a mux protocol regression or a physically truncated source.

The interval begins at 2.375 seconds. Frozen nearest-start selection rounds
104737.5 to source frame 104738; ceil-end selection stops before frame 259087.
The 154349 retained native frames cover `154349 * 160 / 147`, or
`167998 + 134/147`, output samples. The converter emits only the whole 167998.
Cumulative output timing still owns all 167999 frames, so exactly one output
sample needs synthetic zero extension. Reading real frame 259087 would violate
selection isolation; dropping the sample would violate the output clock.

The sole interval converter now derives this allowance from its declared native
selection and required output cardinality. Both recording and composition use the
same existing extension mechanism. It is available only after the decoder reaches
its declared selection end, never merely because decoding ran out of data.
The source addressing, resampler, gains, join ramps, timeouts and frame counts stay
unchanged. Composition no longer computes a second allowance at its caller.

The [production-wire preservation run](preservation.txt) passes all 16 audio/movie
tests. The new regression changes only fully excluded frames 104737 and 259087 and
requires byte-identical decoded PCM; independent included markers 104738 and
259086 must each survive. A faststart MOV physically truncated before the declared
end still fails and leaves no published WAVE or staging directory. Existing full
span, multi-cut, tiny, fractional, AAC-isolation and 1001-span cases also pass.

Reproduce after building the worker:

```sh
SCREENREC_NATIVE="$PWD/helpers/mac/.build/debug/screenrec-native" \
  node --test helpers/mac/Tests/movie-render.test.mjs helpers/mac/Tests/audio.test.mjs
```

This resolves the earlier [PCM mux baseline gate](../09-pcm-mux/README.md), without
claiming completion of broader composition codec, scale or public journey gates.
