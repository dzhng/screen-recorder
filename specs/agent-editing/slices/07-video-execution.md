# 07 — Execute video plans

Status: not started. Dependencies: [02](./02-assets.md), [05](./05-compiler.md), [06](./06-render-reproduction.md).

## Contract

The selected native executor faithfully renders compiled video requests, including arbitrary admitted source order and requested canvas.

## Seam and ownership

Adopt the frozen slice 06 mechanism behind one composition video execution operation in the native worker. Service binds retained asset files; native decodes/composes/encodes, never edits or infers placements. Validate export-profile capability explicitly.

## Work and review surface

Consume bounded schedules from slice 05, preserve PTS/orientation and source gaps, handle repeat/reorder/holds and a single visible layer at each time. Implement background/canvas sizing and matching frame/range rendering. Layer geometry is slice 15; this slice only executes already resolved full-frame placements.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/video.mjs --case repeat-reorder
```

## Acceptance

Production-entry matched-input parity against slice 06, exact counter membership, range/full phase agreement, odd-size explicit rejection/padding, cancel/restart cleanup and bounded memory on repeated sources. Test decoded output rather than receipt metadata alone.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **temporal source membership**, using counter and source landmark regions; multi-layer geometry and typography are out of scope. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

If decode throughput or seek behavior fails, isolate source scheduling/decoder reuse; do not build a new editorial model in Swift or hide errors with duplicated/black frames.

Delegated: Decoder pooling and buffer management within measured limits. No changes to composition semantics or accepted reproduction settings without revalidation.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.

