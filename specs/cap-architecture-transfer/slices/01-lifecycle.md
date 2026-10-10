# Slice 01 — internal lifecycle and quiescence ownership

Status: implemented. The queue/recovery join and terminal-error retention were
already covered. Quietness predicates now share empty idle proof; contradictory
idle status retains deletion intent with `CAPTURE_NOT_QUIET`. Regression was red
(quiesce incorrectly resolved), then green; 28 focused lifetime/finalizing tests
passed. No public schema or native lifecycle change was needed.

## Contract unlocked

Stopping, canceling, service close and deletion must wait for the owned native
capture/recovery work to unwind before media is removed or presented as settled.
The public `Recording.state`, operation names, error codes and response shapes
do not change.

Cap's reference is `InstantLifecycle`: cancellation is separate from joined
work, `Pending` cannot be mistaken for `Joined`, and terminal errors are
retained ([`crates/recording/src/instant_recording.rs:45-115`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/crates/recording/src/instant_recording.rs#L45-L115)); `Actor::stop` cancels, stops both pipelines, joins and preserves the terminal error ([`.../instant_recording.rs:394-485`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/crates/recording/src/instant_recording.rs#L394-L485)).

## Yap seam and ownership

Keep the service's serialized queue and recovery attempt as the sole owner in
[`apps/service/src/capture.ts:64-106`](../../../apps/service/src/capture.ts:64).
Make the “native can be recovered” and “this deletion is released” predicates
one named internal seam, replacing the duplicated checks at
[`apps/service/src/capture.ts:234-264`](../../../apps/service/src/capture.ts:234)
and [`apps/service/src/capture.ts:468-480`](../../../apps/service/src/capture.ts:468).
Keep `CaptureStore` as the state-transition owner ([`packages/core/src/capture-store.ts:48-83`](../../../packages/core/src/capture-store.ts:48)).

## Tests first and verification

Add/adjust tests before implementation using the existing fixtures:

- Extend cancel/unwind coverage in [`apps/service/src/capture-finalizing.test.ts:66-144`](../../../apps/service/src/capture-finalizing.test.ts:66).
- Extend close and deletion race coverage in [`apps/service/src/capture-lifetime.test.ts:21-306`](../../../apps/service/src/capture-lifetime.test.ts:21).
- Assert repeated stop/cancel returns the retained terminal outcome, matching Cap's repeated-error tests ([`.../instant_recording.rs:2584-2602`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/crates/recording/src/instant_recording.rs#L2584-L2602)).

Run only the affected service/core tests first. The proof must say that native
closure precedes deletion and that no new public field or operation appeared.

## Firewalls

Do not add a public quiescence axis, a new recovery operation, a second worker
owner, or a compatibility wrapper. Preserve native/service sequence partition
and `CAPTURE_NOT_QUIET` behavior.
