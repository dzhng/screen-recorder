# Transition / trajectory / blur checkpoint

This checkpoint covers the explicit composition and native seams for slices 27–29.

- Crossfade, dip and flash lower to the existing gain/opacity curves.
- Zoom transitions lower to the existing animated geometry processor and require scales at least 1 for canvas coverage.
- Directional whip transitions lower to overscanned geometry with signed x/y travel. The implementation refuses travel beyond the caller's overscan coverage budget rather than exposing an uncovered edge.
- Motion blur is a bounded visual processor with 1–8 samples and a shutter fraction from 0 to 1. `samples: 1` or `shutter: 0` is an identity bypass. Native preflight charges requested sample work to the existing intermediate-pixel budget and the executor uses the shared Core Image picture path.

Focused proof:

- `bunx vitest run packages/composition/src/convenience.test.ts packages/composition/src/visual-plan.test.ts packages/composition/src/geometry-temporal.test.ts`
- `bun run --cwd packages/composition check-types`

Both pass on the implementation worktree. The [native crossfade receipt](crossfade/README.md)
also drives a public solid-color picture edit through frame and preview delivery.
Native package compilation, dip/flash/audio delivery and delivered moving-shot
trajectory/blur receipts remain separate residual gates; no complete visual verdict
is claimed here.

The [current native delivery replay](motion-delivery-replay.json) exercises the public
`frame.get`, preview and export paths against the rebuilt worker. The moved/split zoom
case produced 39 pictures, zero whole-curve refusals, exact preview/export bytes, and
bounded encoded-frame membership/range checks. This is structural delivery evidence;
strict frozen color-hash parity and matched motion-blur/perimeter critique remain open.
