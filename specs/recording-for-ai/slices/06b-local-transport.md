# 06b — Bounded local service transport

Status: in progress. Dependency: 00; the real edit round-trip fixture also uses
06a. This is the independent transport portion of 06. It does not establish app
lifetime, native ingestion, processing jobs, or full public operation coverage.

## Contract and owner

The service accepts local requests through a user-private Unix socket. The client
sends one request per connection and receives one correlated result. One connection
per call keeps cancellation/disconnection separate without a session protocol.
Shared JSON-line framing belongs to protocol; socket clients belong to client;
listener lifetime belongs to apps/service. Domain handlers are injected by the
service composition root and use the existing core. No second edit implementation.

Use the existing request envelope and a typed result envelope with matching ID.
Bound request frames to 1 MiB and response frames to 8 MiB. Reject oversized,
malformed, truncated or uncorrelated responses explicitly; binary media travels as
file references across this local control boundary. MCP later reads image bytes.
Default call/read timeout is 10 seconds, overrideable for explicit long inspection
calls. Timeout closes the connection; it never implies rollback of a committed
mutation. Caller retries carry the same request ID. No automatic retries.

Create the socket's private runtime directory with mode 0700 and socket mode 0600.
Never unlink an occupied socket on startup: return a startup conflict. App lifecycle
reconciliation in parent 06 owns proving and removing a dead prior socket. Closing
this listener lets libuv remove its bound socket; do not unlink it again after
close. This relies on the supported no-live-unlink invariant: no app recovery or
startup path removes a live listener. Arbitrary external filesystem replacement
is outside that ownership guarantee. No independently installed daemon.

## Review surface and verification

Use actual Node subprocesses and temporary sockets. Send a real cut through the
client to a handler using SQLite; inspect persisted spans, replay the same request,
and observe a stale different request. Verify malformed/oversized input leaves
that domain state unchanged; delayed/missing replies time out, socket close releases
resources, and a second listener cannot evict the first. Test UTF-8 split across
chunks and a truncated response at the shared framing seam. No visual gate applies.

Internal helper names are delegated. Public units, operation semantics, resource
bounds and no-silent-retry behavior are fixed. Parent 06 integrates native lifetime
and journal reconciliation; slice 12 binds the complete public operation registry.
