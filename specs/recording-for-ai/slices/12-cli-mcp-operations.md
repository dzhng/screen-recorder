# 12 — Complete CLI/MCP inspection and editing

Status: adapter seam implemented in [12a](12a-cli-mcp-adapters.md); full capability
and actual-media journey remain open. Dependencies: 00b, 07, 08, 11.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

## Contract and API seam

Both machine interfaces expose every editing and inspection operation through one registry and service.

Finish operation registry/adapters from contracts.md, including trim/cut/history/undo/restore, transcript literal search, raw cursor/audio, processing retry, library storage/delete, capture controls and package/export job definitions. JSON-first CLI help describes time units and revision requirement. MCP uses official SDK/stdout isolation and actual image blocks. Export handlers can report capability not-ready until slice 14, never advertise success.

## Runnable checkpoint

Run bun run lab:api. Exercise one set of scenarios through CLI subprocess and MCP transport against real service/storage. The actual client identifies an image-only token, reads target word ranges, submits multiple cuts, fetches edited images/transcript, rejects a stale cut and undoes. Test request replay and malformed/oversize inputs.

## Acceptance

Coverage check proves every public operation has both adapters. Same arguments produce equivalent structured results and errors. Editing works before transcript readiness when ranges are explicit. Source IDs and explicit region allow headless capture control after permissions; no public read secretly starts capture. Registry-derived help works before app/model setup.

## Decisions delegated and scope firewall

CLI command spelling/help wording and SDK binding are delegated; operation semantics are fixed. Remove the temporary public image probe while retaining its test. No semantic 'remove ums' implementation belongs inside the product.

## Visual review

Returned edited frame correctness only. Actual-client image proof plus compare-screenshots of known edited fixture and screenshot-critique last.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

If the client cannot ingest a result representation, fix the adapter using actual content; do not fork core behavior per client. Native rendering is verified next.

