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
  the bound label, a projected project read decorates the matching generation, and
  a different generation is rejected.

Selected-range preparation, project transcript word attribution, package label
replay, overlap/unknown presentation and long-form continuity remain open. Slice
31's ten-minute four-speaker quality gate is still red, so this is a partial
public binding checkpoint rather than completion of slice 32.
