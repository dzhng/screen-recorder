# Transition / trajectory / blur checkpoint

This checkpoint covers the explicit composition and native seams for slices 27–29.

- Crossfade, dip and flash lower to the existing gain/opacity curves.
- Zoom transitions lower to the existing animated geometry processor and require scales at least 1 for canvas coverage.
- Directional whip transitions lower to overscanned geometry with signed x/y travel. The implementation refuses travel beyond the caller's overscan coverage budget rather than exposing an uncovered edge; a fixed caller-supplied geometry rectangle supplies the relevant axis dimension, while animated rectangle dimensions are refused because coverage cannot be proven before rendering.
- Motion blur is a bounded visual processor with 1–8 samples and a shutter fraction from 0 to 1. `samples: 1` or `shutter: 0` is an identity bypass. Native preflight charges requested sample work to the existing intermediate-pixel budget and the executor uses the shared Core Image picture path.

Focused proof:

- `bunx vitest run packages/composition/src/convenience.test.ts packages/composition/src/visual-plan.test.ts packages/composition/src/geometry-temporal.test.ts`
- `bun run --cwd packages/composition check-types`

Both pass on the implementation worktree. The [native transition receipt](crossfade/README.md)
also drives public solid-color crossfade, dip and flash picture edits through frame
and preview delivery. Native package compilation, audio delivery and delivered moving-shot
trajectory/blur receipts remain separate residual gates; no complete visual verdict
is claimed here.

The [current native delivery replay](motion-delivery-replay.json) exercises the public
`frame.get`, preview and export paths against the rebuilt worker. The moved/split zoom
case produced 39 pictures, zero whole-curve refusals, exact preview/export bytes, and
bounded encoded-frame membership/range checks. The retained receipt is replayed by
[`motion-delivery-replay.mjs`](../../../../../packages/test-harness/editing/motion-delivery-replay.mjs),
which also checks the retained `full.mp4` and `range.mp4` bytes and rejects changed counts,
identities, hashes or output artifacts. This is structural delivery evidence;
strict frozen color-hash parity remains open. The motion-blur appearance repair is
recorded in [`motion-blur/appearance-repair-report.json`](motion-blur/appearance-repair-report.json):
the candidate is compared with an unblurred authored-trajectory control, keeps the
visible footprint within one pixel on each edge, preserves opacity, and still changes
the moving control. The retained unprimed critique found no displacement, clipping or
transparency defect; the remaining one-pixel edge softness is the declared bounded blur
envelope rather than a scale or trajectory change.

The deterministic solid-color crossfade, dip and flash reference gate now has an
inference-free replay checker and retained result. It proves the nine frozen
reference/candidate frame pairs and zero mismatch metrics, with the midpoint's
known encoding tolerance. This closes only that fixed control; moving alpha/mirror,
trajectory/blur and zoom color parity remain open.
