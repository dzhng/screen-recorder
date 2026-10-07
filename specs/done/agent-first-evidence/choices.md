# Choices

## Sound

### Keep detector boxes and tracker evidence side by side

A trajectory row keeps the detector's source observation ID and marks the row
`observed`; unmatched, reset, and close-score associations remain `gap` or
`ambiguous`. An agent can crop from a box while knowing which coordinates came
from Vision and which association was uncertain. The owner is
`packages/core/src/face-trajectory.ts`, with native association still owned by
`face-tracking.ts`.

**Verdict:** sound, high confidence. It preserves Yap's evidence-only boundary.

### Make quality refusal a readable result

When continuity or correspondence metrics fail, the service still returns the
measured operands and reason. A successful transport reply therefore cannot be
mistaken for a successful mapping or model. The validators in
`correspondence.ts` and `speaker-continuity.ts` enforce complete metrics before
retention.

**Verdict:** sound, high confidence.

## Provisional

### Admit measured correspondence instead of inventing an estimator

The correspondence operation accepts a complete caller-measured set of anchors
and candidates, fingerprints it, and pages it back. A future native estimator
can write the same receipt without changing consumers. The repository has no
unlike-microphone estimator owner, so adding a second numerical runtime would
create competing clock arithmetic.

**Verdict:** sound for this release, medium confidence. Native estimation and a
durable package owner remain the next extension seam.

### Keep continuity candidates service-local until provider promotion

A measured long-form candidate is retained for the running service and returned
with its frozen gate result. The implementation does not stitch independent
speaker windows or claim package persistence when no provider has passed the
controls.

**Verdict:** sound for this release, medium confidence. A promoted provider
should move the receipt into the existing durable speaker/package owner before
enabling long-form attribution.
