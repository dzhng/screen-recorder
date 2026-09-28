# Comparable frame colors

Status: profile comparability and numerical gates pass. Fresh unprimed review
accepts the limited sampled membership/framing/color-comparability gate. No
production renderer, source selection or image bytes were
changed by this pass.

## Why the original comparison was wrong

The demanded PNG declares sRGB. The original ffmpeg movie PNG declares BT.709
through cICP/gAMA metadata. Stacking their RGB bytes into one PNG cannot preserve
a different transfer profile on each half, so the movie half appeared darker.
Those original sheets remain in the [native checkpoint](../10d-native-pictures/EVIDENCE.md)
as rejected comparisons, alongside the unchanged numerical movie/frame evidence.

The actual macOS movie decode uses `kCGColorSpaceCoreMedia709` (HDTV ICC).
Substituting a generic named Rec.709 ICC profile is not equivalent. An independent
AVAssetImageGenerator read retains that actual profile; CoreGraphics draws the
selected picture into an explicit sRGB bitmap before PNG encoding. This is a
profile conversion, not a brightness adjustment fitted to the demanded image.
The generator has zero timing tolerance and must return the exact requested movie
presentation timestamp.

A concrete B00 flat-color observation demonstrates the distinction: demanded sRGB
was `[32,100,29]`, while the unconverted ffmpeg movie RGB was `[28,88,29]`.
AVAssetImageGenerator plus ColorSync/sRGB gave `[30,99,30]`, exactly the existing
native `media.frame` movie decode at that location. The new test reference uses
CoreGraphics rather than the production CoreImage/FrameImage implementation.

## Evidence and gates

The [comparison harness](../../../../packages/test-harness/editing/picture-color.mjs)
consumes already verified demanded frames and movies. It verifies actual sRGB
metadata on both PNGs and independently expected corpus picture identity, records
exact reference timestamps/ICC hashes, and reports bounded pixel differences.
The reference generator does not perform editorial time mapping.

`report.json` retains all 386 pair measurements across 18 cases.
`reference-receipts.json` preserves the independently selected movie timestamps
and profiles. Mean grayscale MAE across the corpus changed from 3.7845 in the
mixed-profile comparison to 0.5324 in the common-profile comparison; the largest
per-picture common-profile MAE is 1.2424. These are observations, not new
acceptance thresholds. No existing pixel/timing/membership tolerance was loosened.

`profile-bypass-mutation.log` records the intentional failure when the helper
encoded the original movie image without converting it. The check refused its
actual PNG transfer metadata even though the helper's declared output-profile
receipt still said sRGB. Restoring conversion passed the complete corpus.

Corpus reference masks now have one test-helper owner. The existing movie gate
was rerun across its full temporal corpus and refusals, and the focused frame
regression retained delivery sizing, physical gaps, fractional sample provenance
and cancellation checks. Original movie exact-pixel comparisons remain unchanged.

## Fresh review inputs

`visual/` contains all corrected scenario sheets and five corresponding crops.
Pairs are demanded PNG left, independently decoded/profile-converted movie right;
there are four pairs per row in chronological order. Unused cells are black.
These retain the original framing and asymmetric landmarks. A fresh reviewer
with no inherited context inspected nine corrected captures. It found matching
identities, orientation, markers, letterboxing/pillarboxing and sampled gaps/returns,
with no crop or transition loss. Minor right-hand B00 text softness/green halos
and marker-edge differences remain legible; subtle flat-color differences do not
form the previous substantial brightness distortion. The integrating reviewer
agreed. This accepts only that sampled visual gate; exact timing is established
separately, and broader profile/codec quality remains open in slice 06.

Independent code review found no actionable defect. It checked retained counts,
exact timestamps, ICC receipt linkage, metric arithmetic and mask equivalence;
native runtime checks were not independently rerun by that reviewer.
