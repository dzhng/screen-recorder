# Source output locators

A source-processing request owns a specific output locator. Native containment
checks resolve directories, but Foundation can spell `/private/tmp` as `/tmp` in a
canonical URL. Returning that rewritten spelling made core reject a successful
export, leaving source processing failed for a valid canonical temporary home.

The [native exporter](../../../../helpers/mac/Sources/ScreenRecorderCapture/SourceEvidenceExport.swift)
keeps its canonical containment and exclusive publication. Before issuing a receipt,
it verifies that the requested locator names the regular inode it created, then
returns the exact requested string. Core's exact receipt/request comparison remains
unchanged: another valid file's receipt is not accepted simply because its shape,
source identity or contents look plausible.

This check describes the output at receipt issuance. It does not add post-return
inode tracking or permit mutation of a published generation; the existing immutable
generation and ingestion contract remains in effect.

## Verification

The old native binary reproduced both boundaries: the
[worker receipt](output-locator-worker-red.txt) rewrote `/private/tmp` to `/tmp`, and
the [actual service](output-locator-service-red.txt) reported failed source processing
with `Invalid evidence receipt` for the canonical home.

A fresh release build passed all 12 native source-evidence tests, including both
source/output spellings, unchanged source bytes, exclusive output rules and bounded
streaming. The [worker result](output-locator-worker.txt) records this gate. The
[public service result](output-locator-service.txt) exercises generated video/journal
fixtures under both `/tmp` and `/private/tmp` homes, waits for real native processing,
and reads the expected cursor samples through the public operation registry. No
screen or microphone capture is used by this added test.

Thirty-six related core receipt, portable-evidence and processing tests passed.
The added regression exchanges valid receipts for different existing outputs,
verifies neither publishes evidence, then verifies the correct receipt succeeds.
Both files contain identical valid observations, so relaxing the exact path check
would incorrectly accept the exchange: removing that check made the test fail for
that reason. See [negative control](output-locator-exchange-negative.txt).
Core types and touched-file lint/format passed. Independent review found no actionable
regressions and passed the 20 core evidence tests; native execution in that review
was blocked by its toolchain/sandbox environment. The host native and service gates
above provide the runtime evidence.
