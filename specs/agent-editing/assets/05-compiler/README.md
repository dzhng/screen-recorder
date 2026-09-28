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

Next: unify schedules into a strict worker-facing window request; pin revision,
rendition and dependency/implementation identities; specify raw/dry/after-step
taps; bind prepared retiming without executing unavailable processors. Prove
those contracts before closing 05. Source sample rates/layout remain admitted
metadata consumed by decode/resample preparation; the tested rates here are
output clocks, not a claim of mixed-rate decoded media parity. Windows/curves
and visual processing variants remain rejected by their current authoring schema
until their owning slices land.
