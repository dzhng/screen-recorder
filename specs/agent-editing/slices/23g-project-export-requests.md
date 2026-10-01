# 23g — Explicit native project export requests

Status: implemented; integrated controller and request parity verified with
[scoped evidence](../assets/23g-project-export-requests/README.md). Depends on public
project export operations and the shared native target/receipt owners in
[23d](23d-export-consumer-parity.md) and [23e](23e-preview-consumer-parity.md).
This is a consumer port under [23](23-cutover.md), not installed cutover.

## Contract

An explicitly supplied recording or project target uses the existing export
controller, destination chooser and service lifecycle. Read the selected owner's
current revision before opening the chooser; an intervening edit cannot change
that request. Cancellation admits nothing. A lost answer retains the same export
ID, target, revision, kind and destination for explicit resend or status recovery.
Receipts cannot silently replace the requested owner, snapshot or destination.
Pin the chooser parent using the platform real-path resolver before first send,
matching the existing broker's canonical directory receipt. Preserve the exact
canonical request on resend; no alias may resolve to another folder later.

Choice, unanswered request and received record share MediaTarget. Remove the
recording-only choice/request abstraction and update its actual consumers directly;
no forwarding compatibility entry point, new lifecycle, queue or service operation.
Preserve existing recording behavior, save-panel configuration and suggested names.
Project filenames use the actual project title/identity and pinned revision;
filename sanitization is a destination mechanic, not an editorial decision.

Forgetting a deleted target removes only its own pending/received exports,
including when a recording and project have the same text ID. No project is
created, guessed or linked to a recording. Project listing/menu selection remains
a separate consumer port after actual source deletion/cleanup is available.

## Verification

Compile and run the real controller and shared controls behind their existing
Call/Choose boundaries. Exercise both target namespaces, pre-chooser revision
pinning, chooser cancellation, lost reply/exact resend, status recovery,
wrong-owner metadata refusal before opening the chooser, wrong-owner/revision
receipt/destination refusal, actual owned chooser-directory aliases and same-ID
target isolation. Hold owner-read, chooser, create
and status replies across forgetting a target; late replies must not resurrect
its requests/records or clear a newer choice. Keep the
existing export and preview controller checks and pure-controls tests meaningful.
No window, save panel, player, service media execution, device or model is needed
for these controller checks. Scripted replies prove request/controller semantics,
not new encoded media or installed acceptance.

Retain source/reference identities, complete requests and results plus a negative
control that drops the project selector. Review shape, code, documentation and
choices before committing. Use the existing public export owner for actual media
preservation; do not repeat accepted renders merely to validate serialization.

Delegated: internal names, bounded fixture organization and safe suggested-file
naming. All caller/editorial boundaries and original preservation gates remain.
