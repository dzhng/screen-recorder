# 25 — Autonomous agent acceptance

Status: whole-workflow acceptance not started. [Focused CLI discovery](../assets/25-cli-discovery/README.md) follows per-feature skill trials; it is not the final autonomous journey. Dependencies: [24](./24-scale.md), [09b](./09b-output-settings.md).

## Contract

A fresh external agent completes the user's tutorial workflow using only the product skill and advertised tools, without a human editing UI or mandatory draft approval.

## Seam and ownership

Independent agent journey through installed CLI and MCP; the production service/core/native stack is the system under test. Use real accepted corpus speech and a verified screen/camera take, plus imported media/music/stills.

## Work and review surface

The agent discovers actual capabilities, gets/sets/reorders/bypasses clip/track/group/output stacks, inserts new narration into a processed track, applies optional denoise, replaces/splits media and verifies unchanged originals plus historical undo/package playback. Exceptions use individual clips/separate tracks, never parent-step overrides.

Have the agent assemble multiple takes, remove named mistakes/ums/repetitions, slow rushed speech, insert and overlay footage, replace audio and video independently, add music/gain automation, captions and animated zoom, generate a wording correction from an explicitly chosen local reference, and export any requested canvas plus an editable package. Let the agent choose visual cover if any.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/acceptance.mjs --case tutorial --transport both
```

## Acceptance

Add the scenarios assigned here in the [live journey inventory](../journeys.md)
through actual public CLI/MCP and service paths. State-only checks do not replace
delivered-media or listening/physical gates.

Have the agent discover encoder settings, override a preset, and verify the resolved
settings and delivered streams. Verify the normalized edit result, protected words, accepted audio-quality gates, visual composition, requested text/captions, output geometry and package relocation/undo. The agent discovers schemas, handles a forced stale edit and a lost response, exports autonomously, and reports changes/provenance/verification limits. Run broad repository/native gates once at closeout and record independent review findings.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **whole-workflow composition**, using full output frames and temporal contact sheet; use the previously accepted per-slice references and inspect integrated interactions. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

No masked missing capability: imported replacement audio is not a pass for local synthesis; prerecorded presenter footage is not a pass for webcam capture; waveform inspection is not a claim of hearing. Report incomplete gates while preserving useful outputs and fix the owning slice.

Delegated: Agent editorial choices within the user's brief, and reversible presentation choices. Engine guarantees, required features and truthfulness about verification are fixed.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.

