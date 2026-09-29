# Frozen voice process repeatability

The unchanged slice 18 candidate reproduced its frozen output in two fresh offline
processes. [Preflight](preflight.json) authenticates the request, Python generator,
source recording, complete model file set, dependency versions, Python/platform,
clean runtime Git commit and installed runtime Python bytes. The Node launcher also
matches its original committed bytes. No setup, recipe, seed or output pin changed.

The [comparison](comparison.json) checks complete raw PCM, format and WAV equality
against frozen files and between processes. The [archive manifest](archive.json)
records every retained generated output and process manifest in
[the lossless archive](outputs.tar.xz); its contents were re-read and hashed after
compression. The two process logs preserve execution results. Both processes use
OS network denial and the unchanged runner's offline environment.

## Research contract and verdict

The sole variable is a new Python process. Identity drift would stop generation;
a byte mismatch would block the entry port and be retained without tuning. The
budget was two runner executions, each with six fixed origin/text requests. All
twelve completed and matched. No further trial or quality sweep was run.

This observation supports matched-request entry parity, not universal determinism.
OS/Metal caches were not purged. Peak MLX allocation and process RSS are separate,
overlapping counters, not additive memory totals. All three origin references
are identical copies: managed admission/deletion retention remains unverified.
There was no playback, new listening verdict, quality acceptance or public endpoint.
The inherited effective repetition penalty remains the pinned runtime's behavior;
it was not altered to the request's nominal value.

## Reproduction and next boundary

Run the existing `packages/test-harness/editing/voice-reproduction.mjs` with
`--case reference-origins --out <fresh directory>` once per fresh process, using
the explicitly prepared, matching runtime/model described by the slice 18 owner.
The runner owns extraction, conditioning, seed and network restrictions. Inspect
its manifests before comparing retained outputs; do not silently prepare or fetch
missing dependencies. The archive preserves both complete runs independently.

A future managed worker port must repeat this exact gate behind its intended
process seam. Reference ownership, durable jobs/assets and listening remain
separate gates; this checkpoint introduces no production implementation.
