# Screen Recorder

A local macOS recorder and media toolkit for AI agents. Use the **screenrec skill
and CLI** to install, record, inspect, edit and export. The native app runs the
local service; CLI replies and operation help are JSON. MCP is an optional adapter
over the same contracts.

## Agent setup

Requires **Apple Silicon and macOS 26 or newer**. Linux containers can exercise
portable CLI contracts, but cannot run the native app or capture macOS media.

### 1. Install the screenrec skill

Copy the entire [consumer skill folder](skills/screenrec), including its references,
into your agent's skill directory. Do not install this repository's `.agents/skills`:
those are development procedures, not the product skill.

| Agent | Personal skill directory | Invoke |
| --- | --- | --- |
| Codex CLI | `~/.agents/skills/screenrec/` | `$screenrec` |
| Claude Code | `~/.claude/skills/screenrec/` | `/screenrec` |

From a checkout, copy `skills/screenrec` to the selected directory. Without a
checkout, fetch only the skill using Git's sparse checkout. This download method
requires an already usable Git installation. If it is unavailable, use the agent's
repository skill installer or the GitHub contents API for `skills/screenrec`,
following subdirectories and downloading each file. Do not install Xcode or
Command Line Tools solely to fetch the skill. Git and developer tools are not
required to run the released app or CLI.

```sh
screenrec_skill_source=$(mktemp -d)
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/dzhng/screen-recorder.git "$screenrec_skill_source/repo"
git -C "$screenrec_skill_source/repo" sparse-checkout set skills/screenrec
# For Claude Code, use "$HOME/.claude/skills" instead.
screenrec_skill_parent="$HOME/.agents/skills"
mkdir -p "$screenrec_skill_parent"
# Refuse to overwrite an existing skill; review it before updating.
test ! -e "$screenrec_skill_parent/screenrec" && \
  test ! -L "$screenrec_skill_parent/screenrec" && \
  cp -R "$screenrec_skill_source/repo/skills/screenrec" "$screenrec_skill_parent/screenrec"
```

Start a new agent session and confirm that `screenrec` appears in its skill list.
Then request: “Use the screenrec skill to install the app and verify the CLI.”

### 2. Install the app and CLI from the latest release

Use the [latest stable GitHub release](https://github.com/dzhng/screen-recorder/releases/latest),
not a source build. Download its `ScreenRecorder-<tag>-macos-arm64.zip`,
`release.json` and `SHA256SUMS` together. In the download directory, run
`shasum -a 256 -c SHA256SUMS` before extracting. Check the receipt's architecture,
minimum macOS version and signing status.

Extract the ZIP with `ditto -x -k <zip-path> <new-directory>`. Install its
`Screen Recorder.app` at `~/Applications/Screen Recorder.app` and its `screenrec`
launcher at `~/.local/bin/screenrec`; make the launcher executable and add
`~/.local/bin` to PATH. Quit and back up an existing installation before replacing
it. Node is bundled; consumers do not need Bun, Node or Swift installed separately.

The skill's [installation procedure](skills/screenrec/references/installation.md)
contains executable download/install commands and upgrade, app-location and
macOS launch guidance. This developer preview is ad-hoc signed and not notarized;
if blocked, the user must approve **Open Anyway** in System Settings → Privacy &
Security. Installation does not grant capture permissions or download speech models.

### 3. Verify before operating

```sh
screenrec capture.status --help
screenrec service.health
```

Operation help returns its schema without launching the app. `service.health`
checks the installed runtime and may launch the app's local service; it does not
start recording. Save `screenrec --help` to a file when discovering operation names,
then request help for only the operation you need. Parse each operation's JSON
envelope, including failures; a successful request can still describe pending or
failed background work. Follow the skill for pinned revisions, retry identities
and verification of delivered media.

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
The [release notes](scripts/release-notes.md) describe release limitations and
link to agent setup. Built binaries are release assets;
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

[Agent evaluations](evals/README.md) run the consumer skill in disposable Docker
containers with separate response grading. They complement native/media proof;
portable CLI checks do not establish macOS capture readiness.

[Specs and evidence](specs/README.md) separate future proposals, closed rationale
and historical observations. Current behavior comes from the owning code and
its README. A historical pass is scoped evidence, and an unchecked old plan is
not an active implementation request.
