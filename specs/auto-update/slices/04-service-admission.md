# 04 — Fence service admission without interrupting work

Unlock: service composition atomically returns a replacement permit or truthful
blockers, with no accepted operation/resource escaping accounting. Independent of
Sparkle; use deterministic owner and transport fixtures.

## Seam and artifact

Compose one admission gate in [project service](../../../apps/service/src/project-service.ts).
Existing owners supply read-only update-blocking evidence; do not build a shadow
job/resource registry or loosen `JobQueue.idle()`. Include socket reservations,
reply/delivery creation and handler completion from
[local transport](../../../apps/service/src/index.ts), both control directions,
and the internal `capture.report` path that currently bypasses `serve()`.

Private app-control-only requests are `update.prepare {}`, `update.commit {permitId}`,
`update.release {permitId}` and `update.report {update: UpdateStatus}`. Define strict
schemas and `UpdateStatus` in shared protocol using the data contract in 06; reject
these internal requests as public socket operations. Preparation
returns `{kind: 'blocked', blockers}` or `{kind: 'prepared', permitId}`. The opaque
reference names one service-owned permit bound to its issuing process and control
channel. The app never owns or reconstructs the service permit.

Use the existing call timeout as the preparation acknowledgement deadline; an
uncommitted lost-reply/expired permit releases its own fence. Control disconnect,
service replacement or release invalidates the reference. A stale commit/release
cannot alter a newer permit. Private update bookkeeping and its correlated replies
are excluded from product-work blockers; unrelated calls on either control direction
remain fully accounted. Committed ownership survives until the proven installer/
launch exclusion takes over, then service shutdown invalidates its local reference.
No caller capability or version negotiation is introduced.

Waiting keeps admission open. A prepare attempt fences first and inspects all
owners atomically. If accepted work/resources remain, release the fence and return
blockers immediately; let them finish normally. While prepared/committed, new
public requests return correlated retryable `UPDATING` **before** reservation,
handler dispatch or domain acquisition. Account already-accepted completion/report
and transport cleanup without treating them as new user work.

While a candidate waits, forward coalesced lifetime-progress notifications through
one private `update.progress` control event; events signal recheck, not a second
snapshot owner. Add narrow owner notifications where no existing signal covers
reservation release, autonomous lease expiry or model/cleanup settlement. No new
polling loop. Subscribe only while needed and remove the subscription on discard.

Human artifact: service race timeline showing acceptance, owner blocker, refusal,
settlement, permit and safe reopening, with actual JSON envelopes.

## Proof

Write red/green barrier cases at this seam, then run the changed owning file:

- Complete socket/control frames racing the fence are either accepted and tracked
  through reply cleanup, or rejected before any resource/domain work.
- Deferred-result reservation and reply-time lease creation cannot escape; accepted
  disconnect/cancellation remains owned until execution and cleanup settle.
- Waiting/queued/running jobs, canceled attempts, worker pipe/process drain, model
  preparation, startup reconciliation/storage observations all block.
- Capture start/report/finalization, publication/deletion, retained package handles,
  delivery reservations and result/media/preview leases block until their owners
  finish/release/expire. Settled history does not block indefinitely.
- Preparation through the real private control pipe does not count itself as work;
  unrelated calls and their replies still block. Lost preparation replies release
  uncommitted fences within the acknowledgement deadline.
- Prepare A → release A → prepare B → stale release/commit A leaves B fenced.
  Disconnect/replacement invalidates references without releasing a successor.
- Autonomous lease expiry/model settlement wakes a recheck without a new user
  request; repeated progress coalesces and never spins a retry loop.
- Failure before commitment releases only its own fence exactly once. No update
  observation aborts, revokes, cancels or retries product work.

Reuse existing `index.test.ts`, `lifetime.test.ts`, `result-delivery.test.ts`,
`delivery.test.ts` and owner tests where APIs change; run file-level Vitest via
[service manifest](../../../apps/service/package.json). Keep framing limits,
ordinary shutdown/cancel and uncertain-write behavior green. No recording required.

## Verdict and freedoms

Delegated: internal type names and owner snapshot versus counter implementation,
provided each lifetime has one owner and a race test. Do not expand into a new
public command family or long-lived drain allowlist. Inventory each mapped owner
with coverage or a reason another owner fully covers it. Feedback changes this
slice if waiting blocks the user's ordinary workflow or reports a false idle.
