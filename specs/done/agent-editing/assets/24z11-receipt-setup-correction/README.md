# Receipt fixture setup correction

The retained receipt case now prepares its scratch replay row, starts the same
production service and connects the same default SDK in a scoped runner setup
hook. The hook keeps the runner's existing 10-second default. The unchanged
5-second test body begins with `edit.apply` and retains every artifact chunk,
response hash, complete receipt byte comparison, persistence check, ordinary CLI
comparison and close. No product code, operation deadline or buffer changed.

The first merged gate remains red: 125 of 126 passed, with this case timing out at
5 seconds. One temporary phase probe reproduced that failure. Setup and SDK
initialization consumed 2,945 ms before dispatch; the descriptor arrived another
1,649 ms later. Complete reads and CLI verification had not reached their phase
markers when the test timed out. The probe does not establish a production defect
or general latency cause. Runner transformation time is outside the test body.

[Verification](verification.json) and [manifest](manifest.json) preserve the root
red log, exact diagnostic producer/instrumented source/output, timestamps, source
restoration identity and corrected affected gate. The original source was restored
byte-for-byte before the correction. All 65 lines from dispatch through the final
telemetry match the original test body after whitespace normalization.

The corrected affected gate remains red: 115 of 126 passed. All three receipt
delivery cases passed; ten unchanged CLI cases and one unchanged delivery case
timed out. Those broader failures are retained as an open integration gate. No
retry, timeout increase or production change followed them.

The [original implementation packet](../24z11-operation-result-delivery/README.md)
and its historical receipt authority remain unchanged. This packet records only
the setup boundary correction; its green receipt-file gate does not relabel either original
failure. The later [merged 126/126 result](../24z11-operation-result-delivery/merged-corrected.json)
is separate current evidence, with unchanged deadlines. [Choices](choices.md) and
[review](review.json) explain the decision and focused review.
