# Scoped review

Refactor-clean: the compositor remains the only production blend owner. The scalar
reference is test-only, with no runtime backend selection. Standard-library PNG input
construction and the existing PNG/movie readers avoid another renderer or observer.
The native selector now invokes its existing pixel test.

Code-review: explicit operands, source/backdrop order, transparent arithmetic, grouped
combination and frame/movie clocks were traced against their owners. Reference tests
pass; their deliberate arithmetic falsification fails. Deliberately supplying normal
native input also fails the independent multiply comparison. Scoped lint passes.
No production blend arithmetic changed.

Write-docs: the harness guide links to the executable source and retained evidence.
Slice, handoff and traceability distinguish compiler/native proof from public admission.
Choices are recorded in the feature ledger.

Independent Codex review started but wandered into unrelated large speaker dependency
inventories; it was terminated without a final verdict. That review is incomplete,
not clean. Finish it and fresh visual critique after integration. No full repository
run was performed while the feature implementation remains ongoing.
