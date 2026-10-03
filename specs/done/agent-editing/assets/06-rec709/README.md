# Explicit Rec.709 reproduction

Status: frozen experiment, independent code review and unprimed visual review
complete. No production export profile is accepted.

The native RGB render target and encoder tags must describe the same color
interpretation. This probe derives the RGB color space from Core Video Rec.709
attachments, attaches that CGColorSpace to the RGB buffer, and requests Rec.709
primaries, transfer and matrix from the writer. Apple distinguishes RGB color-space
attachments from YUV metadata in [QA1839](https://developer.apple.com/library/archive/qa/qa1839/_index.html).
The [runner](../../../../../packages/test-harness/editing/color-reproduction.mjs)
compares both output profiles on the same five source/bitrate cases.

The target is native decoded source appearance with geometry preserved, not an
assertion of intended appearance for untagged footage. The [report](report.json)
retains requests, hashes, native metadata, fixed patches and whole-frame results.
The [summary](summary.json) separates conversion from encoding error. All
pre-encode images pass the unchanged four-level gate. Rec.709 outputs carry
bt709 primaries/transfer/matrix. Full-frame lossy round trips still fail that
gate; the recorded frame at 4Mbps also fails fixed patches. 40Mbps improves this
frame but is not a universal bitrate policy.

An [unprimed critique](visual-review/critique.md) inspected all 23 distinct full
images and enlarged crops, covering 40 captured states with byte-identical
duplicates consolidated. The [mapping](visual-review/mapping.json) relates
neutral labels to stages. It identifies text halos and disrupted grid lines
in both low-bitrate encodes, with smaller residual fringes at 40Mbps. Direct
inspection agrees. Explicit sRGB source reinterpretation is a negative control;
the rotated input is intentionally counterclockwise.

[Frozen checks](tests.txt) verify every retained output hash and pre-encode pixels
for both the original experiment and this one. General encoding quality remains
open in slice 06.

Independent code review confirmed consistent RGB/encoder tags, unchanged sRGB
control images, current source hashes and all three evidence checks. The tests
also probe the retained movie tags directly and recompute fixed-patch encoding
errors from pixels; compression failures remain visible rather than weakened.
