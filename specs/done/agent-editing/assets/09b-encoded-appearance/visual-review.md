# Independent still-frame critique

The [fresh critique](fresh-visual.log.gz) received only the neutral brief and
review artifacts. It inspected all 26 prepared sheets, covering every occupied
thumbnail across the 580 recorded frames, all small contexts and enlarged
pointer crops, and all seven recorded context/crop pairs. It additionally
attempted 13 native-image inspections using scratch sRGB conversions. Those
scratch observations have the presentation limitation described below.

The reviewer correctly distinguished both deliberate defects: the missing
pointer/trail is plainly absent, and the shifted pointer/trail moves left while
the transformed gray rectangle stays fixed. It observed softer, less distinct
segments in the positive encoded thin trails. Recorded context sheets preserved
visible layout, content, landmarks and pointer-path placement. Detailed crops
showed softer or uneven fine lines, rougher lettering and colored edges, and
slightly reduced differentiation in pale/green-gray details. No conspicuous
common-space global color cast, convincing full-versus-range advantage, or
obvious blank/corrupted thumbnail was reported.

These are scoped visual observations, not acceptance of all encoded appearance.
Thumbnail coverage cannot exclude subtle per-frame defects. Most recorded frames
were not individually inspected at native resolution. No actual movie playback
occurred, so motion smoothness and continuous playback remain unverified.

## Standalone B-0 presentation discrepancy

The reviewer reported a black standalone B-0 while the decoded B-0 and prepared
composite showed the scene. The [investigation receipt](standalone-b0-investigation.json)
checks the original files against the committed manifest: standalone B-0,
decoded B-0 and its neutral alias have identical SHA-256 and contain the same
opaque nonblack rectangle, pointer and trail. Their selection and archive are
correct; no frame was replaced or rerendered.

The reviewer's `sips` scratch conversion is also byte-identical to its converted
decoded counterpart. Its pixels remain opaque and nonblack, but the image-view
tool reproduces a black display for both files. In local inspection, removing both eXIf and iTXt
metadata, without changing the IDAT image data or sRGB tag, displayed the visible
scene. Reserializing that same raster with explicit sRGB ICC also displayed it.
The original scratch PNG and both presentation variants are retained in
[presentation-investigation](presentation-investigation). The exact viewer
implementation cause is not established; this does not demonstrate a black
movie frame or a mismatch in the captured evidence.

A similar black display was reproduced for the reviewer's scratch A-0, while
scratch C-0 displayed normally. Therefore the additional scratch-native
observations must not strengthen the otherwise valid prepared-sheet findings
without a follow-up inspection of correctly displayed originals. The original
critique is preserved verbatim rather than silently corrected.

The [small fresh follow-up](visual-followup.log.gz) then reported original A-0
visible but original B-0 and the explicit-sRGB reserialization black. Original
A-0 and B-0 are themselves byte-identical, so these inconsistent single-image
observations cannot establish a source difference. Metadata removal is therefore
not a proven reliable presentation fix. Both reviews and the local reproduction
are preserved, and no original capture, composite, manifest or movie was changed.
The prepared common-space sheets remain the basis of the scoped visual findings;
the standalone black-image observation is unsupported as a source/movie defect.
