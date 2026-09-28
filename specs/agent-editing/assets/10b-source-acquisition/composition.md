# Acquisition-bound composition evidence

Verified at the pure composition boundary on 2026-09-27. No native decoding,
public service, capture, transcription or listening acceptance is inferred.

The [model](../../../../packages/composition/src/model.ts) accepts immutable
acquisition contexts separately from admitted assets. A selected context constrains
an occurrence's existing resolved support; the compiler and exact range projector
consume that same result. Omitting the reference always preserves physical-only
semantics. Contexts can retain bindings for media not used in a particular revision;
selected occurrences must match an explicit binding. Broader acquired support is
intersected with physical support, never mistaken for proof of physical samples.

The [regression suite](../../../../packages/composition/src/acquisition.test.ts)
compares the same bytes under a context with an internal hole, a complete context
and physical-only use. It checks exact range fragments, sample bounds/filter input,
frame availability, physical and ancestor holes, deterministic edit replay,
replacement independent of processing preservation, rejected-batch immutability,
and ripple insert/move/retime. Existing no-context tests remain unchanged.

Verification:

- `bun run --cwd packages/composition test`: 114 tests passed (104 existing,
  10 acquisition cases).
- `bun run --cwd packages/composition check-types` and `build`: passed.
- Bypassing acquisition intersection caused five expected failures, including
  partial words becoming whole and unavailable samples entering compiled context.
  Restoring the implementation returned the suite to green.
- Removing replacement's explicit context reset caused the replacement regression
  to fail because the old context survived omission; restoring it passed.
- Independent `codex review --uncommitted` identified missing context propagation
  in ripple helpers. Three `applyBatch` regressions reproduced the failures before
  repair and passed afterward. A second independent review reported no actionable
  defects and independently passed the 114 tests and typecheck.
- Focused lint has only four pre-existing unused-symbol warnings; no lint errors.

Context metadata adds no alternative asset identity, clock, renderer availability
field, decoder or storage owner. Native video handling of masked physical samples
and durable context retention remain integration gates owned outside this pass.
