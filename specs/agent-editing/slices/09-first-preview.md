# 09 — First public preview and export

Status: lifecycle prerequisite integrated: [shared-cache retirement](../assets/09-cache-retirement/README.md). Public rendering remains unimplemented. Dependencies: [04](./04-projects.md), [07](./07-video-execution.md), [08](./08-audio-mixing.md), [08a](./08a-derived-cache.md).

## Contract

The first public checkpoint creates a two-clip project, replaces audio or video independently, undoes, previews and exports through CLI/MCP.

## Seam and ownership

Existing job/publication owners admit project-targeted preview.get/retry, frame/audio inspection and export.create/status/list/retry/recover/cancel/abandon. One compiler and executor combine slices 07/08. Exports retain existing revision-pinned intent, exportId replay and atomic publication guarantees.

## Work and review surface

Deliver a reproducible CLI/MCP journey using the shared registry. Preview ranges preserve project phase; exports use the declared profile. Requests expose readiness/errors and pinned revision. Update skills/screenrec only for operations now available. The optional terminal/open-file viewer is not an editing GUI.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/first-preview.mjs --transport both
```

## Acceptance

Add the scenarios assigned here in the [live journey inventory](../journeys.md)
through actual public CLI/MCP and service paths. State-only checks do not replace
delivered-media or listening/physical gates.

Two imported clips, A–B–A, video replacement preserving A audio, audio replacement preserving B frames, undo, old-revision preview during new edits and successful local export. Compare production decoded frames/audio to frozen expectations. Crash/cancel a render/publication and verify no partial published artifact.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Visual acceptance

Judge **audio/video replacement membership**, using full frame-counter contact sheet; style, captions and animated transforms are out of scope. Use [compare-screenshots](../../../.agents/skills/compare-screenshots/SKILL.md) against the named fixture/reproduction or prior accepted shot. Run an unprimed [screenshot-critique](../../../.agents/skills/screenshot-critique/SKILL.md) as the **last visual check before accepting this slice**. Preserve shots and verdicts under this slice's assets folder.

For human review use [preview-shots](../../../.agents/skills/preview-shots/SKILL.md), allow about five minutes while progressing independent work, then decide from evidence and close the shots if there is no response. Missing listening/capture evidence remains unverified; silence is not a pass.

## Failure boundary and discretion

If this milestone needs unfinished captions, keyframes or voice models, the layering is wrong. Keep it to the verified basic composition and continue independent later slices.

Delegated: Report layout and internal wiring to existing job APIs. No alternate preview engine or custom CLI parsing.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.
