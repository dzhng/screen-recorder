# Native AAC assembly checkpoint

Generated media only, macOS 26 / Apple AVFoundation / FFmpeg 8.1.2. This is a
feasibility result, not a production preview operation or a listening review.
The [13c plan](https://github.com/dzhng/screen-recorder/blob/2e1028cddc3f89d58018a4ebcbc8895b28a78ae1/specs/recording-for-ai/slices/13c-aac-movie-assembly.md) owns remaining acceptance.

## What the clocks mean

A movie can end between two audio samples. The video/movie presentation clock
retains that exact microsecond end; the existing PCM owner rounds the cumulative
end to the nearest sample. AAC encodes groups of samples with priming and tail
padding. Priming is the extra input an audio decoder needs before the first kept
sample; the container's edit mapping excludes it from presentation.

The candidate uses one final writer: compressed H.264 passthrough plus AAC encoded
from the accepted PCM stream. Its movie timescale is the least common multiple of
one million and the sample rate. At 48 kHz that is six million ticks per second.
Both microseconds and individual samples fit exactly. A million-tick movie clock
rounded a 242,811-frame audio edit upward, making AVFoundation decode 242,812;
the common clock preserves exactly 242,811. Video end remains 5,058,566 µs, while
audio end is 5,058,562.5 µs: the existing 3.5 µs sample-rounding difference.

An earlier generated AVMutableComposition/passthrough assembly of an intermediate
AAC file shifted independent decoded audio by 2,112 samples (44 ms at 48 kHz).
The chosen final writer avoids that extra assembly of an already-primed AAC track.
There is no guessed compensating offset. It also preserves decoded video pixels
and the renderer's color tags without a second video encode.

## Measurements

[report.json](report.json) records the actual plans, native track/edit ledgers,
independent stream metadata, PCM comparisons and the tiny AAC packet flags.

| Case | Input / native decoded audio frames | FFmpeg raw frames | Native player end |
| --- | ---: | ---: | ---: |
| Six-second mixed original | 288,000 / 288,000 | 288,704 | Not exercised |
| Two cuts, mixed rates/offsets/gaps | 242,811 / 242,811 | 243,648 | 5,058,566 µs |
| Fractional spans, 30,010 µs | 1,440 / 1,440 | 1,984 | Not exercised |
| One retained nonzero sample, 20 µs | 1 / 1 | 0 | 20 µs |
| Sub-sample movie, 2 µs | 0 / no audio track | No audio track | Not exercised |
| Mono, 44.1 kHz, four seconds | 176,400 / 176,400 | 177,088 | Not exercised |

Extra FFmpeg frames in ordinary clips are codec tail padding beyond the audio
presentation interval, not extra movie duration or samples read from removed
source. PCM is compared only within the retained interval. Numerical RMS error
against lossless shared-owner output is 0.0011–0.0041 in the listed edited/mono
cases. A ±2,112-sample shift produces much larger error, so these fixtures expose
priming misalignment rather than passing a silent or phase-ambiguous waveform.
No bit-exact lossy-codec claim is made.

The tiny clip's lossless retained stereo sample is approximately
`[0.0783985, 0.0611266]`; native AAC decoding returns `[0.0534881, 0.0420553]`.
This is not a zero-phase sample hiding an omitted signal. FFmpeg marks all three
AAC packets discardable and emits no samples; its first packet advertises a
2,049-sample skip. Native AVPlayer emits its ended notification at exactly 20 µs.
The clip's native presentation is valid. The provisional native personal-release
playback contract preserves arbitrary cuts; this FFmpeg limitation is recorded
for export/consumer documentation, not used to invent a minimum retained span.

For separate tiny and middle-cut fixtures, every source sample outside the kept
intervals was replaced with ±0.9. The decoded AAC output stayed byte-identical.
That tests removed-source isolation even through encoder tails. Source files are
also checked byte-for-byte unchanged by rendering. These tests do not measure
adjacent speech intelligibility.

## Reproduce and interpret

Build native `screenrec-native` and protocol/core, then run
`SCREENREC_MOVIE_EVIDENCE=/absolute/empty/path node --test helpers/mac/Tests/movie-render.test.mjs`.
The initial eight checks pass; production adds the large-plan regression. The named tiny-AAC test asserts the recorded decoder difference;
a green suite confirms the evidence, not that all consumers agree.

[Two-cut MP4](two-cuts.mp4), [lossless PCM reference](two-cuts.wav), and
[tiny MP4](one-sample.mp4) are generated review artifacts. Playback probes are
muted and no one has performed a speech or physical-device audition in this pass.
Five-minute drift/memory and job cancellation/publication remain unmeasured here.

The initial shape review kept candidate assembly in one optional test target, reusing
production video/PCM owners. That checkpoint added no production route, dependency, schema, timer owner,
or public excerpt-cap change. Production now uses one native owner and removes
the optional implementation copy.

Independent Codex review found no actionable defects in the bounded checkpoint.
At that checkpoint, the rebuilt production worker returned `UNKNOWN_OPERATION` for
`media.renderMovie`. [Production promotion](production/README.md) now supplies that
internal worker operation and removes the optional implementation copy.

The [merged verification](merged-verification.json) records a rebuilt optional
native target and all eight checks passing on the main checkout. Its
[execution log](merged-tests.txt) retains the test names and terminal result.

[Shared audio planning](audio-planning.md) keeps source acquisition semantics common
to excerpts and full revisions while preserving their different request limits.

[Pinned job integration](pinned-jobs/README.md) now verifies shared acquisition
planning and native audio/video while a concurrent undo advances the live edit.
