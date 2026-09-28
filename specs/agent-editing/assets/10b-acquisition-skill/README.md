# Capture adoption product-skill checks

The first fresh `gpt-6-luna` agent used only the product skill and advertised CLI.
It correctly planned the first three seconds with narration starting 48,675 µs
after picture, but failed to complete editing/export after transcribing an opaque
acquisition ID incorrectly. Its [hand-authored report](first-agent-report.json)
retains the correct ID in chosen capture context and a different ID in subsequent
requests; it also incorrectly rewrites earlier successful IDs in its operation
summary. That report is agent testimony, not verbatim command evidence.

The [authoritative raw replay](authoritative-replay.json) and
[raw get](authoritative-get.json) show the original ready acquisition remains
available. No service-state loss was reproduced. The product skill now requires
saving raw JSON receipts, programmatically reusing identifiers, and comparing exact
IDs before diagnosing NOT_FOUND as lost state. A fresh independent application of
the revised skill is the acceptance check; correcting the original agent alone
would not establish blind skill usability.


The second fresh agent completed the revised workflow before its turn was
interrupted by a usage limit. Its saved [raw export status](fresh/export-status-1.json)
proves committed output; root independently checked the external file and preview
against the receipt SHA-256 and byte length. The saved [parameters and observations](fresh/commands-and-findings.txt)
show explicit capture bindings and synchronized narration placement at 48,675 µs.
This proves the blind CLI workflow through export, not listening or direct visual
inspection. The service was no longer running when root resumed; no service child
needed termination. Evidence was retained before removing owned scratch state.
