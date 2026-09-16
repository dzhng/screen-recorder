# Recording-owned byte deliveries

A live delivery lease names its recording. `DerivativeDelivery.revoke(recordingId)`
closes every matching handle through the same release path as explicit close and
expiry, leaving other recordings readable. All five frame/audio/index delivery
routes supply their already validated recording ID. The delivery owner remains
independent of cache versus retained-file storage.

Revocation does not maintain a second deletion registry. The catalog intent and
public operation admission will prevent new leases when the delete coordinator is
wired; this prerequisite alone does not expose deletion or promise lasting refusal.

## Proof

A real-file test opens two leases for one recording and a third for another. After
repeated target/missing-ID revocations, both target tokens expire and their cache
file can be removed. The other token still returns its original bytes and keeps
its backing file pinned until explicitly closed. The test failed before revocation
was implemented, while the nine prior delivery tests remained green.

All ten delivery tests, all sixty service tests, service build and type checks,
lint and diff checks pass. Independent Codex review found no actionable regression;
its wider socket tests hit sandbox EPERM, while the host service suite completed.
Native delivery reruns wait until the ongoing scale benchmark finishes.

Shape review: one owner field and one bounded traversal of the existing lease map;
no table, endpoint, background worker, secondary registry or new cleanup path.
