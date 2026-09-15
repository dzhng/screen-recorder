# 03 — Cursor positions in captured coordinates

Status: candidate integrated; root review and verification pending. Dependencies: 01.

Native sampling, the geometry transform, epochs and the journal records exist, and
`bun run lab:cursor-geometry` measures them against real captured pixels of the recorder's own
fixture window. The implementing agent measured on macOS 26.6.2 with a built-in display at the global origin and an
external display at a negative global origin: maximum landmark placement error 0.77 output pixels
in decoded video and 1.09 in uncompressed one-shot captures, across the window placed, moved,
resized into a letterbox, sent to the second display and parked under the pointer; maximum pointer
placement error 1.49 output pixels where the pointer was still. Samples hold the 60 Hz target
(1358 samples against 1357 expected, median gap 16666us) with no skipped, refused or post-seal
readings, and a 1.4s pause removes its wall-clock time without leaving a gap or a sample. Points
outside the capture keep unclamped coordinates, and every prediction of "outside" matched the
system drawing no pointer at all. Recorded frames at the instants a pointer was demonstrably drawn
in the paired capture differ from the clean image by no pixels, so the source stays cursor-free.

Still open: display and region placement are covered only by generated tests, because a probe may
record only this process's own window; deliberate pointing at grid corners, circling and leaving an
off-center region need a driven pointer; only one external display arrangement was tested, with no
display reconfiguration during a take. Evidence and artifacts are in
`/tmp/screenrec-cursor-evidence` (`summary.md`, `run-13/`) pending integration by the owning root
agent.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. `bun run lab:cursor-geometry` now exists
and produces the measurements above; the rest of this slice's plan is unchanged.

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

