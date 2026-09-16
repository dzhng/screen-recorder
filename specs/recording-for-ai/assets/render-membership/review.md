# First native movie-membership checkpoint

This is generated-media feasibility evidence, not a shipped renderer or a completed
13a gate. The optional [probe](../../../../helpers/mac/Tests/render-membership.mjs)
uses real core `renderPlan` output and the existing native sample-time owner. Its
standalone Swift fixture compares AVFoundation composition export with timestamped
writer buffers. It holds at most sixteen decoded fixture frames; this is not the
planned streaming product implementation. The actual media worker is exercised
separately for existing frame/visual inspection, not for a new render operation.

Reproduce after building core and `screenrec-native`:
`node helpers/mac/Tests/render-membership.mjs`. It allocates a fresh scratch folder
and prints its report path. `SCREENREC_RENDER_EVIDENCE` may instead name an empty
output directory. FFmpeg generates and independently decodes fixtures; it is not
used as the product renderer. Native measurement finished on 2026-09-16 before the
concurrent index-scale run; later work was static review only.

## What the measurements establish

[The complete timing ledger](report.json) preserves source hashes, segment maps,
requested plans, decoder receipts, independent frame identities and durations.
All three source hashes stayed unchanged through the probe.

- Dense H.264 has reordered frames and a 66,667 µs media-to-asset edit offset.
  Decoded sample-buffer durations are unavailable, while sample cursors and the
  existing segment mapping prove the first frame's nonempty support through
  33,333 µs. Keeping [10,000,20,000) therefore has visible source content despite
  having no presentation timestamp inside it.
- A timestamped writer retains that frame for exactly 10,000 µs. Keeping that
  interval plus [43,333,53,333) yields two independently decoded images, frame 0
  and frame 1, presented at output 0 and 10,000 µs with 20,000 µs total duration.
- Sparse one-frame-per-second media similarly proves the first frame's support
  through 1,000,000 µs. The [500,000,510,000) plan yields the expected frame and
  exact 10,000 µs duration. These fixtures show no measured duration error; they
  do not establish tolerance for the still-unrun fractional/join matrix.
- The measured composition/`HighestQuality` configuration reports those exact
  durations and native reader samples, but FFmpeg produces zero decoded output
  frames. This configuration has not passed the independent-decoder gate. It does
  not prove every possible composition/export configuration is unsuitable.

**Proposed movie rule, now grounded for nonempty track segments:** intersect the
retained span with the display interval proved by the sample cursor and segment
mapping, then map that intersection through the pinned render plan. This can use
an earlier sample timestamp without moving the requested cut. Do not substitute
the next timestamp for missing duration evidence. The stricter still-image rule
remains unchanged: a kept interval without an admitted sample PTS is unavailable.

## The unresolved gap

The gap source has a real empty edit from 33,333 to 133,333 µs. The preceding
sample's cursor duration alone extends farther, but `assetEnd` clamps its proven
nonempty support at the segment boundary. Both raw native reading and FFmpeg expose
a duplicate earlier image at the empty edit's start. This is insufficient evidence
to decide whether playback should hold that image, show black, or need another
presentation rule. The probe refuses to write a guessed movie for a kept interval
inside that gap. The composition attempt produces no video track there.

The existing public-native inspection seam does **not** admit this synthetic gap
sample: `media.frame` and `media.visualSamples` return `UNAVAILABLE` for a kept
[50,000,60,000) interval. Given the full source as kept, both legitimately choose
actual PTS 0 for a 50,000 µs request and label the distance. That nearest-frame
contract is different from movie display membership. No inspector regression was
established by this probe.

Next: measure the generated gap through an actual AVFoundation playback/presentation
path before settling its movie behavior. Then implement the bounded sequential
worker and run the full 13a plan/alias/cancellation/fractional-duration matrix. No
placeholder black frame, silent hold extension, cut snapping, or public render API
was added by this checkpoint.

## Static image review

