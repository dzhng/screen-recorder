# Nested processing targets

The [routing probe](../../../../../packages/test-harness/editing/processors.mjs)
passes through the composition package's public batch and mapping functions.
Its [report](report.json) verifies nesting, sibling order, stable clip timing and
synchronization, deterministic replay and atomic cycle rejection. The initial
[red run](red.txt) predates support for groups and parent references.

All 73 composition tests, type checking and build pass after integration. A
12,000-group case validates and rejects a disconnected cycle without recursive
traversal. The repeat/reorder corpus and linked-replacement harness remain green.
Independent Codex review found no actionable defect in the routing scope.

The processing tree has one parent reference per node; grouping never changes
clip placements or synchronization membership. One iterative resolver validates
it and supplies the leaf rank used by source/project mapping and later compilation.
Video sibling order is unique across tracks and groups under each parent. Audio
order is deterministic, with no gain or editorial priority inferred from it.

This is a pure model/edit checkpoint. It adds no native DSP, public project service
or denoising readiness. Ordered stack authoring follows in 03c.
