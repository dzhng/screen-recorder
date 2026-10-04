# Local service composition

The menu-bar app owns this service process. The [canonical entry](src/main.ts)
composes the local listener, durable [core owners](../../packages/core/README.md)
and native execution. CLI, MCP and app controls call the same operations. Building
this composition does not install it or migrate a person's library.

## Acceptance and process lifetime

The app's inherited control pipe carries multiple framed requests; the private
socket accepts one request per connection. [Protocol framing](../../packages/protocol/README.md)
owns shared bounds. A complete request line is the acceptance boundary: waiting
for EOF would make a later disconnect invisible on a half-closed Unix socket.
Bytes after acceptance cannot roll back an already committed request.

Disconnect and deadline cancellation signal accepted handlers, which must drain
their asynchronous work. Transport performs no automatic mutation retries.
Correlated bounded failures remain answerable even when the handler's result is
too large for its original response channel.

EOF or broken control output closes the listener and settles owned work. Startup
reports readiness or a structured failure; the app does not hide failure behind
a second daemon or an endless restart loop.

## Update admission

The [admission gate](src/update-admission.ts) joins evidence from existing work
owners and transport lifetimes. Waiting for an update leaves ordinary operations
usable. A private preparation briefly fences new requests and either returns
blockers immediately or grants one service-owned replacement permit. Prepared
admission returns retryable `UPDATING` before acquiring product resources; no work
is canceled to make the service idle.

Only the inherited app control pipe accepts [update coordination](../../packages/protocol/src/update.ts).
Release is safe to repeat and never releases a successor's permit; commitment
requires the current permit. The native app supplies update status, which health
projects beside the running release version. Until an updater reports, update
status is unavailable; absent runtime version metadata reports null. An unavailable updater or disabled
automatic updating does not imply an unhealthy service. This gate provides no
bundle-replacement, code-signing or launch-lock guarantee by itself.

## One runtime owner

Never unlink a live listener's path. Recovery needs proof the prior owner is gone;
a refused connection is distinct from a reachable listener or a non-socket entry.
Startup holds an exclusive advisory lock for its lifetime before probing and
reclaiming a stale socket. The lock's inode remains stable so competing starters
cannot each create a different lock after observing the same dead listener.
Kernel lock release handles process death; a PID file alone cannot supply that proof.

The listener removes only the path it bound. A second unlink after close could
remove a successor's socket. Pre-existing runtime directories must already be
private and owned; startup does not repair arbitrary directories in place.

## Coordinating work without another domain model

The service turns admitted requests into work for existing owners. Pure
[composition](../../packages/composition/README.md) defines edits and compiled
plans; [native workers](../../helpers/mac/README.md) execute physical media work.
Authoring support and execution readiness are separate. Capability discovery
must report actual prepared/native requirements rather than inventing a fallback.

Capture admission and donor retirement share one [source coordinator](src/capture-sources.ts).
A ready acquisition owns its media independently of its recording donor. Deletion
joins borrowers and unfinished native work before donor removal; a mutable path
or alias cannot replace the frozen authority already admitted.

[Export coordination](src/exports.ts) executes a pinned durable intent. Video,
standalone audio and portable packages use the same publication lifetime;
audio-only export does not require picture preparation. Output format meaning
belongs to the composition settings owner, not another service allowlist.

Package extraction proves containment and retained resource identity. Adoption
also validates dependency meaning and owns managed copies. Inspecting a handle
alone does not create a project; adopted projects survive handle closure and donor
removal. [Portable resources](../../packages/core/src/project-package.ts) own the
retained evidence and prepared outputs required by project history.

Service shutdown drains jobs, readers, publication and storage observations before
closing the catalog. The [release disposition](../../specs/done/agent-editing/release-closeout.md)
records installed evidence separately from an isolated service check.
