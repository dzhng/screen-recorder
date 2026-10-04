# Screen Recorder

A local macOS recorder and media toolkit for external AI agents. The app, CLI
and MCP expose the same recording, inspection and non-destructive editing contracts.

## Product boundary

**This project makes zero editorial decisions. It only provides primitives.**
Recording, transcription, search and detection supply evidence. The caller decides
what to change and submits explicit operations. Defaults fill parameters within a
requested operation; they never authorize another treatment or an automatic edit.
Original media remains intact.

Development verifies those primitives with explicit fixture operations. A user's
recording is reusable test input, not an invitation to edit it or ask its owner
for personal keep/remove judgments.

## Releases

Download the app from [GitHub Releases](https://github.com/dzhng/screen-recorder/releases).
The [installation guide](scripts/release-notes.md) owns supported systems, bundled
runtime, signing status and CLI/MCP setup. Built binaries are release assets;
source control retains their reproducible inputs rather than generated app bundles.

Version tags trigger a verified GitHub release. The [build and release guide](scripts/README.md)
explains version ownership, CI hooks and personal source installs.

## Where things belong

- [Native app](apps/macos/README.md): recording controls and the service child's lifetime.
- [Service](apps/service/README.md): composition of domain owners, native work and public delivery.
- [CLI/MCP](apps/cli/README.md): adapters over the [shared protocol](packages/protocol/README.md)
  and [local client](packages/client/README.md).
- [Core](packages/core/README.md): immutable assets, acquisitions, revisions, jobs and publication.
- [Composition](packages/composition/README.md): pure authoring, exact clocks and compiled plans.
- [Native media](helpers/mac/README.md): capture, physical sample support and plan execution.
  The [prepared voice worker](helpers/voice/README.md) executes the separately owned
  local inference runtime.

The consumer [screenrec skill](skills/screenrec/SKILL.md) teaches external agents
how to use the toolkit. Repository development skills live separately under
.agents/skills; they are not a product operation catalog.

## Development and evidence

Follow [the working principles](AGENTS.md). The [root manifest](package.json)
owns build and check commands; package manifests own narrower checks and dependencies.
The [build guide](scripts/README.md) explains native prerequisites and why building,
installing and packaging are separate actions.

[Verification tools](packages/test-harness/README.md) explain how to reuse existing
fixtures, integration journeys and research. The [fixture guide](fixtures/README.md)
explains retained media and original-byte authority; the [workbench](apps/workbench/README.md)
is a capture target, not an editing interface.

[Specs and evidence](specs/README.md) separate future proposals, closed rationale
and historical observations. Current behavior comes from the owning code and
its README. A historical pass is scoped evidence, and an unchecked old plan is
not an active implementation request.
