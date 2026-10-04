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

Release is idempotent: an absent reference already has the requested end state.
It succeeds without altering another current permit. Commitment still requires
the current reference and fails with `INVALID_PERMIT` otherwise.

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

## Service pass — 2026-10-04

Implemented independently of the native updater. The private pipe owns strict
prepare/commit/release/report requests and the payload-free `update.progress`
event. Socket admission rejects private update operations and fences ordinary
requests before delivery reservation or dispatch. Waiting leaves every ordinary
operation usable. A service-owned UUID permit expires on the control call deadline
unless committed; stale references never release a successor.

The gate reads existing-owner evidence, including transport write/close completion;
it does not call cancel, close previews, drain queues or mutate domain state.
Notifications coalesce by event turn and owner subscriptions exist only while a
candidate waits. The running service reads an optional adjacent runtime manifest
version; standalone/personal metadata defaults to null and update state defaults
to unavailable. Packaging of that version and native status production remain the
later slices' work.

### Owner coverage

| Owner | Evidence and coverage |
| --- | --- |
| Socket/control acceptance and reply lifetime | Actual frames and private pipe: arrival race, held control write, write throw, disconnect, stale permits and lost preparation acknowledgement. Socket requests remain owned until handler settlement **and** actual close. |
| Durable/context jobs and native workers | Queue snapshot includes waiting, queued, running, canceled attempts and pending admission. Service cancellation barrier and core wait/queue tests pass. The existing worker owner settles on child **close**, covering process and pipe drain; no second worker registry. |
| Capture/report/reconciliation | Actual pipe tests cover preparation, recording, finalizing, settled report and outstanding startup observation. Native media remains a scripted edge; no desktop capture. |
| Publication/deletion | Service export admission and disconnected deletion/storage-worker barriers; queue covers rendering/publication attempts and cleanup. Settled durable export receipts are history, not live handles. Existing recording/project deletion files remain green. |
| Package handles | Owner-generated package metadata plus real retained extracted files through service open/status/close. Ready handle and asynchronous cleanup both block. The worker edge is scripted, so this does not certify native ZIP authentication/extraction. |
| Delivery/result/media/preview leases | One delivery owner covers reservations and every derivative kind. Reply-created result lease, autonomous expiry, existing media lease/renew/revoke tests and result-capacity tests pass. No preview is closed to obtain idle. |
| Models | Existing preparation/verification owner blocks through settlement and notifies without a new status request. Controlled local HTTP bytes exercise the owner; no registered model download or inference. |
| Storage/startup | Disconnected storage observation remains owned until descriptor closure. Pre-listener recovery is unavailable externally; post-listener reconciliation has explicit startup and domain blockers. |

### Verification

Focused green proof: 93 service tests across eight files, 132 core owner tests
across four files and 20 protocol tests across two files. Protocol, core and
service builds and typechecks pass; the diff check passes. Targeted lint passes
with one unchanged constant-condition warning in the package owner.

Initial red: real `update.prepare` pipe request answered UNKNOWN_OPERATION rather
than a permit. Regression falsifications: removing the owner inspection made seven
service blocker tests fail; disabling the job/model snapshots made their owner
tests fail; removing event coalescing emitted nine notifications instead of one;
removing health projection broke both version and native-status tests; omitting startup evidence broke the real-child reconciliation case; skipping failure release kept health fenced after a failed owner snapshot. Every
mutation was restored and the owning checks rerun green. The synchronous output
write test first exposed a stranded transport blocker and then passed after write
settlement handled both callback and throw.

The independent Codex review found test success narrowing and a failure teardown
that could wait before releasing a held worker. Both were corrected. Its sandbox
could not bind sockets (EPERM); actual socket proofs above ran in this worktree.
Shape review retained one gate and each existing owner, removed a duplicate refusal
from the already-admitted handler, and kept the transport fence at complete-frame
acceptance. No dependency, table, native updater, build/release modification or
polling loop was added.

Full feature acceptance and native updater integration remain OPEN; these service
checks do not establish Sparkle install safety, launch/swap exclusion, OS signing,
permission preservation or installed A→B acceptance. The repository-wide final
run belongs to completion of the assembled spec, not this independent pass.

### Integrated review

The primary worktree built protocol, core, client and service before exercising
the eight owning service files; focused core/protocol checks and typechecks passed.
Release became idempotent after the integrated shape review: a real private-pipe
regression first failed on releasing an expired reference, then passed while
proving that its successor stayed fenced and repeated cleanup succeeded.

Independent Codex review found the null-ID fallback for an oversized control
reply dropped product-write ownership. A held-write case through the real service
first reproduced premature preparation; the final fallback now uses the same
owned write path as correlated replies. Both reply variants pass. The changed
service/lifetime files were rerun after this correction. Codex's own socket checks
were denied by its sandbox (`EPERM`); the primary worktree's socket tests provide
the actual integration proof. No admission or framing requirement was relaxed.

### Actual envelope timeline

Captured from the built service child in a disposable home. The app-side fixture
held one native status answer; no capture or media worker was started. These are
the actual correlated envelopes (the startup announcement is omitted).

```jsonl
{"event":"call","request":{"id":"service-1","operation":"capture.status","params":{}}}
{"event":"result","response":{"id":"blocked","ok":true,"data":{"kind":"blocked","blockers":["requests","transport"]}}}
{"event":"result","response":{"id":"waiting-open","ok":true,"data":{"projects":[],"nextCursor":null}}}
{"event":"update.progress"}
{"event":"result","response":{"id":"accepted","ok":true,"data":{"device":{"state":"idle","recordingId":null,"sourceId":null,"elapsedUs":null,"selection":null,"permissions":{"screen":true,"microphone":"authorized","camera":"not_determined"}},"recording":null}}}
{"event":"update.progress"}
{"event":"result","response":{"id":"permit","ok":true,"data":{"kind":"prepared","permitId":"47d71f7b-c1eb-453c-9b5f-dccaf5bdbced"}}}
{"ok":false,"error":{"code":"UPDATING","message":"Service replacement is prepared; retry after the update","retryable":true,"details":{}},"id":"refused"}
{"event":"result","response":{"id":"released","ok":true,"data":{"released":true}}}
{"ok":true,"data":{"projects":[],"nextCursor":null},"id":"reopened"}
```
