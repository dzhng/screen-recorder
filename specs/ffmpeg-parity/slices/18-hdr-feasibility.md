# 18 — HDR-to-SDR reproduction

Status: transform and intermediate recipe reproduced on the pinned libzimg build; production derivative admission/validation remains 19. Question: **Can a pinned explicit transform handle selected HDR input families correctly?**

Dependencies: [01](01-lgpl-build.md), [04](04-input-authority.md).

## Contract and owner

Native color policy/asset admission and bounded FFmpeg transform research.

Use actual metadata-bearing PQ/HLG samples, compatible working-space conversion and tone mapping; add libzimg only if needed. If it changes the frozen build, reopen 01 and rerun affected 02–05 proofs before 19. Reference experiments may use a separately identified candidate build; it is never treated as the installed production runtime. Freeze supported metadata/input families and transform parameters. Unknown metadata refuses pending explicit interpretation. Tagging Rec709 alone is never conversion.

## Focused proof and review

Short transformed fixture with color and timing receipts.

Verify linearization, primaries/matrix/range, appearance against independent SDR reference, clipping, rotation once, stream offsets and actual support. Record unavailable local zscale as dependency evidence. Judge highlights/skin/chart regions, not overall editing taste.

Retain source/control and candidate shots. Use compare-screenshots to judge the named variable/crop; show useful shots with preview-shots. As the last visual acceptance check, run unprimed screenshot-critique. Human response is a non-blocking chance to redirect reversible choices: allow about five minutes while doing other work, then decide from evidence, record the verdict and close opened shots. Never claim unseen or unheard quality.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. The recipe/provider/build decision is a measured research deliverable; freeze it and its limits in this file before any dependent implementation. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.

## Frozen transform and intermediate recipe

The explicit recipe interprets BT2020 nonconstant-luminance limited-range PQ as
ST2084 display light and HLG as a 1000 nit display with BT2100 system gamma 1.2.
Nominal reference white is 100 nit; caller selects 1000 nit peak policy, not inferred
from absent mastering metadata. Unsupported primaries/matrices/ranges, unknown
transfer, alpha, ICC/custom/log or dynamic HDR interpretation refuse. This is
an explicit SDR derivative, never an implicit fallback for untreated HDR.

Use zscale exact gamma (`agamma=0`) to linear float, convert primaries to BT709,
apply Hable maxRGB tone mapping with `desat=0,peak=10`, then exact display-referred
BT709 inverse BT1886 gamma 2.4, limited-range YCbCr and error-diffusion dither.
BT709 gamut excursions clip at the explicit SDR output boundary; no creative
gamut compression or hue-preserving wide-gamut promise. The research runner owns
the exact argv. Two independently authored out-of-BT709-gamut cases join the
held-out chart and meet the original 3/255 tolerance after this clipping policy.

The managed intermediate is ProRes 4444 MOV without alpha, preserving 10-bit
conversion before the codec's 12-bit representation. This is an internal explicit
source-asset recipe; final delivery formats remain separately selected by export.
It uses more source storage/encoding work than H.264, but eliminates H264's observed
chroma-boundary softening from the conversion oracle. At 320×192 one-frame research
sizes were 5,697 bytes ProRes versus 10,998 bytes high-bitrate H.264; these tiny chart
sizes do not establish general compression cost or throughput.

Keep `-copyts,-noautorotate,-fps_mode passthrough,-enc_time_base demux`; MOV edit-list
and track clocks must preserve admitted exact timebase. Preserve
original display-matrix metadata once; do not bake rotation and retain it again.
ProRes with the demux timebase carries actual decoded frame duration, including
the final sparse frame. No packet-duration rewrite is required. The failed
H.264/default-timebase control extends a 33.333 ms final frame to 250 ms. The selected
ProRes/demux recipe preserves three-frame support `2350000/3us` and exact source clock
`1380001/3 us` at derivative zero. Video-only conversion changes the asset common
origin; 19 must persist and validate its exact source→derivative clock mapping,
not mistake a new zero-based stream for the original source clock.

## Retained reproduction

[Calibration](../evidence/hdr/calibration.json), [held-out control](../evidence/hdr/held-out.json)
and [clock control](../evidence/hdr/clock.json) retain actual runtime/input/output
identities and original native facts. The first candidate was separately built;
these receipts instead execute 01's owned pinned dependency build, FFmpeg SHA
`8410694433e927bdf2cc751b8c81cb4545b2302828fdffed6044018b10f39f31`,
zimg 3.0.6 SHA `4c6e5265b4ee0774c5a15ab93d93cc2871931c129aa3b9174b10272e5e75d966`.
These corrected operands rerun against01's final matching-controller build,
recipe `be0223014e418d56cf920abd91c7a0f358a94526d58d5afdc1eb258b7693f139`.
The runtime/dependency receipt and source/output byte identities are retained.

