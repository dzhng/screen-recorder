# Local service boundary

The listener owns a private Unix socket and accepts injected domain handlers.
The application composition owns its lifetime; this package does not install a
daemon, start native recording, or duplicate the edit engine. The subprocess
fixtures exercise the existing SQLite core through the public client.

## App-owned process lifetime

The entrypoint is the composition root the menu-bar app launches as its one child.
It resolves the personal root (`SCREENREC_HOME`, else `~/.screen-recorder`), opens
the listener beneath it, and then speaks JSON lines over the inherited pipes: the
app writes requests on stdin, the service answers on stdout, and stderr stays for
diagnostics. Startup announces the bound listener or one structured failure, so a
service that cannot start is reported rather than retried. There is no restart
loop and no second daemon.

The [canonical entry](src/main.ts) composes the fresh-library project service.
It keeps the prior catalog and media intact; capture supplies source facts and
the caller explicitly authors projects. The default build uses this same entry.
Building a candidate does not replace the installed app or migrate its library.
The [release record](../../specs/done/agent-editing/release-closeout.md) owns the
delivered personal installation and its accepted verification limits.

The pipe carries many frames from one trusted peer, unlike the socket's one
request per connection. An unreadable or oversized control line therefore answers
with a null correlation ID and the stream resynchronizes at the next terminator,
matching the native worker's line protocol. Requests past the shared in-flight
bound are refused rather than queued. EOF on that pipe is the shutdown signal: the
listener closes, libuv removes the path it bound, and the process exits.

A complete JSON line is the acceptance boundary. Clients keep the connection open
until the reply arrives; EOF before a reply cancels the connection. Waiting for
EOF to accept a request would make a later disconnect invisible on a half-closed
Unix socket. Bytes after an accepted request cannot roll back that request.

The listener limits the time spent receiving a request. After acceptance, the
caller's timeout or cancellation closes the connection and signals the handler.
Handlers must cooperate with that signal to stop their own asynchronous work.
Disconnecting, timing out, or closing the listener never rolls back a committed
mutation. Explicit retries reuse the same durable domain request ID; the
transport performs no automatic retries.

Shared byte bounds and UTF-8 framing live in
[protocol](../../packages/protocol/src/framing.ts). Replies preserve request IDs;
operation failures remain structured data. Invalid requests close the connection
without dispatch because there may be no trustworthy correlation ID. If a handler
produces an oversized response, the listener sends a bounded limit error instead.
The operation may already have committed, so consumers must retain its request ID.

Socket recovery follows one invariant: never unlink a live listener's path.
Startup refuses an occupied path, and libuv removes its bound path on close.
There is no second unlink after close that could remove the next listener's file.
Only the app composition reclaims a stale path, and only by proving the prior owner
gone: a refused connection means nothing is listening, while a successful one means
a live owner that is never unlinked and never killed. A listener killed outright
cannot unlink its own path, so without that proof one crash would block every later
launch. Anything at that path that is not a socket is refused rather than removed,
since this lifecycle did not create it and cannot identify it. Same-user external
replacement of a live path is outside this lifecycle contract. Existing runtime
directories must already be owned and private; startup does not change permissions
on an arbitrary pre-existing directory.

Proving the previous owner gone is not the same as becoming the next one. Probing
and removing are two syscalls, so simultaneous starters can all see a refused
connection and each go on to unlink and bind, leaving several processes announcing
one path. Startup therefore takes an exclusive advisory lock on `run/service.lock`
before it inspects anything, using the atomic lock `open(2)` offers, and holds it
for the process's life. The kernel releases that lock however the process dies,
which is what a PID file or an inode comparison cannot observe, and the lock file
is never unlinked because a later starter must lock the same inode. Every startup
path takes it; a starter that cannot is a reported conflict, not a queued retry.

Control output is answerable under load. An accepted request can name an operation
too long to quote back inside the same frame, so an unencodable reply degrades to a
bounded correlated error rather than becoming an unhandled failure that skips
listener cleanup. A broken control output — the app dying while a reply is being
written — closes the listener through the same path EOF uses, so the promised
cleanup is not lost to a race between the two pipes. `service.health` takes no
parameters and refuses the ones it is given.

## Project publication

[Media exports](src/exports.ts) publish only explicit project requests. Each intent
pins its project revision and destination before execution; replay and recovery
use that intent even after edits or a lost acknowledgement. Private staging and
package workspaces stay owned until cleanup is confirmed, while committed external
files remain independent of project deletion.

## Editable package ownership

Project export uses the existing durable publication owner. Archive extraction and
retained handles use a domain-independent bounded registry. Callers supply a required
manifest validator and hydrate resource metadata through admitted file descriptors
before readiness. Package handles retain the copied archive and extracted members;
media inspection belongs to the adopted managed sources and projects.
The project manifest owns dependency meaning, while asset/project stores own
byte validation and atomic durable adoption. Package inspection alone does not
create a managed project. Closing a handle drains its unfinished work; adopted
projects no longer depend on that handle or donor files.

[Portable resources](../../packages/core/src/project-package.ts) define the
authenticated retained evidence and prepared media carried with project history.

## Storage observations

[Managed storage](../../packages/core/src/storage.ts) measures live regular-file
lengths with one contained, cancellable scanner. In the fresh project library,
retained files are shared across projects; this aggregate does not estimate a
project's share of an asset. Registered derivatives remain cache bytes. Models
and external donor files are excluded. Managed capture donors remain counted while
active, unfinished or fenced for deletion. Private export staging is measured by
the publication owner outside the managed root. Closing the service aborts and drains
observations before closing the catalog.

## Captured-source lifetime

[Capture sources](src/capture-sources.ts) share admission and donor retirement.
Deletion and discard fence unfinished borrowers, join their queue attempts, and
hold the recording directory through native removal. A ready acquisition owns its
originals and evidence independently; deleting its donor cannot mutate a project.
Explicit imports derive managed donor ownership from frozen canonical members,
so selecting a directory through an alias cannot escape that lifetime.

## Standalone audio publication

Audio export pins the existing project PCM recipe and uses the same export intent,
queue and atomic destination publication as video. WAV delivery reuses inspection
PCM; encoded audio is another rendition in the same audio owner and derived cache.
Output settings own format meaning, defaults and codec validation. Audio readiness
never depends on visual preparation, and exporting never edits the document.
The [output settings owner](../../packages/composition/src/output-settings.ts)
defines admitted standalone formats and the shared encoding controls.

## Evidence freshness

[Source selection](../../packages/core/src/source-selection.ts) shares catalog
metadata only within one synchronous phase. Batched acquisition rows decode on
use, keeping an earlier source refusal ahead of later malformed metadata.
Checkpoint publication ends that phase; the reader resolves dependencies again
before returning a continuation. [Project evidence](../../packages/core/src/project-evidence.ts)
returns complete dependency metadata on the first page and its immutable manifest
reference on continuations, so pagination carries source facts once while keeping
every freshness check. Scene preparation keeps per-source admission
order rather than making batch fetching an eager validation step.
