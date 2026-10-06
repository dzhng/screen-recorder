Both prior findings are fixed.

- **Regenerated reference identity — fixed.** The banked digest is enforced in the native sheet runner ([blend-sheet.mjs:176](/Users/server/dev/yap-blend-sheet/packages/test-harness/editing/blend-sheet.mjs:176)), public runner ([blend-public.mjs:140](/Users/server/dev/yap-blend-sheet/packages/test-harness/editing/blend-public.mjs:140)), and encoding runner before/after execution ([blend-encoding.mjs:88](/Users/server/dev/yap-blend-sheet/packages/test-harness/editing/blend-encoding.mjs:88), [blend-encoding.mjs:188](/Users/server/dev/yap-blend-sheet/packages/test-harness/editing/blend-encoding.mjs:188)).

- **Default public coverage truncation/duplication — fixed.** `selectBlendCases` requires the complete unique seven-case set by default and requires exactly one match for `--case` ([blend-reference.mjs:13](/Users/server/dev/yap-blend-sheet/packages/test-harness/editing/blend-reference.mjs:13)). The public runner consumes this guard ([blend-public.mjs:32](/Users/server/dev/yap-blend-sheet/packages/test-harness/editing/blend-public.mjs:32)). Regression tests cover omission, duplication, and selection ([blend-reference.test.mjs:78](/Users/server/dev/yap-blend-sheet/packages/test-harness/editing/blend-reference.test.mjs:78)).

The encoded-reference audit is sound:

- One frozen, digest-checked PNG is bound as the only image asset, with no processing steps ([blend-encoding.mjs:94](/Users/server/dev/yap-blend-sheet/packages/test-harness/editing/blend-encoding.mjs:94), [blend-encoding.mjs:123](/Users/server/dev/yap-blend-sheet/packages/test-harness/editing/blend-encoding.mjs:123)).
- The pre-encode still is checked over all 128×64 pixels at limit 2 ([blend-encoding.mjs:133](/Users/server/dev/yap-blend-sheet/packages/test-harness/editing/blend-encoding.mjs:133)).
- Video uses the frozen movie’s resolved settings ([blend-encoding.mjs:142](/Users/server/dev/yap-blend-sheet/packages/test-harness/editing/blend-encoding.mjs:142)); decoded control and original samples are both checked at 0 and 100 ms, with exact requested timestamps and full-raster limit 8 ([blend-encoding.mjs:64](/Users/server/dev/yap-blend-sheet/packages/test-harness/editing/blend-encoding.mjs:64), [blend-encoding.mjs:167](/Users/server/dev/yap-blend-sheet/packages/test-harness/editing/blend-encoding.mjs:167)).
- Control support uses the exact rational-clock verifier ([blend-encoding.mjs:163](/Users/server/dev/yap-blend-sheet/packages/test-harness/editing/blend-encoding.mjs:163)); source reference and original movie hashes are rechecked after processing ([blend-encoding.mjs:188](/Users/server/dev/yap-blend-sheet/packages/test-harness/editing/blend-encoding.mjs:188)).
- The evidence explicitly retains the raw-edge red result and makes no lossless claim (`encoding/README.md`), while the encoded report records full-raster bounds and unchanged H.264 settings.

The permitted test passed: **8/8** in `blend-reference.test.mjs`.

No concrete P1/P2 defect found. Remaining limits are scope limits: the native encoding proof was read from the settled evidence rather than rerun here; it covers the retained static SDR sheets and declared H.264 path, not product-wide behavior, arbitrary motion/HDR/codecs, or lossless export.

**Scoped verdict: CLEAN.**