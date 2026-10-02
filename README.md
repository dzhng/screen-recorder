# Screen Recorder

A local macOS recorder that gives external AI agents inspectable narration, images,
pointing history and non-destructive edits. Source media remains intact; the app,
CLI and MCP share the same recording and editing contracts.

## Product boundary

**This project makes zero editorial decisions. It only provides primitives.**
It supplies recording, transcription, timing, search and media-inspection
evidence, plus precise, non-destructive operations for editing, processing,
preview and export. The external agent using the project interprets the user's
intent, makes every editorial decision and calls those operations.

For filler and repetition removal, the toolkit exposes recognized words,
candidate classifications, timestamps and surrounding media. The caller decides
which occurrences to remove and submits explicit cuts. A repeated phrase is
evidence, not a decision that it is accidental. The toolkit does not silently
choose removals, pacing, fades, noise reduction, ambience, replacement speech or
layouts. Deterministic execution, validation and documented parameter defaults
implement the caller's request; they do not authorize additional edits.

Development verifies evidence accuracy and execution of explicit fixture edits.
Using real media as a test fixture does not make editing that recording a product
deliverable or require its owner to supply personal keep/remove judgments.
The [editorial-control contract](specs/agent-editing/architecture.md#editorial-control)
defines this boundary for implementation and verification.
The [bounded implementation trace](specs/agent-editing/assets/acceptance-maintenance/editorial-boundary-audit.md)
records the managed speech-to-edit ownership and the separate retained recording
policy; source inspection supplies no speech-quality or runtime verdict.

## Components

- [Menu-bar app](apps/macos/README.md): owns the service child's lifetime and native controls.
- [Local service](apps/service/README.md): the socket listener and app-owned process lifetime.
- [CLI and MCP adapters](apps/cli/README.md): the same service operations for command-line and MCP clients.
- [Native capture and media](helpers/mac/README.md): capture, recovery, cursor geometry and media workers.

- [Composition and edits](packages/composition/README.md): owns pure timing, clip identity and atomic edit meaning.

## Development

Bun installs and orchestrates; Node 24 runs TypeScript and Swift builds the native
macOS boundary. Run `bun install` before building. The [root manifest](package.json)
owns executable build and check commands. Use focused package checks for
everyday work, including commits and merges; full release verification belongs
at the milestones a plan names and when a spec is closed.

The [agent editing spec](specs/agent-editing/README.md) owns the active expansion
plan and next pickup. The [recording spec](specs/recording-for-ai/README.md) retains
current implementation evidence and unfinished personal-release acceptance.
Planned capabilities are not claimed as implemented until their named gates pass.

The product-use [screenrec skill](skills/screenrec/SKILL.md) teaches external
agents the available CLI workflow; repository development skills live separately
under `.agents/skills`.
