# Finite alpha movie reproduction

The [native test](../../../../helpers/mac/Tests/motion-alpha.test.mjs) owns generation,
requests and numerical assertions. [The report](report.json) retains complete
native operands/results and per-pair comparisons. Raw straight RGBA is the known
input; native still composition is the control and native movie composition the
candidate. Every pair is left control/right candidate, enlarged 4× with nearest
sampling; originals remain beside them. All ordinary phases and both orientation
variants appear on dark and light backgrounds.

The test uses pinned LGPL FFmpeg 9.0.2 to generate ProRes 4444 with 16-bit alpha,
explicit Rec.709 conversion/frame properties and the MOV color atom. Native
metadata independently confirms primaries, transfer and matrix. Matching these
tags alone does not prove arbitrary source colors or color conversions correct.
The asymmetric flat-primary fixture isolates alpha edges and orientation. It
contains known quarter/half/opaque alpha, transparent surroundings and a moving
blue corner. Known half-alpha matte values are independently asserted, so two
equally opaque outputs cannot satisfy the comparison.

All 12 comparisons pass with maximum channel difference 1/255 and MAE
0.000406901/255. Off-grid queries retain absolute frame phase; the last query
is 999999 microseconds and the exact 1000000-microsecond end refuses source
inspection. Original movie hashes stay unchanged.

Fresh unprimed visual critique inspected all 12 pairs and native-size ordinary,
rotation and mirror outputs on both backgrounds. It found no candidate-specific
halo, color contamination, stray opaque pixels, background mismatch or clipping.
The thin perimeter band is present in both operands and is authored quarter-alpha
support. Marker position and transforms match. This accepts the supplied small
fixture and sampled frames, not arbitrary footage or continuous playback.

[Fault evidence](faults) preserves an opaque-source mutation and omitted-frame-color
mutation. The first fails the known half-alpha value; the second fails native
Rec.709 metadata admission. Restoring the test passes. Two independent code
reviews found no actionable defect; their sandbox lacked the built native helper,
so actual native proof comes from the successful unrestricted run.

A single native Preview launch request included two pairs and caption controls;
the launch command succeeded. Desktop visibility was not verified. AppleScript
cleanup of only those owned documents hung and was stopped; no successful close
is claimed. Saved images were also inspected inline.
