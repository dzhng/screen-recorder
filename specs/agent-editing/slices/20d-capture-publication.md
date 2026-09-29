# 20d — Canonical capture publication and recovery rollout

Status: planned. Dependencies: [20c](20c-sparse-capture-materialization.md).

## Contract and owner

Wire the shared materializer into the existing capture finalization and recovery
lifecycle before enabling packed audio writes. Only independently verified canonical
source-time files reach source adoption, AssetStore, project initialization or public
inspection. Packed staging is unpublished working data; discovery must never mistake
its file timestamps for source placement. Other valid roles remain recoverable if one
role cannot be canonically published. Keep existing interruption/cancellation and
late-callback generation boundaries authoritative.

The persistent journal discriminant separates new packed layout from existing takes.
Old source bytes remain immutable. Existing canonical/continuous takes keep their
behavior; an old discontinuous packed take must not claim later acquisition verified
from rounded journal support alone. Preserve its bytes and expose only independently
established support, or explicitly refuse the ambiguous role. Do not invent exact
addresses or migrate old media automatically. This preserves real files, not a
compatibility path for unshipped intermediate implementations.

## Publication and cleanup

Publish from a validated temporary canonical candidate through the existing take
owner. Pin the exact payload/journal prefix and verified canonical identity so a
restart cannot finish a different attempt. Define and test actual durable publication
ordering, including directory/file synchronization where required. A completion
receipt alone is not proof that media bytes or placement are correct.

Packed staging may be cleaned only after independent canonical PCM/segment verification,
durable publication and restart-safe ownership handoff. Do not retain an indefinite
second original by default, and do not delete the sole recoverable payload on a
failed/uncertain attempt. Original user imports and older source assets retain their
existing immutable retention contract. Reuse existing inventory/package/deletion
ownership; new filenames must not evade accounting. Cleanup is idempotent and
interruptible, including a restart between canonical publication and staging removal.

## Acceptance and review surface

Through actual prerecorded CaptureWriter callbacks and normal service finalization,
prove continuous preservation plus omitted/pause-run original sample positions for
narration and system audio. Normal and recovered sources must agree for the same
committed prefix. Exercise repeated finish, cancellation, missing requested role,
independently valid video, journal failure and restart at every publication boundary:
export in progress, after verification, after rename, after receipt, during diagnostics
and before/after staging cleanup. Corrupt or mismatched candidates never permit deletion
of recoverable input. Partial results carry truthful failure/support rather than
pretending the entire take passed.

Run public source get/list, audio evidence/read, asset adoption and project placement
on the canonical files; cover restart, history/package dependency closure and take
retirement so publication does not strand bytes or relabel staging as an asset.
Preserve capture/recovery, cursor/geometry, source-audio and capture-to-project tests.
Use delivered samples and exact support, not state-only receipts. Retain a bounded
failure/recovery artifact with source and worker hashes and independent review.

Only after these gates enable the new writer layout, replacing transitional test
wiring in the same rollout. Close 20a's PCM delivery prerequisite from actual-owner
results; keep the [physical 20](20-camera-reproduction.md) ten-minute drift and
interruption gates and [21](21-webcam.md) public webcam integration gates open.
No live capture, prompts, installation or permissions are authorized by this plan.

Delegated: internal publication helper names and reversible diagnostic presentation.
Durability/cleanup evidence, canonical-only admission and old-source truth are fixed.
