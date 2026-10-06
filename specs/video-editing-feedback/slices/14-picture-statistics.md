# 14 — Expose objective picture observations

Status: implemented and independently reviewed; focused fixes landed. Depends on: [13](13-decode-replication.md), [03](03-published-work-contract.md).

## Contract

Agents receive measurable exposure/edge/region evidence from the same decoded pictures they inspect.

## Seam and ownership

Native picture observation function plus Core retained frame/index evidence, shared frame delivery. No hidden second decode/statistics service.

Current owners and starting checks:

- [helpers/mac/Sources/YapFrames/FrameImage.swift](../../../helpers/mac/Sources/YapFrames/FrameImage.swift)
- [packages/core/src/frame-inspection.ts](../../../packages/core/src/frame-inspection.ts)
- [packages/core/src/index-frame.ts](../../../packages/core/src/index-frame.ts)
- [apps/service/src/frame-batch.test.ts](../../../apps/service/src/frame-batch.test.ts)

These are current discovery pointers, not a claim every listed module must change. Extend existing behavior tests; the [global contract](../README.md) owns hard cutover and source preservation.

## Scope and frozen decisions

Return declared luma/channel histograms, bright/dark fractions, region stats and edge-band candidates, with source/revision/time/color recipe/mask/coverage. Faces, background and graphics can be measured separately. Distinguish measured dark edge from proof of cropping; use source-to-output geometry for content loss. Metrics inform agent choices, never automatically grade.

## Runnable checkpoint

Real too-dark/too-bright/yellow-wall examples and independent clipping/edge controls, shown as frames plus JSON scopes.

Expose a case-selected command or existing lab entry with its own usage. Store accepted requests/results and artifact identities in feature-owned evidence. The implementing agent checks actual output; the user may view it for direction without becoming a QA gate.

## Verification and verdict

Invoke [write-tests](../../../.agents/skills/write-tests/SKILL.md) before changing behavior. Use the narrowest real consumer check and capture red/green evidence where behavior changes.

White cards, legitimate dark scenes, source borders, alpha, exposure controls and missing regions must not produce universal pass/fail from one histogram. Freeze threshold interpretation with control outputs; report sampling coverage and transitions explicitly.

Variable: measurement validity/exposure. Mask: full raster plus explicit wall/face/graphic regions; framing and look selection are out of scope.

Run [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) on matched before/reference/candidate shots with the stated masks and numeric interpretation. Inspect motion temporally when a still cannot establish the claim. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual acceptance check**. Show useful output with [preview-shots](../../../.agents/skills/preview-shots/SKILL.md); never request human QA or wait for approval. Record critique, coverage and any residual uncertainty.

A spike passes with a frozen accepted recipe/reference, or records a failed verdict and reslices dependent work. An unavailable stub or undocumented fallback is not implementation completion.

## Delegated choices

Region API packaging and calibrated control thresholds, with basis recorded. No universal face-luma target.

Unlisted public policy/semantic choices are a spec gap. Update the map and slice before broadening the patch. Provider/recipe choices explicitly assigned to a replication checkpoint must be frozen before production integration.

## Must stay green

Native interpretation, actual frame sample identity and bounded retained delivery remain correct.

Run review/refactor-clean/code-review/write-docs appropriate to the change; retain a scoped review verdict. Update the README's Next Agent Prompt, traceability evidence and this slice's status before ending a pass. Full-suite work waits until feature completion unless the next slice cannot be trusted without it.

## Direction that would change this slice

A changed user brief, reference or product policy can redirect it. Human listening, watching or transcript labeling is never an acceptance prerequisite. Record material deviations and their evidence instead of silently changing requirements.


## Implemented evidence

[Delivered-raster observations](../assets/14-picture-statistics/README.md) retain
the accepted public requests, complete measurements, control operands and PNG
identities. Default interpretation has one pure protocol owner reused by core;
native Codable requires complete normalized inputs. The shared frame owner
measures its encoded CGImage; no second decode/statistics runtime or store exists.
Frame and index recipes retain the requested masks and thresholds separately from
their measured receipt, beside existing source/sample or revision/tap identity.

Independent delivered-PNG decode exactly reproduces opaque RGB/luma histograms,
alpha coverage and complete premultiplied RGBA hashes. Authored orientation,
endpoint, alpha, clipped/missing region, fully dark scene and border transitions
remain distinct. Public camera/explicit exposure and one-row retained index
checks are sampled evidence, without a grading verdict or edit authorization.
Scoped closeout and residual limits live with that evidence.
