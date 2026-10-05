# 16 — SDR correction reproduction

Status: complete; reproduced and independently reviewed before dependent
implementation. No executable product processor is advertised by this slice.

Dependencies: existing contracts only.

## Contract and owner

Native picture/color owner and composition registry research; compatible FFmpeg alternative only if needed.

Evaluate existing Core Image path first for exposure, contrast, white balance and saturation. Freeze units, working domain, order, clipping, gamut and alpha semantics. Test identity and one control at a time. Recipe choice is evidence output; no processor advertised yet.

## Frozen recipe and limits

Use the existing extended-linear-sRGB, RGBAh picture context. In order:
`CITemperatureAndTint` source-neutral Kelvin/tint toward 6500K/0,
`CIExposureAdjust` in stops, then `CIColorControls` contrast/saturation with
brightness zero. Identity skips each corresponding filter. Contrast pivots around
linear 0.5; saturation uses the provider's 0.2125/0.7154/0.0721 luminance weights.
Keep extended negative/above-one working values until existing output conversion;
do not add an early clamp. Premultiplied RGB remains proportional to alpha,
alpha is preserved and transparent black stays zero.

White balance is an explicit provider recipe, not camera-calibrated temperature
accuracy. Changing the source-neutral Kelvin below 6500 cools gray; positive
source-neutral tint removes green. These are source-white correction semantics,
not an invented warm/cool slider. Record the Core Image recipe and actual OS
identity in production support/results; missing bound recipe must refuse.

Slice 17 should begin with static explicit parameters: exposure -8..8 stops,
contrast/saturation 0..2, source neutral 2000..10000K and tint -100..100.
Defaults are 0, 1, 1, 6500 and 0, respectively. These bounds are parameter
admission limits, not a guarantee every setting looks good. No LUT, automatic
white selection, second backend or source-profile widening is necessary.

## Reproduction evidence

[Standalone reproduction](../../../packages/test-harness/editing/SDRReproduction.swift)
pins numeric equations, exact identity, alpha homogeneity, working extension and
order. [Complete operands](../evidence/sdr-correction/proof.json) retain tagged
Rec.709/P3/sRGB and truly untagged stills, independent Core Graphics conversion,
limited ProRes/full H.264 source frames and an actual imported alpha-movie frame.
Profile reference differences are at most one level out of 255; numerical
absolute error is bounded at 0.002. Negating exposure deliberately failed.
The imported-image report initially trapped a valid unnamed ICC; a real system
profile fixture went red, then green after preserving that uncertainty in its name.

Full-range ProRes flags did not establish full-range media; actual probing showed
limited range. MJPEG's metadata probed but native decode refused. The full-range
H.264 reference therefore uses local x264 only as fixture generation, with no
release dependency or admission expansion. P3 movie inspection still refuses.
Untagged ImageIO defaults are observed interpretation, not creator intent.

The independent code review compiled the reproduction but its sandbox rendered
even constant Core Image probes as zero, so it did not validate GPU pixels.
Actual host runs did. Native-size sources and changed patch images remain retained;
nearest-neighbor chart enlargement avoids inventing interpolated patch colors.
The final visual-role clarification found no discrepancy in the intended matched
profile pairs. Original tagged inputs retain their source profile and raw levels;
they are not common-display candidate/reference pairs.
No general skin-tone, gradient, wide-gamut-video, throughput or calibrated-white
accuracy claim is made. No additional Preview batch was opened because the prior
owned batch's cleanup remains unverified.

## Focused proof and review

Matched SDR patches and one imported frame.

Tagged/untagged Rec709, P3/full-limited inputs and alpha edges. Compare independent expected charts/profile and neutral identity. Measure decode/transfer work; do not claim speed from backend policy. Judge each control in its patch crop.

Retain source/control and candidate shots. Use compare-screenshots to judge the named variable/crop; show useful shots with preview-shots. As the last visual acceptance check, run unprimed screenshot-critique. Human response is a non-blocking chance to redirect reversible choices: allow about five minutes while doing other work, then decide from evidence, record the verdict and close opened shots. Never claim unseen or unheard quality.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. The recipe/provider/build decision is a measured research deliverable; freeze it and its limits in this file before any dependent implementation. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.
