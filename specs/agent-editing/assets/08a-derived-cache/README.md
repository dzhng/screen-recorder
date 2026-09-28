# Shared derived-cache owner checkpoint

The existing cache now takes a shared Catalog and an explicit owner-availability
policy. Reservations, usage and purge retain owner kind/ID using the same identity
functions as jobs. Recording consumers use their existing domain policy; project
and asset consumers can provide theirs without another cache implementation.

The [owner tests](../../../../packages/core/src/cache-owners.test.ts) use a real
project store and asset admission. They verify deletion fencing of reservations,
late publication and new reads, held-reader purge refusal, same-ID cross-kind
isolation, asset-owned eviction/reopen and unchanged original bytes. The initial
[red run](missing-owner-red.txt) precedes the API. Deliberately omitting owner kind
from purge makes the sibling owner's retained file disappear; the
[regression fails](cross-owner-red.txt), then restored behavior passes.

A focused 92-test core run passes; [30 service checks](service.txt), core/service
type checks and builds pass. Independent Codex review found no actionable issue
in ownership, lifecycle preservation, caller conversion or catalog refusal.
The catalog format advances explicitly; older files are refused unchanged.
No migration, installed-app launch or user-library mutation occurred.

Broad verification is **not green**. The [four-worker run](core-concurrent.txt)
passes 383/389 tests with six deadline failures and a cancellation rejection after
one timeout. The [single-worker run](core-serial.txt) passes 385/389, with four
deadline failures in processing backfill/cleanup, large project-history setup and
storage inventory. No assertion tolerance or timeout was relaxed. Heavy host work
was observed, but that does not by itself prove the cause. The storage deadline
already has an inherited open gate in slice 24. Keep these failures visible and
revalidate before closing this prerequisite; this checkpoint does not claim full
regression acceptance or a public preview route.

Original assets and retained generated media remain outside this evictable cache.
When 09 publishes project derivatives, its deletion coordinator must drain readers
and purge their cache ownership before retiring project history.
