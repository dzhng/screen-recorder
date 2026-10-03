# Composition audio across physical gaps

A range beginning in the final sample of selected audio exposed a converter buffer
lifecycle bug. After an empty end-of-stream conversion, the consumed offset still
referred to the preceding buffer. A later read could compute a negative copy count
and fail, even though source decoding had reached the selected boundary. Resetting
the offset whenever conversion replaces the buffer fixes that invariant. The
existing arithmetic endpoint extension, input selection and resampler are unchanged.

The [compiled composition probe](../../../../../packages/test-harness/editing/audio-segments.mjs)
uses the native SourceAudio fixture generator: selected stereo beside an alternate
mono stream, a nonzero presentation origin, physical holes, and narrower acquisition
support. [Report](report.json) pins inputs, worker and output identities. Both source
rates preserve exact full/range and pure-split PCM, explicit silent unavailable
ranges and exclusion of poisoned source samples. The 48 kHz result also equals the
independent known-PCM reference. This is compiler-to-native execution evidence;
it does not claim an additional public CLI/MCP journey or listening acceptance.

Before the fix, the 44.1 kHz window beginning at 199997 microseconds fails with
NATIVE_DECODE_FAILED. The unchanged test passes with the fix. The preexisting full
44.1 kHz WAV remains byte-identical (SHA-256
`df82da61b82c359a96cbffad41c05706be22303858507a76de25ddbac67cf5bd`).
The [complete mixer regression](mixer-report.json), source-window executable and
composition-stream executable pass with the fixed worker. Independent Codex review
found no actionable defects; its native build was blocked by sandbox/toolchain
permissions, so root runs own the runtime evidence.

Reproduce in fresh scratch directories after building composition and the native
worker plus ScreenRecorderSourceAudioTests:

```sh
SCREENREC_SOURCE_AUDIO_EVIDENCE=/tmp/audio-segment-fixtures /path/to/ScreenRecorderSourceAudioTests
SCREENREC_NATIVE=/path/to/screenrec-native node packages/test-harness/editing/audio-segments.mjs /tmp/audio-segment-fixtures /tmp/audio-segment-results
```

Shape/diff/docs review keeps the fix within the existing buffer owner: one moved
assignment and an explanatory comment, with no new state or API. Choice audit
found no new product policy; fixture selection is delegated verification detail.
Long-project A/V drift, broader rate/codec combinations and narration listening
remain open in slice08.
