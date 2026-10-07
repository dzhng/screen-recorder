# Motion blur delivery receipt

This receipt comes from the public CLI journey
[`motion-blur-delivery.mjs`](../../../../../packages/test-harness/editing/motion-blur-delivery.mjs).
It imports the retained alpha fixture, applies one authored scale trajectory and
the public processor `{ "type": "motion-blur", "samples": 4, "shutter": 0.5 }`,
then delivers matched base and processed PNG frames through the native worker.

The run passed on 2026-10-06. The retained source identity is
`d0b26f1c3d9cb975566b9a454338c9132255543350874039230636e3213c9c1c`, and the
native worker identity is
`d2304c6ceeb40f02ac2289e1c781a901a8d921f182847f61dcb51e9b49d14afe`.

At project time `500001µs` on a 64×48 canvas, 757 of 3072 pixels changed,
mean RGB delta was `23.6699`, maximum channel-sum delta was `443`, and the
delivered output had zero transparent pixels. The cost receipt in
[`report.json`](report.json) measured 1,072.6 ms for the base frame and
1,136.3 ms for the blurred frame in this local run, a 63.8 ms total delta.
Both deliveries decoded one source sample; the declared blur work remains
bounded at four temporal samples.

[`visual-parity-diff.json`](visual-parity-diff.json) and the retained
[`comparison/`](comparison/) artifacts compare the processed frame with the
same-time unblurred frame. This is a diagnostic pair, not a similarity gate:
the candidate's `parityDistance` is `0.14169`, `pixelmatchRatio` is `0.08464`,
and `edgeDiffRatio32` is `0.1888`. The changed pixels and higher color entropy
are the expected signature of a moving blur; the comparator does not decide
whether the recipe is aesthetically correct.

The required fresh unprimed critique found no transparency or decode failure.
It did flag a broad upper-left smear, an inflated footprint, and loss of a crisp
anchor around the moving red/blue control. Those are retained as the remaining
appearance question for slice 29: this receipt proves public/native delivery,
bounded work, and opacity, but does not silently bless the final blur look.

The immutable [appearance replay](../../../../../packages/test-harness/editing/motion-blur-appearance-replay.mjs)
now checks the source/native identities, exact four-sample recipe, PNG
dimensions, changed-pixel measurements and one-pixel envelope against the
authored trajectory control. It replays evidence only; strict reference
conditioned appearance parity remains open.
