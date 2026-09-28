# Pointer encoding parameter experiments

Two separate compression-setting changes were tested against the frozen
[writer-input parent](../06-pointer-writer/README.md). Neither changes production.
The high-rate candidate passes the original three-sample magenta-centroid criterion;
all-intra encoding fails. This identifies a useful rate-control effect for this
cohort, not an accepted general export policy or exact colored-pixel preservation.

| Factor against unchanged parent | Original x-centroid deltas at frames 10 / 11 / 12 | File bytes: full / range | Disposition |
| --- | --- | --- | --- |
| Platform defaults | 1.090 / 1.062 / −1.009 | 2479 / 1242 | Existing failure retained |
| Every frame a keyframe | 4.477 / 0.030 / 3.467 | 7122 / 1683 | Discard; two samples worse |
| Requested 40 Mbps; original keyframe policy | −0.068 / −0.198 / 0 | 7756 / 2370 | Keep as scoped research candidate |

The strict criterion remains less than one pixel on both axes at the original
red-channel threshold 20. Thresholds 19 and 21 are recorded separately; they do
not determine acceptance. Complete [all-intra](all-intra/report.json) and
[high-rate](40mbps/report.json) reports retain counts, membership overlap and all
six writer-input comparisons. Every candidate input pixel and entire observed
trace exactly matches its parent. Candidate frame metadata confirms actual
keyframe behavior. No change to source selection, frame scheduling, color
attachments or glyph rendering explains the different results.

The rate candidate still has 315–441 changed decoded channels between matched
full/range frames, with maximum differences 3–4. Both movies are lossy outputs;
agreement with one another is not ground-truth color fidelity. The requested
bitrate is an encoder input, not an achieved file rate or recommended universal
setting. Tiny synthetic movies cannot establish real-content size/quality cost.
The earlier whole-image and legacy exact-byte gates remain open.

Independent ffmpeg decoding corroborates failure for all-intra and success for
the rate candidate at the original criterion. Its pixel interpretation differs
from Apple's decoder, so these results are kept separate and do not replace the
original evaluator. Passthrough frame timing is required for this diagnostic:
ffmpeg's default output cadence duplicated clipped samples and was rejected by the
frame-count guard before measurements were accepted.

## Reproduction and research boundary

The [plan](plan.json) records predictions before each trial. Apply exactly one
candidate patch to the parent's instrumented scratch package, whose complete
reproduction and hashes are retained with that parent. Build in an isolated Swift
scratch directory and freeze the executable. Never combine the two patches.

Run `node specs/agent-editing/assets/06-pointer-encoding/run.mjs <repository> <worker> <fresh-output> <all-intra|40mbps>`.
It compiles the existing independent Apple decode/pixel tools, reuses immutable
parent requests/inputs, checks actual pre-append trace equality, and writes media,
receipts and measurements. `independent-decode.py <output>` provides a separate
ffmpeg confirmation with timestamp passthrough. The first runner invocation failed
before creating outputs because `map(resolve)` passed array callback arguments;
[the failed log](trial.log) is retained. It was repaired once before either measured
trial. No models, network downloads, capture or playback were used.

[Independent review and confirmation](review.md) verify the scoped result and
existing native movie regression gates. [Recorded-content expansion](../06-recorded-rate/README.md) finds no sampled
pixel or file-size change from the rate setting, with whole-image quality still red. Do not tune
more constants on these same three samples or promote 40 Mbps from this result.
A production policy still needs whole-content quality, duration/size and range
behavior evidence; all-intra is not a winner to combine with it.
