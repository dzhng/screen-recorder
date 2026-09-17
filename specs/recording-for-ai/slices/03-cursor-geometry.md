# 03 — Cursor positions in captured coordinates

Status: corrected implementation integrated; remaining physical placement gates open. Dependencies: 01.

Native sampling and journaled geometry are implemented. Root's integrated own-window
measurement and remaining gates are recorded in the [cursor checkpoint](../assets/cursor/review.md).
The delayed-reading and unknown-geometry corrections, independent reader review
and real sampler tests are integrated. Window measurements do not close the
deliberate-gesture, display or region gates. A [native gesture probe](../assets/real-gesture-probe/review.md)
reached the fixture UI but recorded no inside cursor observations, so physical
gesture acquisition remains unverified.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. `bun run lab:cursor-geometry` now exists
and produces placement measurements; the rest of this slice's plan is unchanged.

## Native ingestion evidence

The internal cursor-evidence export now streams generated-journal observations
through the existing native parser into a caller-owned derivative. Real-worker
checks cover ordered geometry, unchanged raw sample values, corrupt/incomplete
prefix markers, output alias refusal, source immutability, and a large sample
history. See [native derivative ownership](../../../helpers/mac/README.md#source-evidence-derivatives).
This does not add core indexing or close the physical placement gates.

## Contract and API seam

Recorded cursor samples land on the same visual target in display, window and region capture.

Add timestamped raw cursor sampling in helpers/mac, targeting 60 Hz while recording and none while paused. Use contemporaneous captured geometry/scale and source transform, not a fixed Retina multiplier. Persist output-pixel coordinates, visibility/button observations and geometry epoch. Probe cursor-free source output so clean frames remain possible.

## Runnable checkpoint

Run bun run lab:cursor-geometry on an asymmetric labeled grid. Point at corners/center, move and resize a captured window, use an off-center region, scroll, leave the capture region, and cross an available display origin. Produce a numbered overlay for measured sample points. Synthetic transforms cover negative origins even if hardware lacks a second monitor.

## Acceptance

Maximum tested position error is 3 output pixels; samples align with source clock and omit pauses. Out-of-capture samples are explicitly invisible, not clamped onto a target. Actual display configurations tested are named; unavailable hardware coverage remains unverified. Permission requirements are measured and exposed.

## Decisions delegated and scope firewall

Choose polling/event APIs based on permission and fidelity evidence; no keylogging or Accessibility dependency unless needed and demonstrated. Transform ownership stays native. Store evidence of any window-bounds lookup limitation.

## Visual review

Coordinate placement only, with grid targets cropped at corners and center. compare-screenshots against the fixture grid, then unprimed screenshot-critique last. Trail style is later.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

If moved-window alignment fails, isolate the geometry update seam; do not rely on a screenshot-specific offset or prohibit window movement silently.



Integrated cursor-export check (2026-09-16): the native build and all six real-worker
tests pass, including 120,000 streamed samples, integrity markers, source preservation
and output safety. Independent Codex review found no actionable regression and ran
those same six tests. Input-budget and oversized-header failure cleanup are exercised;
this is not a measured worst-case output-budget or all-recording-length guarantee.
