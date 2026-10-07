# Choices

## Sound

### Keep detector boxes and tracking evidence side by side

When an index has a face rectangle, the trajectory read keeps that rectangle's
source observation ID and marks it `observed`. If the tracker cannot match a
sample, the row stays a `gap` or `ambiguous` row; it is never quietly replaced
with a smoothed box. This lets an agent crop from a box while still knowing
which coordinates came from Vision and which association was uncertain.

The plan required observed and inferred coordinates to remain distinguishable.
The trajectory owner is `packages/core/src/face-trajectory.ts`, with the native
association still owned by `face-tracking.ts`.

**Verdict:** sound, high confidence. This preserves the product boundary that
Yap supplies evidence and does not make a crop decision.

### Make quality refusal a readable result

When continuity or correspondence metrics fail, the service still returns the
measured operands and refusal reason. A caller can inspect a failed overlap
recall or competing timing peak without mistaking a successful transport reply
for a successful model or mapping decision.

The plan explicitly separated work state from domain verdict. The receipt
validators in `speaker-continuity.ts` and `correspondence.ts` enforce the
complete metrics before the service retains the result.

**Verdict:** sound, high confidence.

## Provisional

### Admit measured correspondence rather than invent a native estimator

The new correspondence operation accepts a complete, caller-measured set of
anchors and candidates, fingerprints it, and pages it back. This means an agent
can bring evidence from another audio tool into Yap without making Yap choose a
clock, angle, or edit. A future native estimator can produce the same receipt
without changing the consumer contract.

The existing repository has alignment and prepared-tap owners but no general
unlike-microphone estimator. Adding a second numerical runtime just to make the
demo self-contained would create a competing owner.

**Verdict:** provisional, medium confidence. The retained receipt contract is
sound; native estimation and package persistence remain an explicit follow-up
when those owners are introduced.

### Keep continuity candidates service-local until a provider is promoted

The service retains a measured continuity receipt for the running service and
returns the frozen gate outcome on read. It does not stitch independent
30-second speaker slots or claim package persistence when no long-form provider
has passed the frozen controls.

The current provider has no long-form artifact owner, so pretending that slot
numbers are durable people would be worse than a visible refusal.

**Verdict:** provisional, medium confidence. A promoted provider should move
this receipt into the existing durable speaker/package owner before enabling
long-form attribution.
