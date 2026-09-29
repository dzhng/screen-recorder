# 23 — Cut over all consumers and remove old owners

Status: not started. Dependencies: [12b](./12b-speech-processing.md), [14](./14-retiming.md), [15](./15-layer-geometry.md), [16](./16-keyframes.md), [17](./17-text-captions.md), [19](./19-voice-assets.md), [21](./21-webcam.md), [22](./22-portable-projects.md), [15a](./15a-noise-processing.md).

## Contract

The installed product has one composition/time interpretation, preserving verified recording behavior and eliminating the temporary old/new editing boundary.

## Seam and ownership

Follow architecture.md's cutover: one fresh library/catalog, capture-to-assets/project finalization, shared project inspection/render/export, same CLI/MCP registry. Remove the old span revision interpreter, fixed-role movie/package requests and obsolete editing target schemas after parity.

## Work and review surface

Include processing discovery, get/set, routing and all processed inspection/export consumers in the same cutover. Remove old hidden gain/transition assumptions from the new path; do not preserve a second DSP or effect interpreter.

Before deletion, run the preservation matrix through old and new public entry points with matched inputs. Keep source capture/recovery/evidence primitives; refactor mixed modules rather than leave compatibility wrappers. Update app lifecycle, source discovery, job targets, export recovery, product skill and developer docs together. Leave the old library untouched for explicit media import.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/cutover.mjs --case preservation-matrix
```

## Acceptance

All preservation rows have result artifacts and permitted differences. Capture, clean-frame/pointer selection, transcript/evidence gaps, concurrency, preview/export publication and relocated inspection retain their guarantees. Search for obsolete timeline/target consumers and remove live references. New installed discovery uses the fresh library deliberately; no old jobs/history are migrated.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **preserved source presentation**, using existing source/pointer landmark masks at matched times; deliberately new multi-layer editing style is out of scope. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

Job retirement already releases ordinary and input references inside the queue's
single-job transaction, after all attempts close. Whole-owner deletion uses
fenced, restartable reference pages and removes job markers only after their
references are gone. Domain owners still fence retries and release independently
owned revision/export resources. Preserve this existing contract through cutover;
reads, cancellation and cache eviction do not authorize forgetting retry identity.
The [reference-lifetime audit](../assets/acceptance-maintenance/job-references.md)
maps current callers and distinguishes retained identities from orphan leaks.
No new asset-GC or expiration policy is implied by this verification requirement.

## Failure boundary and discretion

If a consumer still needs the old timeline owner, finish its port before declaring cutover. A behavior failure is repaired at its owner, not bypassed with an adapter. Missing prior physical acceptance remains pending, never upgraded to pass.

Delegated: Internal refactoring sequence within the slice and implementation names. No compatibility layer, implicit deletion or second production engine.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.

