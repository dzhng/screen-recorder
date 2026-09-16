# Rendered video color metadata

The renderer converts images into sRGB pixel buffers. Fresh buffers had no color
attachments, so AVAssetWriter produced untagged movies. The fix labels the bytes
with their actual working representation before creating encoded samples: Rec.709
primaries (shared with sRGB), the sRGB transfer function, and Rec.709 YCbCr matrix.
It changes no cut times, geometry, bitrate or source files.

The installed AVFoundation `AVVideoSettings.h` documents that, without an output
color override, tagged source buffers determine output tags and untagged buffers
produce untagged output. This is metadata for already converted bytes, not a new
source-color assumption. [The comparison receipt](comparison.json) records the
exact candidate source/binary hashes, all images and observed container fields.

## Choose the reference before interpreting pixel distance

The source's native presentation is the target. Native and FFmpeg decoding of the
untagged generated source produce different colors, so comparing raw FFmpeg source
pixels to every candidate can reward a different interpretation. Native source PNGs
and standard AVPlayerView windows establish the intended displayed appearance.
The same input movies and full-size windows are used across the comparison.

Adding tags alone reduced native-frame mean RGB error from 6.52 to 0.64 of 255.
A measured alternative also forced the writer to convert to a Rec.709 transfer
function; its error was 1.11 and it added an unnecessary conversion. Both native
comparison outputs are retained under `native-frames/`; the tags-only path is the
implementation. The independent decoder regression compares encoded movie pixels
to the native source's displayed sRGB pixels, and fails against the previous native
binary with error 4.42 (limit 2). It passes with the fix. All thirteen native video
regressions pass; prior precise-duration and gap contracts remain unchanged.

## Actual player and capture evidence

`player/` contains every full window capture for source, baseline and tagged output
at three positions. `crops/` contains their complete enlarged-label set. The same
owned standard AVPlayerView fixture was used, with no view-background override and
muted generated media. Each group's ledger brackets screenshot times. The content
region is x0/y64, 1280×720; title-bar focus and rounded window chrome are outside
the numerical comparison, but remain visible in full images.

| State | Baseline mean RGB error | Tagged mean RGB error |
| --- | ---: | ---: |
| Before | 6.09 | 1.41 |
| Middle | 4.98 | 0.66 |
| After | 4.76 | 1.17 |

These locate changes; the [independent visual review](visual-review.md) confirms
better source-color preservation while retaining the visible text-edge limitations. Lossy encoding still prevents pixel equality.

`capture/` separately retains an actual app-owned fixture-window recording, with
microphone and system audio disabled, and its cut baseline/tagged outputs. Its
native-frame comparison improves from 3.02 to 1.75 mean RGB error. The source was
copied only from the test-owned temporary recording; no personal recording was
read or changed. This check does not establish physical audio, cursor rendering,
ASR fidelity or the complete export feature.

## Remaining scope

This pass addresses color interpretation. It does not claim that default H.264
settings preserve every tiny text edge, or that all displays/players behave
identically. Encoder sharpness, complete movie audio/pointer composition and the
public preview/export workflow remain parent 13 work. Original video and inspection
PNG contracts remain intact.
