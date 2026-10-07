Focused `node --test packages/test-harness/editing/blend-reference.test.mjs` passes all 6 tests.

Prior gaps:

| Gap | Status | Evidence |
|---|---|---|
| Oversized raster prefixes | **Fixed** | `compareBlendRaster` requires exact byte lengths before comparison ([blend-reference.mjs:35-45](../../../../../../packages/test-harness/editing/blend-reference.mjs:35)); regression test covers it ([blend-reference.test.mjs:42-53](../../../../../../packages/test-harness/editing/blend-reference.test.mjs:42)). |
| Independent reference identity | **Partially fixed** | Public verification hashes each retained `reference.png` against its frozen artifact digest ([blend-public.mjs:136-141](../../../../../../packages/test-harness/editing/blend-public.mjs:136)). Native verification still generates `reference.png` from the mutable `blendPixel` implementation ([blend-sheet.mjs:117](../../../../../../packages/test-harness/editing/blend-sheet.mjs:117), [blend-sheet.mjs:155-167](../../../../../../packages/test-harness/editing/blend-sheet.mjs:155)) and never asserts that result against an independent retained digest. |
| Terminal movie extent | **Fixed** | Support verification requires one non-empty segment of exactly 200,000 µs and exactly two contiguous sample spans ending at 200,000 µs ([blend-reference.mjs:67-85](../../../../../../packages/test-harness/editing/blend-reference.mjs:67)); regression test covers a wrong terminal duration ([blend-reference.test.mjs:55-69](../../../../../../packages/test-harness/editing/blend-reference.test.mjs:55)). |
| Export identity/destination | **Fixed** | Public harness checks export ID, project, revision, output path, destination, receipt hash, and destination-file hash ([blend-public.mjs:209-235](../../../../../../packages/test-harness/editing/blend-public.mjs:209)). These fields are present in the service status contract ([exports.ts:777-824](../../../../../../apps/service/src/exports.ts:777)). |
| Native operand hashes began after still rendering | **Fixed** | Native hashes are captured before the still render ([blend-sheet.mjs:226-229](../../../../../../packages/test-harness/editing/blend-sheet.mjs:226)) and checked after movie rendering ([blend-sheet.mjs:260-264](../../../../../../packages/test-harness/editing/blend-sheet.mjs:260)). |

Remaining findings:

- **P1 — Native oracle identity remains mutable.** In [blend-sheet.mjs:117](../../../../../../packages/test-harness/editing/blend-sheet.mjs:117) `referenceSHA256` only records the current source file hash; it is not compared with a retained expected identity. The expected raster is then generated from the same `blendPixel` code used as the reference arithmetic ([blend-sheet.mjs:155-167](../../../../../../packages/test-harness/editing/blend-sheet.mjs:155)). A reference-code regression can therefore change both expected pixels and the recorded hash while the native check still passes. Narrow correction: assert each generated reference against an immutable retained digest/vector before comparing native output.

- **P2 — Default public runs do not require all seven retained cases.** [blend-public.mjs:27-28](../../../../../../packages/test-harness/editing/blend-public.mjs:27) only checks that at least one case remains after filtering. A truncated or duplicate frozen case list silently reduces coverage. Narrow correction: when `--case` is absent, assert the exact expected seven unique scenario names; retain single-case behavior when it is supplied.

Scoped verdict: **not clean** because native reference identity is still unresolved, and default public coverage can silently be incomplete.
