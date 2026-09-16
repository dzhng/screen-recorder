# 10 — Readable cursor trails on requested frames

Status: bounded [native clean visual observations](../assets/visual-observations/native-review.md)
are implemented; scene decisions remain in core. The [native rendering subpass](10a-native-cursor-render.md) draws supplied
points on decoded frames; core scene analysis, trail selection and cutoff reporting
are not started. Dependencies: 09.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

The [native ingestion seam](03-cursor-geometry.md#native-ingestion-evidence) supplies
persistent source evidence and bounded cursor-range queries. Core scene decisions
and trail selection remain unimplemented.

## Contract and API seam

A single image preserves recent pointing while making clean/current-pointer alternatives explicit.

First implement the shared clean-video scene-boundary analyzer in core and persist its source boundaries and policy provenance. Slice 11 consumes this same analyzer output rather than implementing a second detector. Have core select raw points within the requested trail window clipped by pause/cut/scene/geometry events; native draws supplied points with age fading and current pointer. Provide clean, pointer-only, default 2-second and custom capped trail modes. Return actual interval/cutoff metadata; preserve raw history for cursor-range requests.

## Runnable checkpoint

Run bun run lab:trails with a static circle, wave over a button, scroll immediately after circling, cut join, pause and window resize. Render each from identical source frame across trail modes. Use known path samples and real captured gestures.

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

