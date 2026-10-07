# Speaker-label binding checkpoint

This checkpoint adds the caller-authored binding seam for one retained speaker
generation. `speaker.bind` pins the source selection, channel, observation range,
model generation and anonymous slot IDs; it replaces the prior binding atomically
without changing the acoustic evidence or transcript. Source and live project
`speaker.get` interval rows carry `label` only when an explicit binding exists, so
anonymous observations remain honest and generation-local.

Focused evidence:

- `packages/core/src/speaker-labels.test.ts` proves generation-scoped replacement
  and exact stored values.
- `packages/protocol/src/index.test.ts` proves the strict public request shape.
- `apps/service/src/speaker-service.test.ts` proves a retained public read returns
  the bound label, a projected project read decorates the matching generation, a
  different generation is rejected, and an exported package replays the same
  project rows with the caller label without model execution.
- Immutable `speaker-generation` package resources now carry the bounded binding
  list, so source and project package readers use the archived binding rather than
  the live managed label store.

Source transcript reads now accept a generation-pinned speaker selector with its
explicit speaker-bearing stream and channel. Words are decorated only when one
retained turn wholly covers the word and no other speaker intersects it; a partial
competing turn is `overlap` evidence. Boundary crossings without a complete cover
remain `unknown`, simultaneous full coverage remains `overlap`, and caller names
come from the immutable binding digest pinned into the continuation. The pure
attribution rule is covered by `packages/core/src/speaker-attribution.test.ts` and
the strict selector/cursor shape by `packages/protocol/src/index.test.ts`.

Project transcript joins and bounded selected-range preparation are integrated.
Each admitted range is an independent generation on the original provider's
80ms score grid, from 80ms through at most 30 seconds; slots are never carried
across windows. Slice 31's ten-minute four-speaker quality gate is still red, so
long-form continuity remains open and this is a partial source/project
attribution checkpoint rather than completion of slice 32.