The target is the authored frame ID with its red upper-left and green lower-right
markers in the same orientation. All ten captured PNGs are in [shots](shots/),
including the raw gap duplicates and existing nearest-gap inspection. The four
source/writer pairs retain full 320×180 framing. [Pixel metrics](pixel-metrics.json)
show grayscale mean differences of 0.249–1.057, edge-energy ratios 0.983–0.994,
and no grayscale pixel difference above 32; these locate encoding differences,
not prove temporal semantics.

Own inspection and a fresh, image-only Codex review agree: frame labels are upright
and legible, markers occupy the intended opposite corners, and no image is blank,
mirrored, rotated, or missing those elements. The writer images have slight edge
softness/color fringing. The existing nearest-gap PNG has different color shades
from FFmpeg output; this checkpoint does not claim color-pipeline equivalence.
The independent reviewer explicitly limited its verdict to appearance. Its complete
finding is recorded in [visual-review.txt](visual-review.txt).

The short [two-span writer fixture](dense-two-spans/writer.mp4) is retained for
inspection. Static images cannot certify its timing; the ledger and independent
decode are the timing evidence. Human Preview presentation remains for the broader
13a review.

Code review found that the harness replaced a source's decode-cache marker between
cases. The marker now survives reuse. Static follow-up review, syntax and lint are
clean. The original measurements above predate that orchestration correction;
the follow-up below reran the corrected driver after the independent benchmark
ended and reproduced the membership results.

### Running-player gap observation

The corrected membership driver and optional playback probe completed successfully
on generated media. The prior frame identities, 10/20 ms writer durations and
composition decoder limitations reproduced. The new [raw rerun report](playback/rerun-report.json)
and per-case acquisition ledgers preserve the observations.

Two-second empty edits survived passthrough export in both cases:

- **Leading gap [0,2)s:** AVPlayerItemVideoOutput acquired a nil no-display
  reference at display time 0, then FRAME 1 at display time 2s.
- **Internal gap [1,3)s:** it acquired FRAME 0 at display time 0, a nil
  no-display reference at display time 1s, then FRAME 1 at display time 3s.

During each gap's interior the running player produced no new reference and the
last acquired reference remained the explicit no-display state. The internal-gap
clear was observed within one 16ms polling interval after 1s with display timestamp exactly 1s;
this is a polling observation, not a measurement of vsync precision. Saved PNGs
are the actual acquired buffers, not fabricated black gap images.

This resolves the earlier ambiguity at the **player output** boundary: the raw
reader's duplicate FRAME 0 inside an empty edit does not imply that the player
presents that image. Apple's
[copyPixelBuffer contract](https://developer.apple.com/documentation/avfoundation/avplayeritemvideooutput/copypixelbuffer(foritemtime:itemtimefordisplay:))
and installed AVPlayerItemOutput.h example distinguish a newly acquired nil
reference from an absence of new data. The former communicates nothing to display.
The probe does not observe AVPlayerLayer's final screen compositing or establish
whether a particular player background appears black or transparent. No production
fill policy or renderer contract is selected by this checkpoint.

Reproduce after building core with
`SCREENREC_RENDER_PLAYBACK=1 node helpers/mac/Tests/render-membership.mjs`.
The observer bounds runtime to 15 seconds and saved images to 128, uses a muted
player on generated sources, verifies source hashes, and rejects normalized-away
gaps. The full 13a rendering gates remain open.


Three full driver executions finished successfully. The final two assert the
observed no-display transitions, checks gap interiors, and independently matches
all acquired PNGs to generated frame identities (RGB MAE 8.67–9.04/255). That
metric verifies identity with conversion tolerance, not exact color equivalence.
The independent static Codex review found no actionable defects and confirmed the
SDK interpretation; no production files were changed.

A deliberate probe mutation that kept the prior presentation state after a nil
acquisition failed the gap-interior assertion. It was restored before the final
green run. Focused JavaScript lint and format checks also pass.
