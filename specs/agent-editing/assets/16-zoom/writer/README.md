# Zoom writer boundary diagnosis

The observed movie receives the same compiled pictures as direct PNG inspection.
This probe copies the actual BGRA buffer immediately before native writer append,
including its color-profile identity; it does not rerender a flattened source.
After conversion through that exact profile to sRGB, seven of eight samples match
the direct PNG exactly and one differs by at most one channel value. All five
shared full/range writer buffers are byte-identical. The observer's decoded full
and ranged movies are byte-identical to the uninstrumented public journey.

Thus the large observed movie differences arise after the pre-append buffer in
this fixture, not from different zoom geometry or evaluation clocks. Independent
AVFoundation decoding followed by profile-aware conversion still differs from the
PNG: maxima 73–186, means 0.924–2.933. The raw ffmpeg comparison's maximum 240 is
not itself a color-managed display verdict. This probe does not isolate encoder
conversion, subsampling, compression or decoder behavior from one another, and
does not accept their visible edge artifacts or select a production quality profile.

`report.json` retains the original measured result and observer binary hash.
`full/` and `range/` retain exact writer bytes, attachments and compiled inputs;
`observed-*.mp4` retain delivered movies. The eight `displayed-movie-*.png` files
are independently color-managed movie frames, not a visual acceptance claim.
The observer patch applies to the native package at root commit `47df4c28`; it
extends the existing pointer observer to the first 32 frame indices. The frozen
wrapper selects the observer for movie requests only. Its absolute scratch paths
record the executed experiment, not a new production runtime.

Reproduce the retained pixel comparisons with:

```sh
python3 specs/agent-editing/assets/16-zoom/writer/analyze.py /tmp/fresh-zoom-writer-analysis
```

The analyzer compiles the retained writer conversion and existing independent
image/movie display tools, verifies actual profile identity, and compares every
sample and shared range buffer. The original public report, build log and observer
patch are compressed alongside these inputs. Fresh visual acceptance of encoded
quality remains open; no threshold or production renderer changed here.

Independent code review verified retained buffer hashes, frame-time mapping,
profile identity, all eight writer/PNG comparisons, five shared range buffers and
decoded movie parity, finding no actionable defect. Its fresh AVFoundation decode
failed with native errors -11821/-12911; root's full analyzer reproduction passed.
The review does not replace fresh visual acceptance of movie quality.

A separate uncompressed display control concatenates the eight normalized writer
RGBA frames at 8 fps, then uses FFmpeg rawvideo/ARGB MOV tagged BT.709 primaries,
sRGB transfer and RGB matrix. Independent AVFoundation display decoding reproduces
the normalized writer bytes exactly, with the same <=1 direct-PNG differences.
`lossless-control.json` and `lossless-control.mov` retain that positive control.
This isolates a lossless display route; it neither ships a new format nor proves
which part of the H.264 conversion/compression/decode path causes each artifact.

The [controlled chroma comparison](chroma/README.md) separates subsampling from
compression: RGB/YUV 4:4:4 roundtrips stay within two levels, while 4:2:0 alone
reaches 79–122 without any encoder. This is a reason to distinguish codec loss
from incorrect geometry; it does not select a production quality profile.

A [matched native encoder cohort](codec/README.md) reproduces baseline decoded
pixels, finds little benefit from 40 Mbps on these samples, and verifies a ProRes
reference within two RGB levels with fresh visual review. Its decode-path alpha
difference and untested realistic workloads prevent production promotion.
