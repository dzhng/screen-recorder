# Independent append batching evidence

The retained CPU profile localizes the public setup timeout to repeated full-model
resolution/freezing and receipt diffing inside `applyBatch`, rather than database
commit. Profiling overlapped other verification and adds overhead; its timings are
localization evidence, not a quiet performance budget measurement.

The timed-out 500-operation request committed the 5,000-clip revision. Public replay
returned the stored receipt in 170 ms without changing the head. The corrected
editor reproduces that complete original scalar receipt byte-for-byte (SHA-256
`a4371be2e5bc2460ed5f00825543bea94bb13312479f4971b9676ca8b713a447`),
with a 76 ms pure-editor observation. A subsequent actual public 500-placement call
completed in 296 ms. These are scoped observations, not universal latency bounds.

The frozen scalar differential covers 44 complete outcomes: 33 successes and 11
exact refusals, including construction-versus-validation error precedence,
dependent anchors, later mutations, media kinds and processing fallback. Permanent
regressions preserve operation receipts and earliest errors. All 232 composition
tests/type checking and 22 core project/audio tests pass (one existing skip).
Independent design and settled diff reviews reported no unresolved finding.

The next public request committed 6,000 clips but its MCP response exceeded the
SDK's existing 10 MiB framing limit: 5,235,165 bytes of core result became a
10,981,691-byte envelope. The same document is currently repeated inside the core
receipt, then the result appears as both MCP text and structured content. Exact CLI
replay succeeds with unchanged head. This separate red remains open; no frame limit
was increased and no two-hour audio preparation was attempted in this pass.

`manifest.json` authenticates every member of `evidence.tar.xz`, including original
failure/profile, request and scalar receipt, differential cases, public replay,
reviews and verification logs. The still-live failed home is intentionally retained
outside the archive for continuation; no audio or private narration is in this pack.

Reproduce focused checks from the repository root with `bun run --cwd
packages/composition test`, `bun run --cwd packages/composition check-types`, and
`bun run --cwd packages/core test src/projects.test.ts src/project-audio.test.ts`.
Build composition before core/public consumers. Frozen comparison scripts retain
absolute scratch paths as provenance, not portable product entrypoints.

[Combined-root verification](root-verification.json) retains integrated checks in `root-verification.tar.gz`; the broader gates above remain open.
