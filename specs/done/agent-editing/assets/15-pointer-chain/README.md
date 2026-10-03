# Pointer geometry and movie conversion controls

This is a research checkpoint, **not slice15 acceptance**. It preserves a failed
reference hypothesis and separates it from actual movie delivery errors. No
production profile, compositor, public API or default journey gate changed.

## Reference validity

The frozen cohort exercises moving captured pointers through crop, contain/cover/
stretch, successive clip geometry, track, nested groups and output rotation on two
canvases. All previous public pointer lifecycle checks ran through deletion. Six
exports exactly match their full previews; the proposed new gate remains red.

The proposed reference flattened a delivered source picture before transforming
it. That is invalid for the first fractional geometry: native pointer and decoded
video branches retain separate sampling/color conversion before their first
materialization. The pregeometry tap matches exactly. First cover geometry differs
from the flattened reference by 28 code values; later stages do not introduce a new
location discontinuity. These observations do not establish native correctness.

A discriminating public control imports the same flattened PNG as a still and
applies the same first geometry. That result agrees with an independent linear
flat-image reference within 1 code value, while the live pointer/video result differs
from that reference by 55. Simply changing the old flattened reference's transfer
curve does not repair the lost branch semantics. The unprimed review is retained
in `oracle-review.md`. `disproven-reference.patch.gz` freezes the experiment rather
than installing its invalid acceptance assertion in the default journey.

A separate sensitivity control changes one distant red sample from 188 to 187.
It changes a thresholded centroid beyond its existing budget despite only one code
value of image difference. The original centroid diagnostic remains red and visible;
whole-image error and missing-pointer/one-pixel-shift controls are complementary
measurements, not replacement acceptance thresholds.

## Actual writer and delivery

`input/` freezes the intact contained-pointer pictures and exact native movie
manifests. The writer observer copies the actual pre-append BGRA pixels and color
attachments. Instrumentation preserves all seven decoded movie pictures exactly.
Full/range writer inputs and candidate/default inputs match byte-for-byte for the
three shared global frames. Normalizing the observed writer buffer using its exact
CoreMedia709 ICC profile matches the intact public PNG within 1 code value.

| Delivery experiment | Original intact-picture landmark gate | Full/range bytes |
| --- | --- | --- |
| Default H.264 | 0/7 pass | 2452 / 2128 |
| Requested 40 Mbps H.264 | 0/7 pass | 3588 / 2955 |
| ProRes 4444 in MOV | 0/7 pass | 23951 / 18049 |

The ProRes experiment includes MOV at both writer and mux boundaries and omits the
H.264-specific frame-reordering setting. It is 4:4:4, not a lossless claim. Its raw
report retains the experiment runner's historical `rate` key; the worker path/hash
identifies the actual ProRes candidate. Neither bitrate nor this profile fixes the
strict delivery criterion, so neither is promoted.

The lossless control converts the actual writer pixels to sRGB using their exact
ICC profile, writes uncompressed RGB MOV, and decodes with the independent Apple
reference. All four intact-picture landmark checks pass; maximum differences from
public PNG are1/1/1/0. Decoded bytes exactly equal the normalized writer bytes.
Writing the untouched CoreMedia709 bytes as raw RGB instead fails all four checks
(maximum 11), distinguishing transfer interpretation from sample loss. This is a
verified diagnostic path, not a supported production export format.

## Reproduction

The native source is pinned in `verification.json`. In separate scratch copies of
that package, apply `writer-observer.patch.gz` for the observer; for the 40 Mbps candidate
add `AVVideoAverageBitRateKey: 40_000_000` to its **existing** compression dictionary.
Apply `prores-observer.patch.gz` independently to the original package for ProRes.
Decompress each patch before applying it. Build with isolated Swift scratch directories and freeze each worker. No new model
or dependency is needed. A historical incorrect dictionary insertion and misplaced
observer patch failed before measurement; their logs remain distinct from results.

Run `node specs/agent-editing/assets/15-pointer-chain/run-encoding.mjs <baseline-worker> <observer-worker> <candidate-worker> <candidate-name> <fresh-output>`.
It recompiles the independent decode tools and uses only the frozen inputs. Completion
means the experiment ran; inspect `candidatePasses` for the strict outcome.

Run `node specs/agent-editing/assets/15-pointer-chain/run-lossless.mjs <encoding-output/instrumented-full> <fresh-output>`
for the matched transfer/lossless control. Its positive and negative assertions must
both pass. Archives retain complete delivered media, raw observations and requests;
compressed script snapshots preserve the public stage/flat-image probes as executed.

Next, construct a branch-preserving reference or independently validate pointer
geometry through its alpha/support while keeping encoded color/coverage gates
separate. Do not insert a production rasterization stage to satisfy the disproven
flattening assumption. Further codec work must explain the failed controlled outputs,
not tune more bitrate values on the same few samples.
