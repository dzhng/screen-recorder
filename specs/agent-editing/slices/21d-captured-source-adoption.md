# 21d — Durable adoption of independent captured sources

Status: implemented through current-source native and fresh-service admission,
retry and portable relocation; [evidence](../assets/21d-captured-source-adoption/README.md).
Dependencies: [21b](21b-camera-source-publication.md), [10b](10b-source-acquisition.md) and [20d](20d-capture-publication.md).
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

Reuse current source evidence/retry and portable-resource ownership. This is
proof-bearing admission through the fresh service's existing `acquisition.import`
path, not its capture-lifecycle port, an installed switch or old-history migration.
Project authoring belongs to 21e; selected input can proceed independently in 21c.

CameraMedia remains the only accepted-picture/support/digest verifier. Extend that
owner for published canonical descriptors, then thread its verified video proof
through SourceEvidenceExport, SourceExporter/receipt validation, source admission,
acquisition binding and portable inventory. Retain an independently addressable
camera receipt/mapping set inside the admitted source; never follow an implicit
external observation path. Camera proof does not inherit the packed-audio journal
layout restriction. A declared production camera cannot fall back to unverified
video when proof is missing. Ordinary file import still reports physical support.

Carry a supplied take/source/device binding into the native camera journal/result
without inventing another clock. Verify that binding separately from service
allocation. Historical retained probe journals remain historical, unallocated
evidence; do not rewrite them to manufacture production provenance. The later
21f/23 capture port must reuse the surviving allocation/lifecycle owner without
instantiating the obsolete span-revision store in the fresh service.

The camera receipt retains exact rational support and the digest's original native
timescale, together with a same-byte local mapping snapshot. Its journal prefix
binds header identity, shared origin and pause facts; later terminal appends are
allowed, so their state/duration payload is not attested by that prefix. Admission
separately inventories the complete journal. Historical unbound proof lacking its
native scale requires the actual original raw authority; raw-less portability is
refused rather than guessing the canonical timescale or rewriting the receipt.

The surviving proof, import and portable owners are ready for caller-authored
[21e](21e-capture-project-adoption.md) integration. Public camera-start acceptance
still requires [21f](21f-public-camera-selection.md)'s fresh lifecycle/allocation
work and does not follow from supplied bindings in these fixtures.

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
