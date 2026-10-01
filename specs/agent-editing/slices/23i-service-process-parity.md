# 23i — App-owned project-service process

Status: source candidate verified through bundled child processes and public
consumers. Installed switching, presentation and obsolete-owner deletion remain
under [23](23-cutover.md).

## Contract and owner

The fresh project service must run as the app's one child, answer the existing
health/control contract and be reachable through ordinary CLI/MCP discovery.
Its socket and startup lock use the shared protocol runtime directory. Catalog,
media and model storage remain in the fresh library; the retained old catalog
and originals are not opened or migrated.

[The process entry](../../../apps/service/src/project-main.ts) composes the
existing project-service owner. It introduces no operation registry, media
engine, feature flag, fallback socket or background daemon. The current installed
composition and default app bundler remain intact until the explicit hard cutover.
At cutover the project entry replaces that installed entry; it is not a second
production engine to retain.

The shared [domain-error mapper](../../../apps/service/src/operation-errors.ts)
has one owner outside either operation router. Both entries and source admission
import it directly; removing the old router will not remove error semantics from
the project path. The installed main changes only that import.

## Verification

The [process journey](../../../packages/test-harness/editing/service-process.mjs)
bundles both source entries and the actual CLI, then executes them outside the
checkout against private scratch homes. It compares the existing health/control
contract, exercises explicit caller-created project state through control,
CLI and MCP, and preserves single startup ownership, EOF, signal and crash recovery.
Ordinary discovery uses a nonexistent scratch app path: reaching the already
running service cannot require an app launch.

The [packet](../assets/23i-service-process-parity/README.md) retains complete
exchanges, bundle/source identities, failing regression controls and existing
service/capture lifecycle checks. Only native startup work is scripted. Those
replies establish no hardware, capture, decoder, playback, inference or model
download claim. Existing media/model evidence remains scoped to its own owners.
The [merged checkpoint](../assets/09c-23i-merged/README.md) repeats the actual
process journey after audio-export integration and retains separate affected-suite
deadline failures. It does not turn source readiness into an installed switch.

## Remaining cutover

Switch the source app bundler and remove the old installed composition only after
the applicable preservation matrix is complete. Carry current capture facts,
explicit asset admission and caller-authored projects through that change; do not
construct projects to keep recording actions enabled. Concrete native presentation,
physical synchronization, the completed-stop budget and installed external-caller
acceptance remain unverified here. An open release claim does not prevent this
isolated process preparation.

Delegated: process-entry names and extraction order. The shared runtime authority
is recorded in the choices ledger because the temporary project service had
previously placed its socket inside the library.
