# Constrained geometry delivery

`planSubjectFraming` converts an explicitly selected pinned face into ordinary
geometry. It returns a proposal and violations; it never selects a face, runs
Vision, applies an edit or claims an impossible request succeeded. The caller
owns the target, margins, zoom bounds, preservation policy and whether a refused
proposal should be inspected or applied.

[The public checkpoint](../../../../packages/test-harness/editing/subject-observations.mjs)
reuses the frozen source observations and existing CLI/MCP lifetime owner.
[Delivered evidence](delivery-evidence.json) retains every explicit request,
observation hash/generation pin, proposal, receipt and source/output identity.
[Shots](shots/) show real hosts before/after with independent references. The
pure constraints remain in
[subject-framing.test.ts](../../../../packages/composition/src/subject-framing.test.ts).

The accepted comparison uses independent top-left crop/placement arithmetic with
the declared platform linear-light resampler, not the product compiler. All
source-perimeter raster sites are included for contain proposals. Their maximum
channel difference is1 under the unchanged gate8; black outside the declared
source footprint is exact. Accepted target centers have zero authored pixel
error. Every executable static proposal also passes the full-raster maximum8/mean2 gate, including crop samples; all measurements remain in the receipt.
The earlier encoded-space CoreGraphics reference has different interpolation at
high-contrast edges; [that comparison](encoded-space-reference.json) remains a
failed sampler comparison, not evidence that content was cropped away.

Lily's low framing is handled explicitly: full-source containment can reach the
requested vertical point but cannot move the face horizontally when the full
source already fills the width. Tight crop/margin and zoom-cap requests retain
their refusal. Refused proposals shown for inspection do not claim their targets,
margins or zoom limits passed. A source-bound uniform-zoom conflict returns no
geometry or zoom proposal, preserving the prior picture; it cannot stretch a face
to conceal missing source height. The [historical distortion](source-bound-failure.json),
its complete operands and raster max14 failure remain retained. Original sources
remain unchanged.

The moving checkpoint authors ordinary per-observation hold curves from retained
Graham boxes. A planted missing observation holds the previous accepted proposal;
no smoothing or improved detector accuracy is claimed. Six delivered temporal
samples match independent references within a mean channel difference below1.
Public split, repeat and2×retime samples are byte-identical to the corresponding
pinned pictures. Replay renders saved geometry and needs no replacement detection.
These are geometric delivery claims; the source full-face quality gate remains
open in [face evidence](../15-face-observations/README.md).

Closeout review: the independent visual pass found no visible stretching, lost
source corners or orientation errors in contain/crop sheets, and the refused cap
states remain visually unchanged. Enlarged subject crops are soft and the sampled
motion sheets cannot establish every in-between frame; the numeric full-raster
receipts remain the geometry evidence.
