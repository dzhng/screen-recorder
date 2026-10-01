# 21f1 — Durable capture facts independent of editing

Status: integrated and [merged-verified](../assets/21f1-capture-facts/merged-verification.json)
by focused source/schema/SQL tests. This is the selector-free first checkpoint of
[21f](21f-public-camera-selection.md); complete source admission and public camera
selection remain subsequent checkpoints, with selection still dependent on 21e.

## Contract

One capture store owns take allocation, durable request replay, lifecycle sequences,
source duration, discovery and deletion fences on the shared catalog connection.
`CaptureService` retains the existing control order, native reconciliation and
shutdown. Fresh capture facts create neither a span revision nor a project.

The installed revision store remains an editing specialization of that same
capture owner. Its source attachment and original span creation succeed or roll
back in the same transaction as the terminal lifecycle write. Editing cleanup
likewise remains inside the shared deletion transaction. Notifications cannot
establish either guarantee.

The existing nullable `currentRevisionId` recording field remains only to preserve
installed editing and app consumers. Fresh capture facts leave it null. Slice 23
removes the obsolete span consumers and their fields together at hard cutover;
this extraction does not migrate or rewrite the installed library.

## Verification and boundary

The [verification packet](../assets/21f1-capture-facts/verification.json) retains
focused tests, deliberate failure controls, baseline diagnostics and final source/
compiled identities. Existing allocation, lifecycle, deletion, duration and installed
rollback checks pass. Fresh facts survive reopen without creating editing tables
or projects. Capture finalization/lifetime checks preserve the single coordinator.
The fresh service constructs this capture store as its one catalog owner, while
capture routes and camera selection remain unavailable. No source-admission
coordination, installed switch or capture/media execution is included.

The catalog-refusal test retains every existing format case and its unchanged
deadline. It now compares files with exact byte equality; structural assertion
comparison timed out on both extracted and original store implementations. A
deliberate changed-byte control fails. This is an oracle correction, not a latency
acceptance or an isolated performance claim.

Keep parent 21f open. Source/schema/SQL tests prove the extraction, not complete
fresh-service capture wiring, native media, physical synchronization or stop speed.
