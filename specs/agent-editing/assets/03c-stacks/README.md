# Ordered stack authoring

The [public package probe](../../../../packages/test-harness/editing/processors.mjs)
passes `--case ordered-edits`; its [report](report.json) shows authored order,
bypass and independent split identities. Initial [operation](red.txt) and
[split](split-red.txt) failures precede support. All 78 composition tests, build
and type checking pass; routing and linked-replacement probes remain green.
Independent Codex review found no actionable correctness, atomicity, lifecycle,
ownership or bounded-performance defect in the requested scope.

One target-owned processing collection replaces the empty effects placeholder.
The pure get/set interface handles repeated gain steps, empty clear, stable IDs,
new-ID labels, no-op sets and actionable foreign/duplicate-ID failures. Disabled
steps retain settings but still require valid media compatibility.

One processing lifecycle helper serves partitioning, duplication and replacement.
Constant gain settings survive exact fractional splits, padded replacement and
ripple boundaries; new pieces receive independent IDs and report lineage.
Replacement reset is explicit, and deletion removes only owned processing. Parent
stacks stay parent-owned and new clips inherit no copied configuration.

These are authoring and edit guarantees, not audible DSP or public service
acceptance. Capabilities explicitly report gain execution as unavailable. Native
execution belongs to 05/08, visual variants to 15, windows/curves to 16, and verified
denoising to 12c/15a. No model was prepared or audio played by these tests.
