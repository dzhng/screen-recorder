# Full-raster blend reproducibility through declared encoding

The [runner](../../../../../packages/test-harness/editing/blend-encoding.mjs)
encodes each banked independent W3C arithmetic image as one opaque, unprocessed
image clip. The existing composition/native delivery path supplies the same
frozen H.264 settings as the actual blend movie. No blend operation contributes
to the expected movie, and its delivered pre-encode still must first match the
banked arithmetic image. The existing independent display/sample readers observe
both samples, their physical support, and every output pixel. Reference/source
identities are checked before and after execution; the runner's help owns use.

[Raw measurements](raw-reference-metrics.json) settle the earlier visual dispute:
hard patch edges fail raw RGB fidelity, including the normal control. Every
pixel exceeding the original movie limit lies in the frozen boundary fringe;
the smooth vignette stays within the same limit without a mask. That red result
is retained, not repinned or replaced with a lossless claim. The existing
independent sRGB observer read frozen PNGs without rendering source media.

[Encoded-reference requests/results](report.json) pass every pixel of both movie
samples under the original eight-level tolerance, with no fringe mask. Maximum
errors are two to six levels. Exact rational support is [0,200ms), with two 100ms
spans. The independent reference pre-encode still remains within the original
two-level bound. A [normal-output substitution](normal-substitution-red.log)
fails the full-raster multiply comparison at 253 levels; restoring the requested
output passes. This prevents the encoded control from laundering a missing blend.

[Complete comparison](full-pairs-2x.png) and [edge details](edge-crops-4x.png) contain
all cases and both samples; the [crop manifest](crop-manifest.json) preserves bounds
and neutral column labels. The fresh [image-only review](visual-critique.md) finds
no candidate-specific defect against the encoded references and observes shared
output-format transitions against the raw image. The prompt supplied only those
two images, column/row meanings and the declared-codec target, withholding prior
verdicts, implementation, metrics and expected outcome. Native source pictures
remain retained beside this evidence; these zooms supplement them.

Acceptance means reproducibility of explicit blend arithmetic through a declared
output format. It does not promise that H.264 preserves an unencoded RGB edge.
Future grading/export checks must retain raw pre-encode proof, matched settings
and full-raster encoded references rather than silently inheriting a patch mask.
This fixture certifies static SDR sheets, alpha/order/group controls and a smooth
vignette; it does not certify arbitrary motion, HDR, every codec or lossless export.

The complete comparison was shown inline during closeout. Preview window
inventory did not respond and its owned AppleScript process was stopped; no
Preview display is claimed for this new set, and no human response gated closure.
