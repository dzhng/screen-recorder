# 24t — Retired source-job reference history

Status: scoped lifetime gate verified; [evidence](../assets/24t-job-reference-retirement/README.md). Dependencies: existing [23 reference-lifetime
contract](23-cutover.md) and [24 scale contract](24-scale.md).

## Contract and seam

Create 513 distinct selected-source audio jobs through the real CLI/MCP service
using the retained small corpus WAV. Prove their asset references survive ordinary
reads, cancellation, interruption and restart while identities remain retryable.
Then explicitly forget only the selected drained history through the existing
JobQueue owner, after the service closes, and restart public consumers. Preserve
sibling ready, canceled and interrupted jobs, their references and exact output.

There is no public asset-delete/job-forget operation. This gate must label internal
retirement explicitly, not introduce a test endpoint, manual database deletion,
GC policy or reference-expiry service. Source jobs exercise ordinary asset
references; existing queue tests separately cover populated job-input pages.

## Verification

- [x] Actual native import and selected audio publication; 513 unique public jobs.
- [x] Exact surviving reference sets and no orphan job/job-input owners after
  explicit retirement, across a partial retirement/reopen and final restart.
- [x] Public canceled/interrupted identities keep references, explicit retry uses
  the same identity, and surviving ready audio has identical delivered bytes.
- [x] Source content remains unchanged; no physical asset-GC claim.
- [x] Record setup/retirement/query durations and row counts. Preserve existing
  public poll/shutdown and focused-test deadlines; invent no new latency budget.

No model, DSP preparation, two-hour render/package repeat or installed cutover is
needed. Profile a failure before optimizing; the expected result requires no
production change. Root owns the parent handoff and choices ledger.

Review: shape/diff/docs and independent Codex review found no actionable defect.
The reviewer checked syntax and retained artifact hashes without repeating the
native journey. Formatter, lint and the nine focused queue tests passed.
