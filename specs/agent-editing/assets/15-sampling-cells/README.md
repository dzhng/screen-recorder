# Sampling centers and pixel cells

The compiler expresses selected pixel-center bounds. Core Image's rectangle clamp
operates on pixel cells. Passing center coordinates directly trims half of each
boundary cell and resamples it. The native executor now converts those bounds to
cell edges; source orientation likewise preserves complete decoded pixel cells.
No second geometry calculation or processor is introduced.

The public [composed-border journey](../../../../packages/test-harness/editing/composed-border.mjs)
now checks the full source as well as the crop/padded relationship. The unchanged
four-level source-color gate fails on the prior worker (maximum 179) and passes on
the candidate (maximum 1). Both variants already pass the independent finished-
canvas crop relationship. Exact source pixels come from the authored asymmetric
RGB fixture, not another compositor output.

Four recorded-frame ProRes re-imports also improve from maximum 12–14 to maximum 2,
including outer borders, against the already color-normalized pre-encode picture.
Changing only source orientation or only the compiled clamp produces byte-identical
results to the prior worker for all four; both boundaries must agree. These
one-factor probes remain distinct from accepting any production output codec.

The [verification receipt](verification.json) records native layer/crop/poison
controls, public CLI/MCP layering/lifecycle, pointer geometry, source/frame tests
and builds. No existing threshold was widened or historical evidence repinned.
Affected source-picture, source-scene, composition-picture and movie recipes
advance so altered edge pixels cannot survive in caches under the new behavior.
Images and reports retain the red/green public evidence; broad encoding quality
and full-motion acceptance remain open. [Independent visual review](visual-review.md) found no remaining actionable defect;
its original marker-line concern and resolving control are retained.
