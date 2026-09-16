# 13e — Revision-bound preview publication

Status: internal core job/cache consumer verified with real native movies;
[publication evidence](../assets/preview-publication/README.md) records its scope.
Abrupt-service-death staging ownership, pointer composition and public playback
remain open.

## One owner and one verdict

Can a completed movie remain tied to its requested edit through a concurrent edit,
cache eviction and service restart? Use the existing JobQueue and DerivedCache.
A preview is a disposable artifact, never another export type or timeline store.

Core preview admission pins revision and source-evidence generation, waits on source
processing outside the heavy lane, and creates one canonical job identity. Repeated
requests observe the same job; explicit retry owns failure recovery. Rendering uses
`renderPlan` and `planAudioTracks`, then the existing service `withRenderedMedia`
attempt owner. A missing audio role is explicit; preview never waits for speech.
The renderer callback must complete its cache publication before returning.

A cache reservation is attributable to the recording before any copy begins.
Exclusive copy, actual-byte validation and cache publication precede the queue's
artifact commit. Cancellation before commit leaves no usable result. An interrupted
reservation is removed by existing startup reconciliation; a published but unreferenced
cache file is disposable under normal LRU. A ready job whose cache file is gone
regenerates from the same pinned inputs. No second durable publication table.

Native staging has a different lifetime from published cache content. Before wiring
service startup, prove that abandoned render work has ended before cleaning its
attempt directory. Existing parent-exit monitoring is a termination request, not
proof that every descendant has already exited. An isolated Darwin probe confirms an exclusive directory lock inherited by a
worker remains held after its owner is killed, and can be acquired after the
worker exits. Use that OS lifetime to distinguish live work from reclaimable
staging; reuse the native descriptor-relative workspace cleanup being introduced
by14c1. Prove the actual media-worker and killed-service route before accepting
recovery. Do not delete solely by filename prefix or infer child exit from parent exit.

## Verification and scope

Use real revision/evidence stores, queue and cache. First prove concurrent cut/undo
cannot change the returned movie identity or spans. Then eviction/regeneration,
failed source processing, explicit retry, cancellation during publication, cache
budget failure and reopened catalog/cache. Extend the existing native render lab
with actual retained MP4 bytes; decode the cached output after the attempt is gone.
Keep originals unchanged and generated numerical audio distinct from audition.

[CLI file delivery](../assets/preview-publication/delivery.md) now streams bounded
chunks through the existing transport validator and publishes only a complete file.
Inline image/audio model content retains its existing memory limits.

Only expose the operation through the shared protocol/CLI/MCP registry once the
production renderer includes accepted current-pointer composition. Reuse existing
delivery leases with bounded reads and deletion revocation; app playback holds its
lease for the actual player lifetime. No bare unleased temporary path in a public
result. Native playback and actual adjacent-speech audition remain parent13 gates.

Internal names are delegated. The cache budget and scheduling policy stay with their
existing owners; do not add a preview-specific queue, retry loop or configuration.
