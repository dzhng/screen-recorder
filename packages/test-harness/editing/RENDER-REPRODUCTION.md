# Native rendering reproduction

The [driver](render-reproduction.mjs) compares AVMutableComposition's standard
video-composition exporter against a bounded AVAssetReader → Core Image →
AVAssetWriter path. Both use AVAudioMix for independently placed source audio.
The [standalone Swift probe](RenderReproduction.swift) compiles with the existing
sample-support/time-mapping owner; it does not build FluidAudio or launch the app.

Run the slice's command with an optional `--out EMPTY_DIRECTORY`. Without an
output argument, evidence goes to a temporary directory printed by the driver.
The driver runs all timing cases belonging to the AV replacement experiment and
then verifies the selected bounded mechanism. The [verifier](render-reproduction-verify.mjs)
can check frozen evidence using `--out DIRECTORY` without rendering again.
The [negative checks](render-reproduction.test.mjs) use disposable copies to prove
that output corruption and a failed timing verdict are rejected.

The experiment selects a temporal mechanism, not a production renderer or a
universal color policy. It supports an ordered single visible layer, integral
microsecond frame periods and unit-speed intervals plus explicit holds. Unsupported
overlap/retiming is rejected rather than silently ignored. The production compiler
must supply the same sampled project instants and visible intervals; it must not
inherit a second authoring model or round its stored rational endpoints to satisfy
this probe's narrower request shape.

The bounded reader seeks to the proven preceding sample and carries at most one
reader's retained sample through an occurrence. Source media sample timestamps are
mapped through edit-list segments before comparing project selections. Held
duration comes from sample support, never an assumed gap to the next timestamp.
Empty edits render black; declared unavailable acquisition refuses rendering.
Preview starts inside a project frame preserve that frame's original phase and
clip only its visible duration. Native output sample timings state those clipped
durations explicitly.

## Color evidence boundary

The original corpus is unmodified. `tagged-a.mov` and `tagged-b.mov` are separately
hashed input derivatives declaring the generator's known sRGB primaries/transfer
and BT.601 RGB-to-YUV encoding matrix. They preserve compressed picture data while
making that interpretation explicit. Requests use `colorPolicy: native`, so Core
Image respects the input metadata; the renderer does not force all footage to
sRGB. The `assume-srgb` path is a diagnostic contrast only.

On this host, VideoToolbox supplies guessed Composite NTSC/SMPTE-C color metadata
for the untagged clip. Raw decoded BGRA is already close to the generated RGB
landmark, but the guessed primaries change it during conversion into sRGB. The
report freezes raw RGB, attachments, default conversion and explicit interpretation
separately. This does not establish the right assumption for arbitrary untagged
camera footage. That product decision remains open, and captured sRGB preservation
is still binding.

## Preservation map

| Proven behavior | Frozen evidence | Production adoption gate |
| --- | --- | --- |
| Correct A–B–A occurrence, independent sound, holds and source subframe membership | Request, hand-specified counter sequences, decoded frame observations and local movies | Slice 07 compares matched compiled requests and every decoded counter; no reinterpretation of edits in the native worker. |
| Preview frame phase and full held duration | Full/nonzero preview cases plus duration and boundary/interior checks | Compare preview against the full export's corresponding presentation intervals, including partial first/last frames. Extend to fractional stored endpoints without rounding them first. |
| Empty edit differs from unavailable acquisition | Native empty-edit file, full/partial previews, explicit refusal case | Keep the source evidence distinction; never fill unknown acquisition with a fabricated hold or silence. |
| Mono duplication, independent placements and gain before encoding | Exact 48 kHz stereo float PCM against original WAV samples; final PCM16 and impulse positions | Slice 08 compares requests, offsets, sample counts, gains and PCM before its chosen delivery encoder. AAC waveform differences are reported separately from sample selection. |
| Declared fixture red landmark survives native conversion | Separately hashed tagged derivatives and unchanged four-level RGB gate | Respect actual declared source color metadata. Do not generalize the fixture assumption to untagged footage. |
| Untagged behavior is observable, not silently corrected | Original corpus hash; raw/default/explicit color diagnostic images and metadata | Settle the general admission/render color policy explicitly; preserve existing captured-source behavior at production entry points. |

Resource figures describe these tiny native jobs, including startup, on the
recorded host. They exclude verification decoding and compilation, and do not
establish long-project throughput. Numerical audio identity proves the mix here;
it does not provide an independent listening verdict. General layering, arbitrary
frame clocks, edited-source preservation and public entry-point parity remain
their owning slices' work.

The reproduction follows Apple's documented [composition track editing](https://developer.apple.com/documentation/avfoundation/avmutablecomposition)
and [YCbCr conversion-matrix attachment](https://developer.apple.com/documentation/corevideo/kcvimagebufferycbcrmatrixkey)
mechanisms. Their published Markdown documentation was read during this pass;
the runtime verdict comes from the frozen experiments, not the documentation.
