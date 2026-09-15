# 05 — Pure non-destructive timeline engine

Status: not started. Dependencies: 00.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

## Contract and API seam

Trim, batch cuts, transcript/events and media plans share one source-to-edited mapping.

Implement the core timeline module and protocol types from contracts.md. Immutable source spans, fresh revision IDs, half-open microsecond ranges, batch validation, source projection and endpoint behavior are fixed. Keep durable commit logic behind an interface for slice 06; prove pure behavior now. Define cut/pause event projection and partial-word fragments.

## Runnable checkpoint

Run bun run lab:timeline on a 20-second labeled fixture: trim ends, remove two middle ranges, overlap/adjacent cuts, cut across a pause/word, inspect boundary frames, and restore prior spans. Produce a compact JSON/text ledger with independently expected source intervals, edited duration and event placement.

## Acceptance

Expected intervals/durations match hand-specified examples, including composition through prior edits. Invalid/full-removal edits are rejected before mutation. Cursor bounds reset across cuts. Native render plan is ordered kept-source intervals; native consumers never re-derive edit semantics.

## Decisions delegated and scope firewall

Internal interval algorithm and names are delegated; public units, range rules, IDs, partial words and markers are fixed. A new behavior requires updating contracts rather than a consumer-local workaround.

## Visual review

Text/JSON evidence suffices. If an optional timeline graphic is produced, limit judgment to segment/event alignment and run screenshot-critique last; compare with the explicit expected spans.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

If a mapping rule is ambiguous, fix it here and in contracts.md before media consumers proceed; do not let encoder code choose user-visible edit semantics.

