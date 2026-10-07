# Independent layer arithmetic evidence

The [native runner](../../../../../packages/test-harness/editing/blend-sheet.mjs)
submits explicit surfaces through the public composition compiler and native
frame/video operations. The [public runner](../../../../../packages/test-harness/editing/blend-public.mjs)
uses the same frozen operands through real CLI authoring, MCP processor readback,
delivered frame/preview and committed export. Their help owns invocation. The
[reference](../../../../../packages/test-harness/editing/blend-reference.mjs) implements
[W3C separable blending/source-over](https://www.w3.org/TR/compositing-1/#blending)
in premultiplied linear-sRGB without importing the product renderer. Existing
PNG, movie display and exact-sample-support observers remain the readers.

[Original native requests/results](report.json) freeze OS/worker identity,
documents, receipts and artifact hashes. [Public requests/results](public/report.json)
freeze all seven CLI/MCP cases. [Parity](public/parity.json) proves their stills
and decoded samples match retained native outputs byte for byte. Exports publish
exact verified preview bytes and original operands remain unchanged. No user
media was changed.

Review hardening adds exact raster dimensions/lengths, independent-reference
identity, rational terminal movie support, export destination/identity and native
operand hashes before still rendering and after movie delivery. The
[hardened native run](hardened-native-report.json) exercises all seven cases;
the [hardened public multiply run](public/hardened-multiply-report.json) exercises
the corrected public assertions. Other public evidence predates hardening;
[fresh timing observations](public/retained-support.json) verify all fourteen
retained movies without claiming that newer code produced the old public results.

Full-raster PNG error is at most one RGBA level. Both movie samples differ by at
most four levels under the frozen comparison: patch interiors exclude two pixels
beside hard boundaries; the smooth vignette is unmasked. Independent exact clocks
show two 100ms sample spans covering precisely [0,200ms). These masks and limits
were fixed before results. The [abrupt patch-vignette failure](historical-patch-vignette-failure.log)
remains retained. Disabling the requested blend fails [public delivered-pixel verification](public/effect-disabled-red.log);
disabling timing verification fails the [terminal-support regression](public/support-red.log).

[Native-scale pairs](comparison/), the [4× sheet](comparison-sheet-4x.png) and
[visual adjudication](visual-review.md) retain actual appearance. Still arithmetic
and public admission pass. The raw movie hard-edge mismatch is confirmed. The
[full-raster encoded-reference checkpoint](encoding/README.md) separates that shared
codec loss from blend response under unchanged settings and tolerance. Fresh
image-only review accepts both encoded samples against their matched references.
[Scoped review](review.md) records reference-identity and case-coverage hardening.
Independent rereview is clean. The slice closes for declared-codec reproducibility;
it makes no lossless-RGB or whole-product claim.
