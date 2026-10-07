# Explicit tonal recovery delivery

25A accepts the existing bounded tone contract through actual public delivery.
25B accepts caller-authored hue/split-tone and curve response through the existing
immutable LUT owner, with an independent color/neutral reference and public/native
delivery receipt. This checkpoint does not choose an editorial grade for a user's
video.

[The public runner](../../../../../packages/test-harness/editing/tone-controls.mjs)
freezes its recipe before delivery. The source is the retained 320×180 Lily dry
picture from26, plus an independently authored chart. Geometry, source profile,
alpha and codec policy stay fixed. [The independent provider reference](../../../../../packages/test-harness/editing/tone-reference.swift)
imports no Yap module and applies the declared provider stages directly.

## Contract and provider convention

Public recovery amounts use zero for no treatment. Core Image's highlight
identity is one and increasing its raw value weakens recovery. The shared native
owner maps public highlights to `1 - highlights`, so shadows-only no longer
implicitly compresses highlights. Temperature/tint, exposure, contrast/saturation
and then tone remain one ordered correction. The recipe identity changes with
this response and requires the tone filter to exist. No compatibility provider,
color-space change or movie-encoder change is introduced.

[The preserved provider probe](yap-tone-provider-probe.log.gz) retains attributes
and all measured raw amount combinations. [Old native delivered output](old-native-delivery.json)
fails the unchanged full-RGB maximum-one-code-value gate: shadows-only has
MAE28.91979 and maximum68, while the corrected delivered PNG matches the separate
reference exactly. This directly observed failure complements the native
red/green test and public discovery red/green receipts.

## Frozen acceptance scope

[Requests, identities and results](report.json) retain the exact recipe and
caller-declared face/wall/neutral rectangles. Identity reproduces every delivered
RGB code. All eight single/combined/ordered cases match complete reference
rasters exactly; [local grayscale comparisons](comparison.json) also retain
face, wall and neutral-region responses without excluding any pixel from the
full-raster gate. The reversed-order reference differs, proving this is an
ordered correction rather than a bag of controls.

The frozen shadow0.35/highlight0.3 recipe lifts the real face region's mean luma
from128.01235 to133.78829 and reduces wall luma from192.79030 to190.56208. These
numbers describe this request and this picture; they are neither a face detector
nor universal exposure targets. A prior shadow0.2 candidate failed the declared
face-preservation check and was not promoted. The independent reference selected
the replacement before production delivery; original failed evidence remains in
[the rejected recipe report](rejected-recipe-report.json).

The complete two-frame held-shot H.264 candidate matches a native-encoded
independent reference at RGB MAE0.49695, maximum6 under the predeclared mean-one
code-value gate. [The raw lossless-reference difference](report.json) is retained
separately; encoding is not lossless. Moving shots, general codec/color fidelity
and an aesthetic match to arbitrary third-party media are outside this scope.
The reference direction is source-conditioned: controlled background with a
readable face, preserving the historical rejection of a crushed low-key grade.

[Former controls](former-controls-report.json) retain exact public
exposure/saturation frozen PNG parity, historical identity/bypass/repeat and
matched preview/export frames. Their codec MAE0.56706 stays under the existing
four-code-value gate. The native float test retains exposure/contrast/saturation,
combined neutral order, extended values and alpha. Increasing recovery is tested
in provider parameter direction; this does not promise that every extreme combined
treatment preserves every source gradient or looks pleasing.

## Review

Focused composition tests, service discovery tests, composition/service typechecks
and changed-code lint pass. Core build retains the four inherited face-index
errors at this base; no full-core success is claimed. The whole suite waits for
spec completion. The shape pass keeps translation with the existing native
correction owner, reference experiments with the test harness and job/process
lifetime with the existing public journey. No processing type or dependency was added.

[Scoped code review](code-review.md) and the final unprimed visual review found no
remaining candidate-specific defect. The review fixed runner cleanup/receipt
hygiene before the green rerun. The visual verdict retains shared source softness,
matched codec softening, and temporal/fine-detail limits; do not treat numerical
response as universal aesthetic acceptance.
