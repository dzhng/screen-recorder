# Compiled picture execution

[The picture executor](CompositionPictureExecutor.swift) executes one graph for
still images and movie frames. Project placement, source choice and parameter
clocks come from the [composition compiler](../../../../packages/composition/README.md).
Native code resolves physical sample support and draws pixels; it does not
reconstruct cuts or restart frame phase at a preview origin.

PNG and movie encoding consume the same graph through different output targets.
Keeping still encoding separate avoids quantizing an inspection image through
movie color conversion. Source support and orientation remain shared.

Physical empty edits and compiler-excluded source pictures can become background
only under the admitted selection. Missing ancestor support or unknown physical
timing cannot be repaired by finding another child picture. Reused decode state
must retain each occurrence's own selection and acquisition disposition.

Pointer runs are supplied evidence, not inferred gestures. Missing observations
leave missing marks; coordinates use half-open source pixels. Readability is judged
in delivered pixels, so thumbnail sizing must account for source crops and ancestor
transforms rather than applying a second independent mark-size rule.

[The video renderer](CompositionVideoRenderer.swift) consumes bounded compiled
records with their original sample times and clipped visible intervals. Publication
uses the shared new-file owner. [Appearance and temporal references](../../../../packages/test-harness/editing/README.md#platform-reproductions)
separate pixel execution from codec loss and physical-input acceptance.
