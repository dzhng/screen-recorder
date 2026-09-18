# 12 — Complete CLI/MCP inspection and editing

Status: adapter seam implemented in [12a](12a-cli-mcp-adapters.md); full capability
and the full actual-media journey remain open. A [Codex CLI journey](../assets/agent-cli-journey/README.md)
now proves image-only token reading, cut/inspect, stale rejection and undo on
generated silent media. An [MCP SDK-to-model journey](../assets/agent-mcp-journey/README.md)
now proves the same flow with actual image blocks, including a disclosed glyph
misreading corrected by reinspection. Transcript pages, search, speech model preparation,
both exports and a relocated package's own playable preview are now public operations; an actual agent journey over real narration and
installed acceptance remain.
Dependencies: 00b, 07, 08, 11.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

## Contract and API seam

Both machine interfaces expose every editing and inspection operation through one registry and service.

Finish operation registry/adapters from contracts.md, including trim/cut/history/undo/restore, transcript literal search, raw cursor/audio, processing retry, library storage/delete, capture controls and package/export job definitions. JSON-first CLI help describes time units and revision requirement. MCP uses official SDK/stdout isolation and actual image blocks. Export handlers can report capability not-ready until slice 14, never advertise success.

## Runnable checkpoint

One set of scenarios runs through a CLI subprocess and the MCP transport against a real
service and real storage in `apps/cli/src/main.test.ts`, including request replay and malformed
or oversize input, with both adapters asserted to advertise exactly the registry. The agent half —
an actual client reading an image-only token, submitting cuts, fetching edited images and
transcript, having a stale cut refused and undoing — is recorded as two journeys
([CLI](../assets/agent-cli-journey/README.md), [MCP](../assets/agent-mcp-journey/README.md)) on
generated media; the same journey over real narration needs an agent that is not this one.

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

