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


## Editable package ownership

Project export uses the existing durable publication owner. Archive extraction and
retained handles share the same bounded registry as recording packages; each
service supplies its own manifest validator and explicit media-member authority.
The project manifest owns dependency meaning, while asset/project stores own
byte validation and atomic durable adoption. Package inspection alone does not
create a managed project. Closing a handle drains its unfinished work; adopted
projects no longer depend on that handle or donor files.

[Portable-project scope and evidence](../../specs/agent-editing/slices/22-portable-projects.md)
separate the verified asset-only path from retained owner classes still refused.

## Storage observations

[Managed storage](../../packages/core/src/storage.ts) measures live regular-file
lengths with one contained, cancellable scanner. In the fresh project library,
retained files are shared across projects; this aggregate does not estimate a
project's share of an asset. Registered derivatives remain cache bytes. Models
and donor files are excluded, while private export staging is measured by the
publication owner outside the managed root. Closing the service aborts and drains
observations before closing the catalog.
