# Sequential pointer schedule

The [schedule owner](../../../../packages/core/src/pointer-schedule.ts) merges
bounded source event pages with exact native presentation intervals. It carries
reset history into the shared eligibility policy: a pointer hidden by A → B cannot
revive when the picture returns to A without a new observation. Kept spans seek
past deleted events while the existing source reader still supplies carry-in
geometry and the latest cursor.

## Evidence

Core type checking, focused lint and all 286 core tests pass. The schedule cases
cover persistent scene resets, final duplicate observations across page boundaries,
pause-at-cut equality, geometry changes, explicit empty intervals, exact fractional
transitions, stationary-position compression, input/output budgets, cancellation
and a destination created during production. The late-cut case skips 600 deleted
cursor records and finishes within a ten-event budget.

Independent Codex review found two fractional-clock defects. Both reproduced red
before correction: a picture at 0.6 µs could pull a pause at 1 µs backwards; and
cumulative visual changes at 0 / 0.1 / 0.2 µs could escape comparison because all
sample timestamps rounded alike. Exact event/sample clocks now govern observation
cutoffs and ordering, while the shared pixel metric remains unchanged. The second
independent review reported no actionable regressions and passed all 286 tests
and type checking. Nearest-still validation retains its existing rules.

One full run overlapped scale work and hit existing five-second I/O-test timeouts.
The affected tests passed in isolation; the normal full suite then passed without
that overlap. No timeout or acceptance assertion was weakened.

[Machine results](results.json) include a probe over the actual 13d1 native streams
with synthetic geometry. The 5,000-span case reads 47.32 MB of native evidence and
emits 5,000 initial states in about five seconds, retaining roughly 0.67 MB extra
heap after collection. These measurements characterize this generated workload;
pointing correctness is established separately by the cursor/scene fixtures.

## Native consumer contract

The versioned JSONL header pins source identity/generation, revision, geometry,
duration and policies. Rows are ordered source-time states with an explicit initial
state per kept span. A null pointer clears the glyph. Fresh observations at an
unchanged coordinate still update core eligibility, but do not emit redundant
identical glyph states. Native must draw these states without re-deciding age,
eligibility, scenes or trails.

The caller supplies files and receipts from the pinned source's own render attempt;
matching dimensions and durations do not authenticate a different source. The
producer bounds visited inputs separately from output bytes, writes a private
staging file, then publishes atomically without replacing another destination.

The next native checkpoint must split held-picture intervals at these exact state
changes, drawing onto the clean held buffer each time. Its output clock must
represent required transitions exactly, or fail before publication. An exact
schedule alone does not prove an encoder's chosen timescale can represent it.

## Merged consumers

On main with preview publication integrated, all [292 core tests](merged-core-tests.txt)
and core types pass. The rebuilt app also passes all [eight public trail tests](merged-public-trails.txt)
through actual CLI/MCP images. Core tests use four workers to avoid unrelated native
workload contention; no test deadline was increased. Native movie composition is
still the next consumer.
