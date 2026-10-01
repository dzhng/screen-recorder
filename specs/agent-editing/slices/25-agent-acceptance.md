# 25 — External-caller primitive acceptance

Status: whole-workflow acceptance not started. [Focused CLI discovery](../assets/25-cli-discovery/README.md), [shared-reference discovery](../assets/25-discovery-references/README.md), and the [CLI test-ownership audit](../assets/25-cli-test-ownership/README.md) follow per-feature skill trials; it is not the final autonomous journey. Dependencies: [24](./24-scale.md), [09b](./09b-output-settings.md).

## Contract

A fresh external agent completes a bounded fixture brief using the consumer skill
and advertised primitives, without a human editing UI or mandatory draft approval.
The developer prepares the harness/brief; the test agent uses the toolkit as its
external caller. This is not an assignment to edit the user's personal recording.

## Seam and ownership

Independent agent journey through installed CLI and MCP; the production service/core/native stack is the system under test. Use real accepted corpus speech and a verified screen/camera take, plus imported media/music/stills.

The test agent is an external caller using the project, not an embedded product
component. It may make editorial decisions only within the supplied user's brief.
The toolkit supplies primitives and makes zero editorial decisions. Evaluate
whether it exposes useful evidence and faithfully executes that caller's requests;
do not require it to select one supposedly correct editorial treatment.

## Work and review surface

The agent discovers actual capabilities, gets/sets/reorders/bypasses clip/track/group/output stacks, inserts new narration into a processed track, applies optional denoise, replaces/splits media and verifies unchanged originals plus historical undo/package playback. Exceptions use individual clips/separate tracks, never parent-step overrides.

The [prepared fixture brief](../assets/25-fixture-brief/README.md) binds existing
media authorities and technical targets. It is not execution or acceptance;
resolve its source/transcript/runtime gaps before the installed journey.

Freeze a fixture brief identifying source media, requested target ranges/text,
protected content, output settings, references and permitted treatments. Cover
multiple sources, explicit speech cuts, local retiming, insert/overlap, independent
audio/video replacement, music/gain automation, captions/zoom, the verified local
voice capability and editable export. The external caller chooses how to express
the requested work through advertised primitives; the engine makes no editorial
choice. Grade requested effects, preserved content, discovery, delivery and
recovery, not whether one style or phrasing is preferable. Any reversible
presentation discretion must be stated in the brief.

Reuse accepted media identities and per-feature listening evidence. Do not rerun
every audition or regenerate/tune an accepted ambience asset for this fixture.
Changed integrated output requires only the relevant new verification; unchanged
numerical parity does not manufacture a new listening or physical verdict.

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

Delegated: External test-agent editorial choices within the supplied user's brief,
and reversible test presentation choices. None of this delegates editorial
authority to the product or turns development into editing the user's recording.
Engine guarantees, required features and verification truthfulness are fixed.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.


Carry the [selected19 ambience recipe and listening disposition](../assets/19-acceptance/README.md)
into the integrated pause workflow: preserve source provenance, explicit gain and
transitions, and the user-tolerated slight residual seam. Do not silently retune
the selected loop or transfer its verdict to arbitrary new sources.
