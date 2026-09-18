# 10 — Readable cursor trails on requested frames

Status: [native rendering](10a-native-cursor-render.md),
[clean visual observations](10b-visual-observations.md),
[requested-time trail planning](10c-trail-timing.md),
[indexed trail evidence](10d-trail-evidence.md),
[durable scenes](10f-durable-scenes.md) and
[default public trail frames](10e-public-trails.md) pass generated-media gates.
Real captured gestures and geometry, real UI scene thresholds and broader vertical
cases remain open. Dependencies: 09.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

The [native ingestion seam](03-cursor-geometry.md#native-ingestion-evidence) supplies
persistent source evidence and bounded cursor-range queries. Shared core scene comparison, public boundary production and trail
selection are all integrated: boundaries are persisted and published as the `scenes` artifact,
and `planFrameTrail` selects the points a frame draws.

## Contract and API seam

A single image preserves recent pointing while making clean/current-pointer alternatives explicit.

First implement the shared clean-video scene-boundary analyzer in core and persist its source boundaries and policy provenance. Slice 11 consumes this same analyzer output rather than implementing a second detector. Have core select raw points within the requested trail window clipped by pause/cut/scene/geometry events; native draws supplied points with age fading and current pointer. Provide clean, pointer-only, default 2-second and custom capped trail modes. Return actual interval/cutoff metadata; preserve raw history for cursor-range requests.

## Runnable checkpoint

`apps/macos/tests/trail-inspection.test.mjs` is this checkpoint: it renders the named situations
— a held-frame gesture, a cut join, a historical revision, a window moved and a window resized,
duplicate timestamps, missing geometry — from one source frame through the real app, service and
native worker, and pins CLI and MCP to identical bytes. The
[delivered images](../assets/public-trails/review.md) show the trail modes side by side. There is
no separate `lab:trails`: a second entrypoint rendering the same situations from the same code
would be a copy of this check that nothing runs. What it cannot supply is real captured gestures,
which is this slice's own acceptance gate and needs a person at the Mac.

## Acceptance

Circle/wave is visible without obscuring target text; stale paths do not land on new content. Clean means no pointer/trail; zero trail means pointer only. Pixel geometry matches slice 03. Custom raw history remains retrievable despite default resets.

## Decisions delegated and scope firewall

Color, stroke width, opacity curve and pointer styling are delegated based on the visual fixture verdict. Only the two-second duration and boundary semantics are fixed. No AI gesture detector or drawing tool.

## Visual review

Trail readability is the sole variable. Compare four modes at the button/grid crop, inspect entire frame for clutter, then screenshot-critique last. Open shots for the user's non-blocking review.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

If a two-second trail fails a concrete gesture, tune styling, sampling and cutoff behavior or use the agreed per-request duration override. The settled two-second default is not delegated away; changing it requires an explicit product decision.

