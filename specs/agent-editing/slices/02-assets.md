# 02 — Immutable asset admission

Status: not started. Dependencies: [00](./00-corpus.md).

## Contract

An imported, captured or generated stream can be referenced immutably without depending on an external file remaining in place.

## Seam and ownership

Core asset admission owns AssetId, StreamId, metadata, dependencies and ready state; service owns local-path admission; native `media.probe` reports actual streams, orientation, presentation timing, color and audio layout. Add asset.import/get/list through the shared registry for the isolated project service.

## Work and review surface

Stream copy/hash into managed staging, probe the owned bytes and atomically publish. Deduplicate identical media and acquire receiving-project references for past-project assets. Preserve source bytes and provenance. Cover the baseline formats and explicit unsupported-input responses in contracts.md; separate optional decode derivatives from originals.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/assets.mjs --fixture imports
```

## Acceptance

Remove/rename the external file after import and decode the admitted asset. Test concurrent duplicate imports, cancellation/crash publication, reference retention, changed source during copying and unsupported codecs. Validate orientation with an asymmetric image and VFR PTS metadata rather than frame-count guesses.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **source orientation**, using full asymmetric source frame; unrelated layer layout, captions and animation are out of scope. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

If HDR-to-SDR or a declared format cannot be decoded correctly, add a focused normalization reproduction before accepting that format; report unsupported input explicitly until it passes. Never bake a lossy normalization into the original asset.

Delegated: Copy-buffer size, hashing implementation and private metadata indexes. Storage ownership and supported/error behavior stay fixed.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.

