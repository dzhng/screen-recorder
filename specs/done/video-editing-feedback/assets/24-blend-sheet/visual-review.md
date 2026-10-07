# Visual comparison and adjudication

The matched sheet keeps normal-before, independent W3C reference, delivered PNG
and decoded movie side by side. [Before/after telemetry](before-after.json)
records changed pixels against ordinary alpha-over; both decoded samples are
identical. [Public parity](public/parity.json) proves public delivery matches the
native images already reviewed. The retained landmarks cover all patch boundaries,
neutral colors, alpha bands, reversed source/backdrop, nested groups, and the
vignette center/corners/full falloff. The sheet was shown in Preview; no human
response is an acceptance gate.

Two fresh image-only reviews disagree about movie edges. The
[Codex critique](visual-critique-codex.md) found one-pixel codec mixing at hard
patch boundaries and small interior drift; it failed the full-reference movie
comparison. The [fresh agent critique](visual-critique-fresh-agent.md) found no
visible differences at 4×. Retain both. Numerical still error is at most one
RGBA level, within the original two-level gate. Movie patch-interior error and
unmasked vignette error are at most four levels, within the original eight-level
gate. The normal control shows the same codec boundary limitation.

Initial verdict: still arithmetic, the declared movie interior scope, exact
spatial support and full vignette falloff passed. Raw full-raster movie edge
fidelity was unresolved, so the slice stayed partial. The independent full-raster
work below resolves that question without treating the earlier positive review
as evidence of lossless fidelity or extending the numerical mask.


## Declared-codec target and full-raster resolution

[Fresh full-raster measurements](encoding/raw-reference-metrics.json) confirm the
previous codec-seam report: all hard-patch cases, including normal, reach 109
channel levels against unencoded RGB. The count above the original movie bound
is entirely in the already-declared fringe. That raw result is red and remains
visible. The clean earlier subjective review does not establish raw edge fidelity.

The acceptance target is corrected to explicit arithmetic delivered through the
same declared output format. The [encoded control](encoding/README.md) first proves
that its single-image, unprocessed reference still matches the independent raw
arithmetic, then uses the exact same frozen H.264 settings and physical clock as
the actual blend movie. Every pixel of both samples passes the original eight-level
bound, without any fringe mask. No backend, setting, threshold or original source
changed. The raw-reference red is not converted to green; it is a different claim
than reproducibility through a lossy output format.

The [fresh image-only critique](encoding/visual-critique.md) accepts candidates
against their encoded references for all rows, all boundaries/corners and complete
vignette falloff, while describing the shared raw-to-movie transitions. It received
the complete full-image and edge-crop set, both samples, neutral labels and the
declared-codec target, without previous verdicts or numerical results. The
[artifact parity receipt](encoding/visual-artifact-parity.json) proves those reviewed
pictures equal the permanent runner's accepted display PNGs. Both subjective
historical verdicts remain retained, with the false-negative raw-edge claim corrected
by objective evidence. Visual acceptance is now clean for the stated movie target;
lossless raw edge fidelity is explicitly unsupported by this H.264 fixture.
