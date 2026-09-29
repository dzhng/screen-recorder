# 24d — One committed document in public edit receipts

Status: public 10,000-clip receipt delivery and replay verified.
Dependencies: [24c](24c-edit-batch-work.md).
[Evidence](../assets/24d-edit-receipts/README.md).

`revision.document` is the single public document owner. Edit receipts retain
normalized operations, identities, labels and lineage. The same response projection
handles fresh results and persisted requests without re-executing the mutation.
Historical database bytes remain evidence; current response shape intentionally
omits their redundant document. New-shape replies replay exactly across restart.

MCP retains its standard text and structured forms. Removing the internal duplicate
makes the declared timeline fit the existing public limits without raising SDK or
service bounds. This does not promise unbounded project documents or responses.

The [job-status prerequisite](24e-job-status.md) addresses the next observed large-response refusal.
Next: successful two-hour learned preparation, full independent PCM validation,
resource observations and cleanup through the existing scale harness. Parent scale,
retiming and listening gates remain open.
