# 21d — Durable adoption of independent captured sources

Status: planned isolated implementation. Dependencies: [21b](21b-camera-source-publication.md), [10b](10b-source-acquisition.md) and [20d](20d-capture-publication.md).
Physical acceptance remains under [20](20-camera-reproduction.md) and parent [21](21-webcam.md).

## Contract

Every verified captured source can be admitted with immutable bytes, durable
source identity and exact common-clock provenance; retry/recovery does not drop
camera media or create another acquisition.

## Seam and ownership

Extend existing acquisition/import, asset admission and native recovery owners.
A camera remains a separate video acquisition with its own journal and proof,
related to the allocated take and shared capture clock. Do not scatter a fourth
media-role meaning across source/asset consumers or add a camera-specific catalog.
Bind allocation, directory, publication proof and admitted identity; preserve
accepted raw timing and represented support rather than reconstructing cadence.

Reuse current source evidence/retry and portable-resource ownership. This is an
isolated service port, not an installed switch or old-history migration. Project
construction belongs to 21e; selected input can proceed independently in 21c.

## Work and review surface

Use 21b outcomes and the retained four-minute originals/journals through actual
admission/recovery owners. Verify source hashes, exact offsets/support, missing or
changed proof, identity conflicts, partial availability, publication/admission
retry, lost response/restart and dependency retention through portable packaging.
A wrong origin, omitted camera member or duplicate admission must fail. Preserve
all admitted source bytes and exact source-to-asset mappings.

## Acceptance

Keep the relevant [preservation gates](../verification.md#preservation-matrix) and
[single-owner rules](../architecture.md) green. Record the bounded fixture result,
source/runtime identities, failures and limitations under this child’s assets and
in the parent handoff. Prepared wiring, actual media parity and physical acceptance
are distinct verdicts. The one-frame synchronization and ten-second completed-stop
gates remain unchanged. No new capture, audible playback or installed switch.

## Failure boundary and discretion

Delegated: internal names, compact typed result structure and fixture organization
within the existing owners. No editorial policy, second lifecycle/catalog, silent
fallback, weakened preservation gate or fabricated physical verdict. A failure
reslices its actual owner rather than broadening into unrelated work.

User feedback changing the named contract requires updating this child and its
dependents before expansion. Existing accepted auditions and the selected 200 ms
room-tone recipe retain their exact-media scope and are not repeated here.
