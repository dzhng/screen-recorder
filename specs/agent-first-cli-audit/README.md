# Agent-first CLI onboarding audit

Recorded 2026-10-04 against source `10190c8fd949484afb542f60e5f30e1b6bee189d`
and the published v0.1.1 release. This is bounded audit evidence, not an active
implementation plan or certification of every media operation.

## Contract and findings

The primary consumer path is **README → complete screenrec skill → released app
and CLI → installed operation schemas**. The app owns its service; MCP remains an
optional adapter. Installing the app does not authorize recording, grant capture
permissions or prepare speech models.

The baseline README deferred installation to a source-tree release guide, and the
consumer skill assumed an existing launcher. Neither Claude nor Codex could return
an exact first-run procedure with only that README and consumer skill supplied.
Both reported the absent installation guide rather than inventing a working setup.

The revised README explains consumer-skill discovery separately from development
skills, followed by released app/CLI installation. The skill carries its own
installation reference, including download checksums, refusal to replace existing
destinations, PATH, macOS launch approval and separate help/health verification.
Detailed media guidance moved intact behind task references; MCP delivery guidance
loads only for MCP use. Operation schemas and executable product behavior did not
change.

The executable install-example probe caught unsafe `set -e` behavior in an initial
draft's AND-list destination checks. Independent checks now refuse existing paths
and dangling symlinks. A repeat-install probe preserves a marked existing launcher.
The PATH example is separate so it cannot hide the install block's failure status.

## Evidence and limits

Fresh Claude Code and Codex CLI sessions ran on the host in scratch directories
and received only a case prompt and copies of
the consumer skill, plus the README for its entry case. Agent runs had read-only
tools, no installation authorization and no inherited conversation. Authentication
remained on the host; credentials were not copied into Docker during these original host trials. Agent built-in
skills remained available. Claude's streamed initialization and Skill invocation
confirmed discovery of the supplied `screenrec` skill.

Runners were Claude Code 2.1.289 (`opus`, high effort, project-only settings,
Read/Glob/Grep/Skill tools) and Codex CLI 0.160.0 (default model, read-only sandbox,
user configuration ignored). Each response came from a new session. The consumer
skill passed the available metadata validator in an isolated Python environment.

An independent fresh judge grades response artifacts against grounded setup,
non-destructive operation and honest readiness claims. Exact prompts, final
responses, judge findings and compact command evidence live in [evidence](evidence).
The final judge results were:

| Case | Codex | Claude |
| --- | --- | --- |
| First-run skill setup | 2/2 | 2/2 |
| README entry | 1/1 | 1/1 |
| Linux native-install refusal, with portable CLI distinction | 2/2 | 2/2 |

Baseline first-run setup passed 0/1 for each agent. An intermediate evaluation
flagged unnecessary developer-tool advice and an overbroad Linux help limitation;
the final instructions clarified both, and every case was rerun. The judge still
noted broad introductory wording in Claude's Linux replies, but each full response
explicitly permits portable JavaScript tests and accurately refuses native
installation. [The judgment](evidence/judgment.md) preserves that caveat.

These procedure trials do not prove agents can execute every recording/edit task.
Their network tools were unavailable or unable to reach GitHub; procedures disclose
that limitation. Separate host commands verified the actual published assets.

The following independent execution checks passed:

- Download commands from the installation reference resolved v0.1.1 and verified
  both the release ZIP and receipt using the published checksums.
- Fresh app/launcher installation into scratch state, installed operation help,
  refusal of repeat installation and refusal of a dangling app symlink.
- The existing [release smoke runner](../../scripts/release-smoke.mjs), against
  the downloaded release on macOS 27.0.1: relocated app, bundled Node 24.21.0,
  app-owned service health, empty scratch recording library, CLI schemas and native
  ping. No recording, transcription, rendering or model preparation occurred.
- Six portable released-CLI checks in Docker: offline operation schema, unknown
  operation, malformed stdin JSON, invalid parameters before transport, absent
  explicit socket, and preservation of a failed job inside an `ok: true` read.
  The last check uses a scripted Unix-socket peer, not a native service. Its
  illustrative `data.job.status` payload proves transport preservation only; the
  reusable harness now uses the real direct `data.state`, `reason` and `errorCode`
  job receipt.
- Edited local Markdown links resolve; moved media guidance matches its original
  text; diff whitespace checks pass.

Docker runs used an unprivileged user, read-only root filesystem, dropped Linux
capabilities, no network and temporary input/workspace filesystems. Only the public
release's JavaScript CLI bundle and a scratch probe entered the container. Linux
does not run the macOS app, native service or capture. Portable CLI schema/transport
proof must not be presented as native readiness.

