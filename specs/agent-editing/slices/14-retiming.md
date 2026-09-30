# 14 — Integrate independent and linked retiming

Status: verified through public linked and independent retiming, exact picture
sampling, accepted-audio parity, preparation lifecycle and retained package delivery.
[Root acceptance](../assets/14e-public-retiming/root-review.md) records the complete
journey and scoped visual verdict. Animated gain/zoom and combined denoise joins
remain owned by16/15a3; no additional listening or physical acceptance is inferred.
Dependencies: [09](./09-first-preview.md), [10](./10-project-evidence.md), [13](./13-stretch-reproduction.md), [13a](./13a-stretch-endpoints.md).

[Integrated root verification](../assets/14-bounded-stretch/root-verification.md)
reran all34 checks and descriptor contracts from isolated merged-tree builds.

## Contract

Linked and independent audio/video retiming works through public editing and rendering, using the accepted stretch implementation.

The isolated [native parity prerequisite](13b-native-stretch-parity.md) can proceed
against frozen numerical evidence without enabling public retiming or closing13a.

Shared preparation prerequisite: [14a](./14a-prepared-audio.md).

## Seam and ownership

Composition retime operations resolve durations and attachments. Native requests
prepare exact retained-run scratch before processing; shared jobs publish durable
full-output audio through the existing prepared owner. Adopt the frozen recipe
accepted by13/13a without a new audio timeline.

## Integration constraints from the existing owners

Reuse composition's retained audio contexts as the candidate stretch domains.
They already join contiguous source/project support with the same asset, stream,
rate and pitch across pure splits. Verify a matched-input split and a short query
against that complete run before wiring execution: preparing each visible clip
independently would create extra stretch endpoints. The [bounded compiler check](../assets/14-retained-context/README.md) confirms
identical full-run contexts for the corrected selection after a pure split and
short query, while an actual removal breaks support. [Native output equality and public integer-duration authoring](../assets/14b-retained-retime/README.md)
now pass for all four accepted selections. No persistent lineage or
second timeline is justified by this seam.

Bind an accepted implementation through the
existing capability/requirement path and prepared-audio owner. Preparation runs
before clip stacks, and retained project-sample reads must replace the current
unit-rate-only context assumption. Include prerequisite work in existing worker
deadlines; do not introduce another derivative queue or cache registry.

The isolated array adapter's mono48k,60-second domain and fixed transpose are
research constraints, not product limits. The file seam now preserves exact mono
output with bounded pages and cancellable file access; its [proof and limits](../assets/14-bounded-stretch/README.md)
do not establish public worker cancellation deadlines. [Coupled stereo](14c-stereo-stretch.md) and [explicit pitch-follow](14d-pitch-follow.md)
have separate scoped numerical verification. Do not downmix, independently process channels or widen admission
silently. These checks supplement, rather than replace,13a listening acceptance.

## Committed passes

The following seams are verified together by the public acceptance journey. The bounded
mono file prerequisite is banked in the Status evidence; it is not a public limit.

- [14b — Retained-run preparation](14b-retained-retime-preparation.md): native mono
  execution shared by normal and state-prerequisite graphs, plus actual integer
  edit-duration/count mapping.
- [14c — Linked stereo preserve](14c-stereo-stretch.md): coupled channel execution;
  can proceed independently of14b in the isolated stretch package.
- [14d — Explicit pitch follow](14d-pitch-follow.md): bounded rate conversion over
  the same retained run, after14b.
- [14e — Public delivery](14e-public-retiming.md): capability/admission and deadline
  binding, then linked/unlinked CLI/MCP delivery and synchronization acceptance.

These share existing owners. Native run scratch is request-scoped; durable final
output still belongs to PreparedAudioStore/JobQueue/AssetStore. Collect distinct
runs across both requested clips and state inputs before preparing either graph.
Short views retain the full run and must budget its work. Output counts come from
absolute compiler sample boundaries, not independent duration rounding.

## Work and review surface

Run clip stacks after exact retime/pitch preparation. Use the single core prepared-derivative owner shared with other processors. Retime changes invalidate affected downstream output; source evidence remains raw. Test post-retime processing and pure-split preservation together.

Slow a selected rushed passage with linked video/evidence, then slow audio alone after an explicit unlink. Separately insert/replace visuals while narration stays at its original speed. Use clip splits for piecewise rate changes; video holds/loops use the existing model. Keep time fitting an explicit agent operation.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/retiming.mjs --case linked-and-independent
```

## Acceptance

Add the scenarios assigned here in the [live journey inventory](../journeys.md)
through actual public CLI/MCP and service paths. State-only checks do not replace
delivered-media or listening/physical gates.

Production-entry parity with slice 13 on matched inputs, exact sample count, source/project mappings through repeat/split/retime, attachment timing, range/full consistency, long-run drift and cache invalidation. No DB transaction waits on stretching. Audition the accepted local-change cases.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **retimed event synchronization**, using frame-counter/event landmarks around retime boundaries; layer design and captions are judged later. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

If the production path changes compensation or loses the quality winner, repair parity before tuning. If a new rate lies outside a proven execution capability, report it explicitly rather than substitute another effect.

Delegated: Derived-cache storage and scheduling within the shared job owner. Pitch default, synchronization and timing rules remain fixed.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.
