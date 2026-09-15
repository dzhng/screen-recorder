# Local service boundary

The listener owns a private Unix socket and accepts injected domain handlers.
The application composition owns its lifetime; this package does not install a
daemon, start native recording, or duplicate the edit engine. The subprocess
fixtures exercise the existing SQLite core through the public client.

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
The parent application must prove a prior service dead before removing a stale
path. Same-user external replacement of a live path is outside this lifecycle
contract. Existing runtime directories must already be owned and private; startup
does not change permissions on an arbitrary pre-existing directory.
