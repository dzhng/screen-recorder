# Compiler scheduling evidence

This pass verifies the pure composition boundary only. It opens no service,
decodes no media and makes no CLI/MCP or native-output claim. Slice 05 remains open.

The [probe](../../../../packages/test-harness/editing/compiler.mjs) compares
short-window schedules against full-project schedules and independent rational
clock arithmetic. Its [report](report.json) records fractional frame phase,
exact split preservation, absolute audio endpoints and nested processing order.

The compiler tests additionally exercise acquisition gaps, held frames,
half-open membership, bypass/order retention, nested parent execution order,
late windows in 10,000 repeated clips, lazy two-hour frame iteration, empty
windows with out-of-range next timestamps, and protection against returned-plan
mutation. No elapsed-time threshold is claimed as a performance acceptance gate.

Verification: composition build and typecheck, 85 composition tests, focused
lint, and the compiler probe pass. New behavior tests were observed failing
before implementation. Independent review found mutable empty-stack results and
premature overflow validation of a frame outside the window; both now have
red/green regression tests and fixes. Phase-reset mutation separately falsifies
the range/full comparison. A subsequent independent Codex CLI review found no
actionable defects and independently reran build, typecheck, the 85 tests and probe.

The execution-window pass adds revision/rendition identity, strict serializable
manifests, dry/after-step/processed target taps and unresolved retiming requirements.
A short retimed window retains its full source selection and preparation output
count. Its native readiness guard returns NOT_READY. Request mutation cannot
change an already compiled window; source and processing dependencies exclude
sibling targets and later parent stages. The expanded suite passes 89 composition
tests, build, typecheck, focused lint and the independent compiler probe.

Independent review caught schedule filtering after unrelated sibling work. Window
schedules now reuse the shared clock functions with an index of selected inputs.
A deterministic metadata-read probe changed from four unrelated availability reads
to zero; no wall-clock budget was weakened. Removing the tap filter or retime
requirement also falsified its respective regression assertion. Follow-up review
found no further actionable issues within this partial scope. Final independent
Codex CLI review was clean and reran all 89 tests, build, typecheck and probe.

Next: bind native executors and immutable prepared results, pin actual implementation
identities, and verify the strict window plus streamed schedules through real media
consumers. Typed unresolved requirements are not a passing media gate. Source sample
rates/layout remain admitted metadata consumed by decode/resample preparation; the
tested rates here are output clocks, not mixed-rate decoded-media parity. Windows/
curves and visual variants remain rejected by the current authoring schema until
their owning slices land. CLI/MCP service-to-media journeys remain unbuilt for this
compiler path and must land with those execution routes.
