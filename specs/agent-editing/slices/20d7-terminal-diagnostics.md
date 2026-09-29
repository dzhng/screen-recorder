# 20d7 — Preserve terminal capture diagnostics

Status: verified scoped terminal-diagnostic checkpoint; [evidence](../assets/20d7-terminal-diagnostics/README.md). Dependencies: [20d6](20d6-settled-cleanup.md).

## Contract and owner

A stopped or recovered take exposes its original bounded failure message beside
the existing interruption code through recording reads, including when no usable
video or revision survives. The recording lifecycle owns this scalar; reading
status never scans the journal. Unfinished finalization errors keep their existing
retry meaning. Recovery selects the failure code and message together, so a
missing completion message cannot borrow text from an unrelated role failure.

Journal normalization also preserves the message where timed completion evidence
exists. Historical raw journals remain immutable and retain their accepted prefix;
only disclosed text is bounded. Current receipts identify their normalization
format. Verification of historical receipts reproduces their original format while
retaining exact normalized-byte, publication-proof and receipt equality. Current
receipt comparison includes diagnostic text. Recording package snapshots preserve
the same optional message.

## Verification and next pickup

Focused core persistence/evidence tests, native source-evidence tests, service and
controller checks, snapshot preservation, receipt admission controls and relocated
public package inspection pass. Prerecorded public recovery preserves diagnostics
through CLI/MCP and restart with and without video. Independent review is resolved.
No physical capture acceptance is implied. Catalog format is now 19; do not open frozen catalog-18 fixtures with the
new binary or mutate them. Bootstrap a scratch library or retain their old worker.

The current implementation changes source policy to `native-source-v2`. Adopted
historical receipts remain immutable; absence of a normalization version identifies
the prior receipt format, which did not disclose the completion message.
