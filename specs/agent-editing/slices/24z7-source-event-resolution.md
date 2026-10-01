# 24z7 — Read-only source-event metadata resolution

Status: implemented in an isolated worktree with [functional and work-accounting evidence](../assets/24z7-source-event-resolution/README.md); root integration remains separate. The source-cardinality p95 and general scale budgets remain open under [24z](24z-source-cardinality.md).

## Contract and owner

One synchronous, read-only scene-enabled source-event dependency phase reconstructs each shared asset once and reads each acquisition identity once. Capture and scene owners use those same selection lookups in source order. A later source failure cannot replace an earlier scene failure. No lookup survives checkpoint publication or another request.

[Source selection](../../../packages/core/src/source-selection.ts) owns phase-local metadata and clock support. It consolidates the capture batch introduced by [24z1](24z1-source-metadata-resolution.md), with complete physical segment reconstruction and unchanged acquisition bindings. [Source events](../../../packages/core/src/source-events.ts) creates the shared lookup only for read-only scene-enabled batches. Preparation remains per-source validation followed by admission; its side effects are never moved behind a whole-batch preflight.

Read-only scene resolution needs origin, support and generation facts, not a renderable filename. Its incidental pathname/header lookup is omitted; that lookup supplied no physical-file authority. Actual processing retains the existing file-addressed selection. Clock-support construction has one shared owner for both forms.

## Verification and limits

The packet retains an actual project-evidence continuation against an isolated SQLite catalog, a complete authored pause/cut oracle, unchanged dependency/coverage replies and red/green metadata-read counts. Fresh-after-publication refusal, first-error precedence and preparation order each have a deliberate failing control followed by restoration. The full unchanged project-evidence suite and focused capture/scene consumers pass. Build and type checks use the existing offline toolchain.

This establishes the bounded owner correction, not public transport delivery or a latency pass. No original timing cohort, service, real capture, media worker, model preparation/inference, listening check, installed switch, frozen runtime or budget change is part of this proof. Root owns the shared pickup and integration record.

Internal lookup/helper names and bounded observer organization were implementation discretion. The packet's [choices](../assets/24z7-source-event-resolution/choices.md) disclose the load-bearing decisions.
