# Authored layer fixtures and independent oracle

This is a helper prerequisite, not native or public layer acceptance. The current
public negative control rejects geometry authoring; actual compositor, CLI/MCP,
preview/export, pointer and fresh visual gates remain open.

The fixture producer creates asymmetric black/white screen and presenter videos,
a white plate for overlap/opacity comparisons, a tagged quarter-turn source, and
independent float stereo narration. Existing AVFoundation/CoreGraphics reference
tools decode the video into normalized sRGB; every pixel is checked against the
authored pattern, including a manually rotated pattern for the orientation tag.
The retained pictures and receipts show those input checks. H264 QP0 was not
decodable by AVFoundation; QP1 inputs pass, so these are not claimed as lossless
encoded movies. PCM narration is authored exactly.

The functional point oracle consumes authored source pixels and effect settings,
never compiled transforms or native effect receipts. It applies top-left inverse
geometry and premultiplied linear compositing, then produces normalized sRGB RGBA.
Source and generated intermediate domains stay explicit. Out-of-domain samples
are transparent; parent opacity processes the flattened surface.

The comparator checks flat-region RGBA, including canvas borders, plus every color
channel's landmark count, centroid, bounds and bidirectional spatial coverage.
Interpolation allowances do not permit disappearing thin contours, reduced contour
density, a color-channel loss or an opaque border becoming transparent. The count
budget is provisionally at most two percent or one pixel; actual native evidence
must establish that the reference and rasterization model are comparable. A native
failure requires diagnosing that difference, not widening a gate just to pass.

Review exposed missing canvas bounds and thin-landmark false positives; local
audit also caught incorrect conversion of premultiplied source bytes. Regressions
reproduce those defects before correction, and nine authored controls now pass.
The one-pixel shift, corner-only outline, alternating outline and white-to-red
controls explicitly prove rejection. Lint and whitespace checks pass. These
reference checks establish neither native output parity nor visual acceptance.

The unfinished public runner and case matrix remain outside this checkpoint. Its
remaining plan includes two canvases, ordered geometry, all target taps, nested
opacity, exact unaffected PCM, preview/export parity, ownership lifetime and an
unprimed visual review. H264 output-alpha restrictions and real pointer composition
must remain qualified until their own execution gates pass.