The [standards chart](../../../packages/test-harness/editing/hdr-chart.py) generates
ST2084/HLG signal and independent analytic display reference without using a color
converter as the oracle. The [reproduction](../../../packages/test-harness/editing/hdr-conversion.mjs)
borrows the actual native-probed source descriptor, replaces its pathname, then
executes through the existing CLI owner. PQ and HLG calibration/raw/intermediate
patch errors are at most 1/255; held-out PQ is 3/255 and HLG 1/255, within the
unchanged 3/255 threshold. The HLG approximate-gamma control fails at 22/255
(calibration) and 44/255 (held-out) despite its gray ramp looking correct. Exact
gamma resolves it. Output native color tags are 709/709/709; sample facts and
occupied segments match one-frame sources. The ProRes intermediate itself is
encoded through retained descriptors and exclusive output allocation while the
source pathname replacement remains present. Whole-frame raw→ProRes maximum
is 1/255 in all four calibration/held-out cases; an H.264 boundary control fails
the same 3/255 budget at 31/255 and 61/255. This is component color evidence,
not a project, preview/export, real-world scene or release readiness claim.

[Clock reproduction](../../../packages/test-harness/editing/hdr-clock.py) independently
authors sparse frames, delayed audio and rotation metadata. It exposes the failed
H.264 inferred tail and verifies ProRes demux-timebase support/matrix/exact origin.
The actual final duration used by a production validator must come from the native
presented-sample cursor as an exact rational fact. Rounded min/max sample labels
or FFprobe timing are insufficient to certify final support. 19 will add that
required native fact before producing or admitting a derivative.

## Review corrections

Independent review identified four gaps, all corrected: the authored source
clock now uses explicit filter/MOV clocks and asserts independently authored
0.500000333…, 0.750000333…, 1.250000333… s input support; intermediate encoding
uses the held source/CLI allocation owner under the pathname canary; whole-frame
boundary fidelity is enforced alongside the independent patch-color oracle, with
a failing H.264 control; and the clock receipt binds runtime/dependency/native
and original/output hashes. The earlier clock comparison preserved its encoded
input but had not proved that input matched the intended setpts oracle. The new
exact source assertions remove that overclaim without relaxing any tolerance.

Final independent code review found no remaining actionable defect in this
research scope. It cross-checked corrected authored timestamps, retained identities,
patch/full-frame errors and failing H.264 controls against final-build artifacts.

## Visual review and remaining gates

Native-size reference→transform images align; dark/highlight steps remain separate
and chart/skin-tone-like patches retain their expected hue. The first fresh critique
found H264 boundary softening, confirmed by decoded border values, so that candidate
was rejected as the conversion intermediate. ProRes resolves the boundary finding:
whole-frame raw→intermediate error is at most 1/255 on the calibration fixture.
A fresh ProRes critique sees sharp retained boundaries, no crop/displacement,
seams, blocks or merged dark/highlight steps. A low–moderate olive-patch hue concern
was inspected numerically: its entire patch remains within 1/255 of independent
reference; no material hue defect beyond quantization was found. Saved full-size
reference/candidate/intermediate images are retained in the evidence folder.
A separate held-out critique reports slight gray-boundary softening. Complete
nearest-neighbor 4× gray crops retain step positions and separation; the
[boundary receipt](../evidence/hdr/grey-boundaries.json) bounds every full-width
patch to at most 1/255 level variation. This is real codec quantization, accepted
within the frozen 3/255 whole-frame intermediate budget; no zero-loss picture
claim or tolerance change is made. A fresh crop critique agrees steps remain
distinct/aligned, while perceiving feathering. The recipe acceptance is bounded
chart fidelity, not a claim that displayed images certify creator intent.
These charts cannot establish natural-scene detail preservation or creator intent.

Preview was already in an unverified cleanup state owned by another lane. One
scratch-chart open preceded receiving that constraint; an exact six-document-only
close request hung and was interrupted, so cleanup is unverified. No global quit
or user's documents were changed. No further Preview windows are opened; saved
images/inline inspection and independent image-only CLI critique supply the review.
The reversible image checkpoint proceeded from evidence without requiring human
response or changing the intended appearance contract.

19 remains gated on native exact final-sample fact, explicit derivative provenance,
source/admission/publication lifetime, rejection tests and matched converted-asset
placement/preview/export checks. 01/02–05 must refresh affected prepared-runtime
receipts; this research neither mutates the root distribution nor waives those gates.
