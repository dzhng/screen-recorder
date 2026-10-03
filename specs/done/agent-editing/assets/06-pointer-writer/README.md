# Pointer movie writer-input localization

The three previously failing trail samples reach the actual movie writer with
**byte-identical active pixels and equivalent color attachments** in full and
clipped renders. Source/physical sample identities and compiled visual instructions
also match. The original magenta membership criterion still fails. This localizes
those three disagreements downstream of the supplied writer pixels; it does not
accept codec quality, prove universal pointer preservation, or identify a unique
writer/encoder/decoder cause.

## Fixed experiment

The parent is the frozen prepared-pointer worker from commit `55a91eee`, with the
same authored video and immutable compiled/prepared streams retained in [input](input).
No source regeneration, capture, user-library access or production setting changes
occurred. Only a scratch copy of the native movie writer was instrumented. The
[patch](instrumentation.patch) observes frames 10–12 after `pictures.render` and
before the sample is appended, locking the actual CVPixelBuffer read-only, copying
active BGRA bytes row by row (excluding stride padding), and recording color
attachments, ICC identity, frame/source provenance and exact intended sample timing.
There is no production diagnostic API.

[The runner](run.mjs) replays the frozen full two-second and clipped
`[1050001,1250001)` microsecond inputs through both workers. Independently decoded
RGBA matches between uninstrumented and instrumented renders for **all 23 output
frames**, including the non-instrumented ones. The six selected uninstrumented
frames also reproduce the previously retained PNGs exactly. This control detects
an observer-induced output change; it does not claim zero timing or performance
impact from synchronous tracing. The frame metadata `processing` is reconstructed
from frozen visual nodes; native picture behavior is driven by the unchanged raw
compiler graph and prepared streams, not that unused movie metadata.

The [reproduction record](reproduction.json) pins workers, source-file identities,
commands and failed setup attempts. The first attempted build reused a different
package's cached source plan and was discarded before measurement; the successful
build uses a separate scratch directory and its source list/binary marker were
checked. Cached package checkouts were reused with automatic resolution disabled;
no new dependency or model was downloaded. Copy the native package at the pinned
commit to scratch, apply the patch with `patch -p1`, build in a fresh separate
scratch directory, and invoke the runner with the unchanged and instrumented
workers plus an empty output path.

## Measured effect

[The report](report.json) preserves worker/input hashes, complete controls and
all diagnostic thresholds. [Raw traces and movie outputs](results) retain the
native observations; `.bgra.gz` contains the exact active bytes whose uncompressed
SHA256 appears in each adjacent trace. Each matched frame has zero changed channels
and identical color metadata, including the CoreMedia709 ICC hash. The full movie
uses PTS 1000000/1100000/1200000; the clipped movie uses 0/49999/149999. Durations are
100000/100000/100000 versus 49999/100000/50001 microseconds. These are the declared
clipping equations, not a source-sample shift.

| Diagnostic | Frame 10 | Frame 11 | Frame 12 |
|---|---:|---:|---:|
| Original magenta x-centroid delta, pixels | 1.08984 | 1.06189 | −1.00851 |
| Full-only qualifying pixels | 30 | 20 | 11 |
| Range-only qualifying pixels | 5 | 8 | 13 |
| Membership intersection/union | 0.69565 | 0.83030 | 0.80328 |

The original strict less-than-one-pixel criterion stays **red**. Neighboring red-channel thresholds
19 and 21 are sensitivity diagnostics only; they do not replace the original 20.
Zero translation gives the best overlap among shifts within two pixels at each
original-threshold sample. That disfavors a uniform image translation but cannot
prove that missing colored trail pixels were preserved. Neither full nor range
lossy output is an absolute color ground truth.

[Packet metadata](frame-types-full.json) shows the three full samples are P frames;
[the clipped sequence](frame-types-range.json) begins with an I frame followed by
two P frames. Encoder history therefore differs, but this correlation alone does
not establish why membership changes. The prior exact legacy-PNG byte diagnostic
is untouched and remains red in its original evidence.

## Parameter-effect map and next experiment

| Factor | Prediction | Observation | Decision |
|---|---|---|---|
| Sequential render/cache changes writer pixels | Matching global frames differ before append | Active bytes, color attachments, source samples and graph agree at all three samples | Ruled out for this pinned cohort only |
| Read-only tracing perturbs encoding | Decoded output differs from frozen worker | Zero changed channels across all 23 frames, plus six prior PNGs reproduce | Accept this observer for this cohort |
| Membership indicates rigid displacement | A translated mask overlaps better | Zero-shift overlap is best; membership counts still differ | Retain color-quality failure; do not reinterpret as accepted geometry |

The next cheap controlled trial is an **all-intra keyframe policy** on the same
writer-input cohort, with all other settings and original diagnostics held fixed.
It tests dependence on predictive encoding history and measures quality/file-size
tradeoffs; it does not imply that this should become the product profile. A null
result would leave rate control, conversion/decoder and metric sensitivity for
separate trials. Existing platform-rate reproduction and wider slice06 color
acceptance remain independent gates. No setting is promoted by this localization.

[Independent review](review.md) verified the raw evidence and inference boundary,
including a second decoder control. The final strict-comparator rerun preserves
every measurement; no diagnostic threshold was relaxed.
