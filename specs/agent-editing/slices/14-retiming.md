# 14 — Integrate independent and linked retiming

Status: not started. Dependencies: [09](./09-first-preview.md), [10](./10-project-evidence.md), [13](./13-stretch-reproduction.md).

## Contract

Linked and independent audio/video retiming works through public editing and rendering, using the accepted stretch implementation.

## Seam and ownership

Composition retime operations resolve durations/attachments; shared jobs prepare exact-identity stretched derivatives; native consumes independent plans. Adopt the frozen slice 13 recipe without a new audio timeline.

## Work and review surface

Slow a selected rushed passage with linked video/evidence, then slow audio alone after an explicit unlink. Separately insert/replace visuals while narration stays at its original speed. Use clip splits for piecewise rate changes; video holds/loops use the existing model. Keep time fitting an explicit agent operation.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/retiming.mjs --case linked-and-independent
```

## Acceptance

Production-entry parity with slice 13 on matched inputs, exact sample count, source/project mappings through repeat/split/retime, attachment timing, range/full consistency, long-run drift and cache invalidation. No DB transaction waits on stretching. Audition the accepted local-change cases.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **retimed event synchronization**, using frame-counter/event landmarks around retime boundaries; layer design and captions are judged later. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

If the production path changes compensation or loses the quality winner, repair parity before tuning. If a new rate lies outside a proven execution capability, report it explicitly rather than substitute another effect.

Delegated: Derived-cache storage and scheduling within the shared job owner. Pitch default, synchronization and timing rules remain fixed.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.

