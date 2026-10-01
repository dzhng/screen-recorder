# 24z11 — Complete large operation results over MCP

Status: implementation next. The retained [24y default-client failure](24y-source-event-duration.md#validation-client-capacity) is the reproduction authority; its configured-client proof remains historical evidence, not a production fix.

## Contract and ownership

An MCP caller receives either the ordinary complete inline operation response or a typed small descriptor for the complete response as a renewable JSON artifact. Both descriptor representations retain the operation correlation ID and success/failure outcome. The descriptor carries token, byte count, expiry, SHA-256 and `application/json` media type. Existing `artifact.read`, `artifact.renew` and `artifact.close` reconstruct exactly the canonical UTF-8 `OperationResponse` bytes. Error results retain their error outcome. CLI and ordinary socket responses keep their full operation meaning and current response contract.

The MCP adapter requests this representation in the local request envelope before dispatch, outside operation arguments. The existing socket/delivery owners implement it for both service compositions. A conservative inline budget derives from the existing protocol response-frame bound and JSON wrapping overhead; neither SDK nor service bounds increase. Buffer-backed snapshots remain bounded by the existing complete-response limit; responses already exceeding that limit retain their explicit refusal. The adapter does not resend an operation to obtain an artifact. Transport correlation is separate from an operation's durable replay request ID.

`DerivativeDelivery` remains the single capacity/lease owner. Reserve one of its existing slots before dispatch for requests opting into result delivery; release it for ordinary replies or convert it to a buffer-backed result lease for large replies. Capacity refusal precedes mutation. Maintenance reads/renewals/closes bypass that reservation because their existing replies are bounded; full capacity must never prevent a caller draining leases. Result snapshots are immutable historical replies, not a new project authority or persistent cache.

Cancellation and disconnect retain current mutation semantics: loss of interest does not roll back committed work or authorize automatic replay. Unused reservations are released on every path; unused result leases are released when publication is canceled. Lost descriptor/chunk replies preserve normal lease retry behavior. Expired, closed and restarted-service tokens refuse explicitly. Reissuing an operation uses its existing replay contract and never executes merely to recover transport bytes.

Media attachment budgeting is a separate following pass. A result descriptor must bypass inline media consumption so nested delivery tokens remain usable; result and nested media leases retain independent expiries. This pass claims complete operation-result delivery, not a universal bound for current inline image/audio/batch attachments.

## Verification and discretion

Start from the exact archived `place-9500` receipt and preserve its byte digest. Its ordinary service line fits the existing bound while its duplicated MCP envelope exceeds the installed SDK default. Drive the actual socket and MCP adapter through an unconfigured SDK client, reconstruct every byte through normal artifact operations, verify hash and complete CLI/result equality, and preserve ordinary small responses.

Prove capacity refusal before a mutation, slot reuse after close/expiry/cancellation, maintenance at full capacity, explicit restart expiry, error-result delivery and lost-response recovery with one committed revision. Use deterministic existing service/transport fixtures and retained data; no new capture, native build, inference, listening or large project/timing cohort. Keep original deadlines, limits, public replay/error meaning and current artifact/media consumer checks.

Run repository-local review and choices audit. Record complete source/runtime identities and outputs with compact changed-closure evidence and unchanged authority references. Root owns the shared handoff and ledger. Internal names/structure and focused instrumentation are delegated; large-result representation, single lease ownership, exact data preservation, pre-dispatch capacity and separate media scope are fixed. No compatibility facade, new endpoint, adapter token store, truncation or automatic uncertain-write retry.
