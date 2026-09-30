# Retiming resource audit

Resolved P1: prepared output descriptors grew with the number of retained runs.
A legal plan can contain 10,000 clips and 20,000 contexts. Sequential repeated
selections have distinct project positions; retaining a file handle for each run
exhausted the Mac launchd soft descriptor limit of 256. The interactive shell's
larger limit hid this in earlier proofs.

The [historical failure archive](descriptor-red.zip) retains the complete 300-run,
one-source, 93.75-second plan, POSIX 24 failure and binary identity. No output was
published. CompositionAudio.PreparedRetime now closes its writer after preparation,
stores the immutable scratch URL, and opens a reader only for the current bounded
read. Sources.retimed remains the request owner; no new product clip cap or cache
was introduced.

The [root native report](native-report.json) reruns the same 300-run case under a
256-descriptor child limit: all 4,500,000 output frames exactly match the repeated
reference. Cancellation and selected-input failure still leave no published output
or scratch. [Root verification](root-verification.json) records the binary identity.
Long duration and many runs remain separate resource axes; both now have scoped
proofs, without claiming a universal worker deadline.
