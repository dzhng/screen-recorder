# 23d — Native export status and discovery parity

Status: isolated receipt/controller parity verified. [Evidence](../assets/23d-export-consumer-parity/README.md). Depends on the retained
[23b export receipts](23b-export-recovery-preservation.md); final installed
switching remains owned by [23](23-cutover.md).

## Contract

The existing native export consumer reads real recording and project export
receipts without inventing or conflating their owners. Exactly one owner is
required. Received export identity, revision, destination, output and lifecycle
facts remain those returned by the service. A malformed response produces visible
consumer failure; it is never silently accepted or discarded as success.

The actual recording destination-selection and create/replay flow remains intact.
This child adds no project selection or project creation, service operation,
schema, forwarding facade or second export controller. Recording deletion removes
only recording-owned entries, even if a project's opaque identifier is identical.
Installed switching, obsolete-owner deletion and migration are not authorized.

## Existing owners

`ExportsState.Record` represents received target ownership; `ExportController`
continues to send, rediscover, observe and act on service-owned exports.
`ExportMenu` presents the same target and service action availability. Failed
status reads preserve the last good receipt and remain distinguishable from
failed actions. A later valid status can clear its read failure. An unanswered
accepted retry keeps even a previously stopped receipt under observation until status resolves
it, without resending the mutation. Retry and create use the same unanswered
reply classification, including unreadable data and transport loss; definite
refusals do not extend polling. Discovery keeps
processing independent items and following pages after one malformed receipt,
while retaining the traversal's failure instead of overwriting it with success.

## Verification boundary

Use the existing `apps/macos/tests/export-controls.test.mjs` direct Swift compiler
and scripted external Call seam. Feed unchanged retained 23b public receipts to
the actual decoder/controller/menu. Verify complete received fields, both owner
kinds, paginated rediscovery, retry/cleanup/reveal behavior, malformed responses
and same-ID cross-kind deletion isolation. Keep the existing focused recording
create/save-choice/lost-response regression. Demonstrate the project-receipt
regression red on the original consumer before accepting the fix.

No media render, ASR/model work, hardware capture, broad 23b repeat, installed
switch or native media-worker build belongs here. Direct isolated Swift controls
compilation uses existing code dependencies. Menu-model assertions establish
consumer content and action semantics; they do not claim screenshot aesthetics
or final installed acceptance.
