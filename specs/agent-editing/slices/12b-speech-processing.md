# 12b — Adopt verified source speech processing

Status: not started. Dependencies: [10](./10-project-evidence.md), [11](./11-audio-inspection.md), [12](./12-speech-evidence.md).

## Contract

Production source processing reproduces the accepted speech/evidence recipe, including any justified ASR/alignment change.

## Seam and ownership

Existing asset-scoped speech processing worker and model-preparation owner; adopt the exact frozen slice 12 configuration. Preserve raw engine outputs alongside derived aligned boundaries and their provenance. No parallel transcript owner or silently edited source text.

## Work and review surface

If the current pipeline wins, establish public-entry parity and leave it intact. If an alternative wins, replace the source processing mechanism at its existing ownership boundary and remove the obsolete production path. Reads report the new generation/policy and stale cursors fail rather than mix outputs.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/speech-parity.mjs --reference specs/agent-editing/assets/12-speech-reproduction
```

## Acceptance

Add the scenarios assigned here in the [live journey inventory](../journeys.md)
through actual public CLI/MCP and service paths. State-only checks do not replace
delivered-media or listening/physical gates.

Compare complete computed requests, transcript tokens/kinds, timings, generation behavior and target cleanup outcome to the frozen reproduction. Run through asset/project public reads and an explicit edit batch. Check model absent/preparing/failed/ready states, restart and no download during ordinary inspection.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Failure boundary and discretion

If production differs from the frozen evidence, fix the integration before repeating expensive quality evaluation. A changed model, quantization or alignment policy is a new measured trial.

Delegated: Worker packaging and private implementation layout; not the accepted recipe, raw-evidence preservation or agent creative policy.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.

