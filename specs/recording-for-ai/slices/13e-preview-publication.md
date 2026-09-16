# 13e — Revision-bound preview publication

Status: internal core job/cache consumer verified with real native movies;
[publication evidence](../assets/preview-publication/README.md) records its scope.
The [render ownership proof](../assets/preview-publication/restart/README.md)
covers abandoned staging and pointer preparation inside the existing attempt.
[Public service delivery](../assets/preview-publication/public.md) is verified with
generated cursor/cut/pause evidence, CLI/MCP parity and restart regeneration.
The [native service/player lifetime](../assets/preview-publication/player.md#actual-bundled-service-integration)
now passes with the actual bundled service. Physical menu interaction, player
visual acceptance and adjacent-speech audition remain open.

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

Native staging has a different lifetime from published cache content. The existing
attempt owner exclusively locks its dedicated private workspace and passes the
same descriptor to native work, including pointer preparation. A replacement
admission fails busy while any orphaned worker retains it; the next successful
admission clears abandoned staging through the shared descriptor-relative cleanup.
No parent-death notification, PID file or filename prefix substitutes for terminal
ownership. The [restart proof](../assets/preview-publication/restart/README.md)
defines the stable-ancestry write precondition, failed-cleanup behavior and actual
killed-owner/native-worker regression. There is no separate startup scanner. The same owner serves render admission and
`clearRenderWorkspace` before startup/deletion admits work; an absent workspace
needs no native process.

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

The shared protocol/CLI/MCP registry now exposes the production renderer with
current-pointer composition. Existing delivery leases own bounded reads and deletion
revocation. App playback retains the same cached bytes for the actual player
lifetime. The existing delivery owner supports [explicit renewal](../assets/preview-publication/renewal.md)
of a live token; expired or revoked tokens cannot be revived. The [native player owner](../assets/preview-publication/player.md) uses its pinned
cache URL only while it owns that lease, renews during playback or pause, and
stops/releases on close, replacement, service loss or renewal failure. Its real
AVPlayer and bundled-service lifetime checks are separate from pending actual-menu
and player-visual inspection.
This avoids another app-owned copy and its deletion/startup cleanup policy. No bare unleased temporary path in a public
result. Player visual acceptance and actual adjacent-speech audition remain parent13 gates.

Internal names are delegated. The cache budget and scheduling policy stay with their
existing owners; do not add a preview-specific queue, retry loop or configuration.
