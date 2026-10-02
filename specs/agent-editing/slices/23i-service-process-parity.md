# 23i — App-owned project-service process

Status: source process and public consumers verified; the
[canonical service](../assets/23-canonical-service/README.md) now uses that
composition in the default repository build. Installed switching, continuous
presentation and remaining obsolete-owner deletion stay under [23](23-cutover.md).

## Contract and owner

The fresh project service must run as the app's one child, answer the existing
health/control contract and be reachable through ordinary CLI/MCP discovery.
Its socket and startup lock use the shared protocol runtime directory. Catalog,
media and model storage remain in the fresh library; the retained old catalog
and originals are not opened or migrated.

[The canonical process entry](../../../apps/service/src/main.ts) composes the
existing project-service owner. It introduces no operation registry, media
engine, feature flag, fallback socket or background daemon. The current installed
app remains a separately retained artifact; the default build now reaches this
canonical composition without a second entry or a build flag.

The shared [domain-error mapper](../../../apps/service/src/operation-errors.ts)
has one owner outside the operation router. Service composition and source
admission share it; removing obsolete routers must preserve those error semantics.

## Verification

The [process journey](../../../packages/test-harness/editing/service-process.mjs)
bundles the canonical service entry and actual CLI, then executes them outside the
checkout against private scratch homes. It compares the existing health/control
contract, exercises explicit caller-created project state through control,
CLI and MCP, and preserves single startup ownership, EOF, signal and crash recovery.
Ordinary discovery uses a nonexistent scratch app path: reaching the already
running service cannot require an app launch.

The original [packet](../assets/23i-service-process-parity/README.md) retains complete
exchanges, bundle/source identities, failing regression controls and existing
service/capture lifecycle checks. Only native startup work is scripted. Those
replies establish no hardware, capture, decoder, playback, inference or model
download claim. Existing media/model evidence remains scoped to its own owners.
The [merged checkpoint](../assets/09c-23i-merged/README.md) repeats the actual
process journey after audio-export integration and retains separate affected-suite
deadline failures. It does not turn source readiness into an installed switch.
The [canonical-entry proof](../assets/23-canonical-service/README.md) separately
retains default composition, the shared process guards and merged-tree confirmation.

## Remaining cutover

Remove obsolete recording-editing targets and consumers under the applicable
preservation matrix. Carry capture facts, explicit asset admission and
caller-authored projects through that change; do not construct projects to keep
recording actions enabled. Source-process proofs do not establish continuous
presentation, physical synchronization or installed external-caller acceptance.
Those claims retain their existing owners and do not block isolated implementation.

Delegated: process-entry names and extraction order. The shared runtime authority
is recorded in the choices ledger because the temporary project service had
previously placed its socket inside the library.
