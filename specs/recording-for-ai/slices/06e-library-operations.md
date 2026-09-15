# 06e — Library operations through the running service

Status: complete for the library-operation binding; process, packaged lifecycle
and independent review checks pass.
See [verification](../assets/service-operations/review.md).
Dependencies: 06a, 06b, 06c. This binds existing catalog/edit behavior while capture
allocation and reconciliation remain in parent 06.

## Contract

The app-owned service opens the single core catalog after claiming its process
ownership lock. Both its private pipe and local socket use the same validated
operation dispatcher. Shutdown closes the listener and catalog before releasing
ownership. Startup failure releases resources it already acquired.

Only implemented capabilities are declared in the protocol's operation schema.
CLI/MCP adapters consume that declaration; they must not maintain their own
parameter rules or advertise unimplemented work. Core owns edit algebra, revision
identity, transaction replay and history bounds. Service code validates the wire
shape and composes those owners.

## Verification

Real-process tests seed a temporary catalog before starting the actual service
entrypoint, then inspect and edit it through the local client. Exact retained spans,
new undo identity, stale-write rejection and replay after process relaunch prove
that this reaches durable core behavior. No recording is manufactured by a read
operation. Native capture, artifact jobs and full CLI/MCP parity remain later gates.

The authoritative test scenarios live in `apps/service/src/operations.test.ts`;
public parameter shapes live in `packages/protocol/src/operations.ts`.

Recording discovery uses a bounded database query and a creation-sequence cursor,
not an offset or a materialized whole-library list. Tests cover adding and editing
takes between pages, canceled takes, continuation after reopening the catalog and
restarting the service, and matching CLI/MCP results. This completes the recording
list operation; storage accounting, manual deletion and artifact readiness remain
in the parent spec.
