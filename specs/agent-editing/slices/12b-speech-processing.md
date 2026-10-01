# 12b — Adopt verified source speech processing

Status: [controlled public parity](../assets/12b-public-parity/README.md) passes
raw ingestion, queries, explicit cuts/protected PCM/undo, restart and generation
fencing. Actual-model/current-decoder parity remains unverified; recorded prepared
model directories are absent. This is independent of unfinished alternate-model
research. Implementation dependencies: [10](10-project-evidence.md),
[11](11-audio-inspection.md) and the
[selected baseline](../../recording-for-ai/slices/04-local-speech-gate.md).
Any replacement recipe additionally depends on [12](12-speech-evidence.md).

## Contract

Production source processing preserves the selected baseline's speech-evidence
behavior and provenance. A justified ASR/alignment change is a separate adoption
decision, not mandatory work in this pass. This is recognition, timing and
provenance only. The external caller selects removals and submits explicit edits;
no editorial cleanup policy is part of the recipe.

## Seam and ownership

Use the existing asset-scoped transcript, model, job and evidence-generation
owners. Bind parity to the selected baseline's retained inputs/output/configuration.
If alignment is later adopted, retain raw recognized text/timing and identify
externally supplied text, model/runtime/settings and derived boundaries separately
within that same generation owner. Never rewrite raw text to match the caller's
correction, create a parallel transcript store or persist an editorial cleanup plan.

## Work and review surface

First establish public-entry parity for the already selected current pipeline.
Compare complete requests, normalization/projection, token kinds, clock conversion,
generation/readiness/restart behavior and explicit fixture edit/delivery/undo.
Controlled frozen responses may isolate integration from model quality; label
that scope, and reuse retained actual execution evidence rather than rerunning
accepted auditions. Preserve the baseline's known omissions and timing limits.
Controlled-response checks alone cannot close actual-model public-entry parity;
the retained real execution, request and provenance identities must also match
the current adopted path, or that part stays unverified.

Only if a replacement is justified by 12, replace the mechanism at this ownership
boundary and remove the obsolete path. Changed timing affects source/project
paging and search, transcript-seeded captions, packages/history and cached reads;
verify all affected consumers. New generations/policies fence stale cursors while
retained old evidence remains inspectable. Preparation does not approve adoption.

The controlled probe is implemented; its declared-readiness scope does not close
actual native inference parity:

```sh
SCREENREC_NATIVE=/absolute/isolated/screenrec-native node packages/test-harness/editing/speech-parity.mjs --reference specs/agent-editing/assets/12-speech
```

## Acceptance

Add the scenarios assigned here in the [live journey inventory](../journeys.md)
through actual public CLI/MCP and service paths. State-only checks do not replace
delivered-media or listening/physical gates.

Compare complete computed requests, transcript tokens/kinds, timings and
generation behavior to the frozen reproduction. Run through asset/project public
reads and a fixture-specified explicit edit batch; compare its delivered output,
protected media and undo. Check model absent/preparing/failed/ready states,
restart and no download during ordinary inspection. The product must execute
the supplied edit, not decide whether a repeated phrase should be removed.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Failure boundary and discretion

If production differs from the frozen evidence, fix the integration before repeating expensive quality evaluation. A changed model, quantization or alignment policy is a new measured trial.

Delegated: Worker packaging and private implementation layout; not the accepted recipe, raw-evidence preservation or agent creative policy.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.
