# 14a — Pinned package manifest and truthful readiness

Status: internal snapshot/readiness and structural metadata validation implemented.
[Evidence and scope](../assets/package-manifest/README.md). No public export, ZIP,
actual inventory hash verification or evidence-payload acceptance is claimed.
Narrated manifests are rejected until 08 supplies its accepted payload owner.
Next: [14b](14b-portable-inspection.md), retaining the later gates in [14](14-exports-and-package-reader.md).

## One question and seam

Can a candidate describe exactly one immutable export snapshot and distinguish
complete evidence from work that is waiting, failed or legitimately absent?

Add a cohesive core package-manifest module. Its schema/validator and prerequisite
planner consume values from existing owners; they do not read arbitrary paths,
submit jobs, decode media or open a RevisionStore. Keep adapters for catalog snapshot
capture beside their current owner. Proposed seam names are delegated:

- `pinPackageSnapshot(recordingId, revisionId?)`: one catalog transaction resolves
  the chosen immutable revision, source/capture identity and history high-water
  ordinal. It returns a small header and bounded history-page cursor, not all rows.
- `planPackage(snapshot, prerequisites)`: returns `waiting` with dependency identities,
  `blocked` with required-artifact errors, or a publishable plan with exact ready
  generations and explicit allowed absences. It does not hold a worker slot.
- `validateManifest(json, revisionContents, limits)`: validates the complete portable manifest and
  references against supplied inventories. No pending candidate is mislabeled as a
  complete manifest; an incomplete diagnostic report is never an export product.

The production transcript owner does not exist yet. Define the artifact readiness
and provenance envelope now; accept future transcript payloads only through 08's
accepted validator. Generated readiness fixtures test control semantics, never speech
fidelity. Unknown payload/schema versions fail explicitly, without a compatibility shim.

## Frozen data semantics

The sole shipped manifest format is schema version 1 under the existing hard-cutover
policy. Before any public shipment, schemas may be sharpened together with their
fixtures; no dual-reader migration layer is authorized.

The header names recording/source identity, pinned export revision, validated source
duration, recording completion/interruption status and capture metadata. It records
history's admission-time upper ordinal independently of the pinned revision ordinal:
exporting an old revision still includes history known when export was requested.
Later edits never enter that snapshot. Revision manifests retain their existing
IDs, parent links, ordinals, spans and operations. Request-replay/idempotency rows,
undo-stack internals and job tables are not edit history.

Inventory entries name a unique relative path, byte length, SHA-256, content/track
role and applicable duration. Root directories remain `source/`, `revisions/` and
`evidence/`; `manifest.json` is the sole manifest, not a self-hashed member. Every
referenced file is inventoried once. Canonical relative paths have no empty, dot,
parent, absolute, drive, backslash or link interpretation. Names cannot collide
under normalization or case-insensitive extraction. Validate required singleton
roles and ID/reference consistency; recording IDs never become unchecked paths.

Retain original video, acquired separate audio roles and raw capture journal, plus
ordinary normalized source observations, scene evidence with policy/options,
retained index entries/coverage/images, and revision history. Transcript descriptors
separately identify raw source and pinned playback projection; timeline descriptors
state their time domain. Existing timeline functions own all projection.

Do not serialize absolute `SourceEvidenceReceipt.file/journal`, native frame `file`,
disposable cache IDs or opaque job input JSON into a package. Portable serializers
replace known file references with inventory references and preserve substantive
metadata. No recursive search-and-replace of the library root. Model weights,
runtimes, credentials and a library SQLite copy are forbidden members.

## Prerequisite truth table

| Required evidence | Planner result |
| --- | --- |
| Missing/not requested or queued/running | Waiting with stable dependency identity/available job ID; no worker reservation |
| Failed or unavailable for a reason other than allowed absence | Blocked with owner error/retry guidance; no complete manifest |
| Published for another source/revision/generation than the pinned requirement | Reject mismatch; never silently use latest |
| Narration genuinely not requested or not acquired | Explicit `unavailable:no_narration` for transcript; no fabricated words |
| Narration acquired, recognizer returned zero words successfully | Ready transcript with normal provenance, not no-narration |
| Every required artifact ready, with permitted narration absence if applicable | Publishable plan with pinned generations |

Unknown acquisition first waits on source evidence; known failures of other required
artifacts remain visible. No-narration comes from capture/acquisition evidence, not from missing model assets,
failed recognition, silence guessed by exporter, or an empty transcript array.
All selected evidence and references must stay tied to the chosen source and edit.
Optional absent audio roles remain explicit rather than becoming fabricated tracks.

## Verification and review surface

Create an internal JSON fixture harness, not a public `package.open` route. Build
revisions through the actual timeline owner; pin an old revision, append a concurrent
edit, page history and prove the captured bound is stable. Reject malformed spans or
parent references through shared revision validation, not a package-only edit algebra.
Exercise every readiness row, wrong generations, corrupted inventory references,
forbidden paths/members and supported/unsupported schema cases. Test just-over-limit
manifests/inventories and bounded history paging; do not load a whole library.

The module must require finite manifest/entry/history/path limits. Numeric policy
values, serializer names and file paging layout are delegated and recorded by the
implementation; completeness, identity, path semantics and dependency states are not.
Keep library/timeline, source/scene/index and queue tests green. Run local review and
independent code review before commit. This pass produces machine-readable examples,
not visual artifacts. It does not prove ZIP containment, export lifetime, recognized
speech or relocated native inspection; those remain later gates.
