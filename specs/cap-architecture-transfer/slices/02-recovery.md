# Slice 02 — one strict recovery evidence owner

## Contract unlocked

Recovery either publishes validated source evidence or leaves the take in
`finalizing` with durable retryable `finalizationError`. It never guesses past
ambiguous journal/media bytes and never deletes originals merely because a
worker returned an acknowledgment.

Cap's manifest records version, complete fragments, sizes and recoverable
duration ([`crates/recording/src/fragmentation/manifest.rs:4-57`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/crates/recording/src/fragmentation/manifest.rs#L4-L57)); recovery inspects under a lock and validates complete files before remux ([`crates/recording/src/recovery.rs:187-223`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/crates/recording/src/recovery.rs#L187-L223), [`:451-617`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/crates/recording/src/recovery.rs#L451-L617)). It stages, fsyncs, rechecks inputs and rolls back while retaining originals ([`recovery.rs:1031-1188`](https://github.com/CapSoftware/Cap/blob/2c51caae0a952340be7f57a95813e7c8d0d1df1d/crates/recording/src/recovery.rs#L1031-L1188)).

## Yap seam and ownership

Keep native journaling and media recovery as the fact owners. Consolidate the
service's hand-written recovery parsing at [`apps/service/src/capture.ts:879-925`](../../../apps/service/src/capture.ts:879)
and the inline outcome checks around [`:624-633`](../../../apps/service/src/capture.ts:624)
behind one strict schema/reader in the existing publication owner
[`packages/core/src/capture-publication.ts`](../../../packages/core/src/capture-publication.ts).
Do not create a `capture.recovery` operation. Existing status/get/stop retry
responses remain the public inspection surface ([`packages/protocol/src/operations.ts:1426-1444`](../../../packages/protocol/src/operations.ts:1426)).

## Tests first and verification

- Add a failing test for malformed, extra or renamed recovery fields returning
  the existing `MEDIA_WORKER_FAILED` path.
- Keep recovery/retry cases green in [`apps/service/src/capture.test.ts:602-705`](../../../apps/service/src/capture.test.ts:602)
  and [`apps/service/src/capture-finalizing.test.ts:268-557`](../../../apps/service/src/capture-finalizing.test.ts:268).
- Preserve the journal boundary rules in [`helpers/mac/Sources/YapCapture/CaptureJournal.swift:206-278`](../../../helpers/mac/Sources/YapCapture/CaptureJournal.swift:206).
- Verify ambiguous media remains present and `finalizationError` survives service
  restart via [`packages/core/src/capture-store.test.ts`](../../../packages/core/src/capture-store.test.ts).

Do not change recovery deadlines or native file layout in this slice without a
separate evidence-backed decision: Cap's manifest discipline is the lesson;
duplicating Cap's project model is out of scope.

## Firewalls

No media deletion on uncertainty, no estimated durations, no second publication
owner, no cloud/upload work, and no public recovery endpoint.
