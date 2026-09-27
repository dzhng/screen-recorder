# Native stretch reproduction — gate remains open

This is a reproducible experiment, not an accepted production stretch recipe.
The [runner](../../../../packages/test-harness/editing/stretch-reproduction.mjs)
compiles a standalone AVFAudio probe, renders offline without opening speaker
output, and compares the installed FFmpeg `atempo`. No runtime is distributed or
added to the product. Run from the repository root:

```sh
node packages/test-harness/editing/stretch-reproduction.mjs --case all --out /tmp/stretch-fresh
node packages/test-harness/editing/stretch-plots.mjs /tmp/stretch-fresh
```

`--case local-phrase` is the smaller source-selection and neighbor-preservation
check. Choose a fresh output directory. The runner freezes input/output hashes,
versions, source and probe identity, sample bounds, timings, memory, measured
impulses and discarded-tail energy. The real source remains the immutable
narrated-workbench fixture; no recording or personal library is modified.

## What the first experiment establishes

The native unit preserves the steady 440 Hz tone within the specified 1% limit
at all requested rates. Retained output has exactly the requested PCM sample
count. Unchanged neighbors remain byte-identical. Poisoning every excluded
source sample leaves the complete native output byte-identical: the experiment
clips the input before feeding the effect rather than processing neighboring
speech and hoping a later crop excludes it. Digital silence stays silent.

The effect reports zero latency and zero tail time, but emits nonzero signal past
the nominal output endpoint for non-unit speeds. The runner saves that raw signal
and reports its energy. Its exact-length WAV is a **diagnostic crop**, not proof
that the discarded signal is safe to remove. Impulse peaks also move within the
rendered interval; peak displacement and tail loss are different observations.
A single offset cannot be inferred from the zero-valued latency property.

The `atempo` comparator returns a content-dependent number of samples; it is not
silently padded or cropped to make its frame count pass. Exact endpoint handling
is therefore unresolved for both recipes. Native remains the first candidate,
not a selected engine for slice 14.

## Quality limits and next experiment

No new listening was performed. Phrase intelligibility, naturalness and clipped
words at joins remain unverified. The real 99–101 second excerpt is explicitly a
rushed-speech **candidate**, not a manually verified example. Speech-with-clicks
uses real speech with disclosed synthetic click impulses. No synthetic speech
stands in for the narrator.

The next bounded experiment must distinguish algorithm delay from endpoint loss
using leading/trailing context and known impulses, while keeping the selected
source range and required output length explicit. Do not hide discarded speech
with an arbitrary crop, pad, fade or source-range expansion. If an alignment or
endpoint preparation seam is required, freeze it before slice 14 integration.

The signal plots are diagnostic and have not passed independent visual critique.
Rows run input, 0.8×, 0.9×, 1×, 1.25×. Spectrum panels share the 300–600 Hz frequency
scale. Waveform columns show left/right joins in ±100 ms windows; each red center
line is the nominal join. They are not listening evidence. No visual or audio
acceptance is inferred from unreviewed artifacts.

## Verification

The full seven-case, four-rate matrix passed its numerical assertions. Deliberately
changing the native pitch to +1200 cents made the tone check fail, then restoring
it returned the matrix to green. The finite runner enforces file, selected-input,
output-frame, process-time and render-attempt bounds. Production capture, decoding,
and audio owners are unchanged; their pending preservation failures remain pending.