No full native/source suite was run: no product executable changed. The new eval
harness has its own model-free regressions and Docker fixture controls. Existing recordings, library state, installed app and
shell configuration were not modified. One skill-download probe temporarily copied
the public skill into the personal agent directory. That exact probe-created copy
was removed; no pre-existing skill was replaced, and the probe passed again using
scratch state. All native test children and test containers were stopped; large
scratch app copies were removed after evidence retention.

## Reusable Docker agent evaluations

The committed [eval harness](../../evals/README.md) extends the original host
procedure trials with actual Claude/Codex CLI sessions in disposable containers.
Case inputs are isolated from acceptance bars; a separate fresh judge sees the
response, observed shell commands and CLI/service receipts. Credentials enter
only the selected disposable home or environment, with known secrets redacted
before reports are written. The image and input hashes identify tested bytes.
Linux trials exercise the released JavaScript CLI and a scripted failed-job peer;
they cannot establish native readiness or recording quality.

Independent review found two harness defects: missing Claude direct-command
evidence and eager stdin buffering that stalled help with an open pipe. Both were
reproduced before correction. The launcher now inherits stdin, and both agents'
command evidence reaches the judge. Fixture controls exercise the launcher with
open stdin as well as parameter input. Model-free regressions also pin failed or
interrupted runs, container timeout cleanup, invalid judgments, credential
redaction, damaged release bytes and the no-model contracts-only path. A later
review also reproduced rejection of a successful Codex turn after reconnect
diagnostics; the parser now requires terminal failure or an unsuccessful exit,
and continues to reject incomplete turns.

The initial repeated Docker suite passed **19/20**. Its README failure involved
an absent README-linked consumer folder in the scratch fixture and older skill
files on public `main`. The harness now preserves `skills/screenrec` for README
entry without preinstalling the skill. All four corrected README trials passed;
combined with the sixteen unaffected trials, final acceptance is **20/20**:

| Docker case | Codex | Claude |
| --- | --- | --- |
| First-run skill setup | 2/2 | 2/2 |
| README entry, corrected repository layout | 2/2 | 2/2 |
| Linux native-install refusal | 2/2 | 2/2 |
| Schema execution with unavailable service | 2/2 | 2/2 |
| Successful read reporting a failed job | 2/2 | 2/2 |

The fourteen model-free regressions, six portable fixture controls, touched lint,
format and authored-document navigation checks passed. A further fresh Codex CLI
trial on the final parser image passed. All fifty completed runner/judge
transcripts retain identical responses and command evidence when replayed through
the final parser; the main suite's image predates only that reconnect correction.
[Compact Docker results](evidence/docker-agent-results.json) preserve provenance,
per-trial judgments and the original failed response. Raw generated artifacts
remain local and ignored. These are sampled rates, not native media certification.

## Remaining distribution decisions

- **Stable versus preview updates:** the release workflow automatically marks
  every `v0.*` tag as a prerelease. GitHub's `/releases/latest` endpoint selects
  stable releases, so a later preview does not advance this installation path.
  Decide whether consumer onboarding follows stable releases or explicitly opts
  into previews. Current v0.1.1 is stable and works through that endpoint.
- **Skill packaging/versioning:** release assets contain the app, receipt and
  checksums, but no small, versioned skill archive. The documented sparse Git or
  GitHub contents API route avoids fetching repository media. A skill archive
  would simplify installation on Macs without Git and bind skill guidance to a
  release. Meanwhile agents must discover schemas from the installed CLI.
- **Launch approval:** the release is ad-hoc signed and not notarized. A quarantined
  download can require user approval; managed Macs may block it. The smoke check
  does not establish the quarantined first-run experience on a new user's Mac.
- **Ongoing agent acceptance:** current release CI verifies packaging/runtime
  contracts, not consumer-skill discovery or real Claude/Codex onboarding. These
  trials are bounded samples. Full recording/editing, permissions and media review
  remain separate acceptance work; no user recording was used for this audit.

No release assets were replaced and no new release or pull request was created.
The consumer documentation and reusable eval harness accompany this audit.

## Docker installed on the audit machine

Homebrew installed Docker CLI 29.8.2 and Colima 0.10.3. Colima provides the Linux
Docker Engine (29.5.2), with a 2-CPU, 4-GiB VM and 20-GiB disk limit; the selected
Docker context is `colima`. `docker run --rm hello-world` passed. Docker Desktop
was not installed. `brew services start colima` enabled and started the user
LaunchAgent; service status and Docker readiness passed after service handover.

Colima starts at this user's login after reboot, rather than before login. Use
`docker info` to check readiness and `brew services stop colima` to stop the VM
and disable automatic startup. The Docker engine remains running for subsequent work.
