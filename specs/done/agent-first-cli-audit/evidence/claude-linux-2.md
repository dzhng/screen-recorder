## Setup result: not installable on the target — nothing was installed or executed

**Target:** arm64 Linux Docker container
**Outcome:** Native installation is unsupported. Screen Recorder and its `screenrec` launcher cannot be installed there, so the CLI cannot be verified on that machine.

### Why
The skill's install procedure (`.claude/skills/screenrec/references/installation.md:3-8`) requires both:

- Apple Silicon (`arm64`), which the target satisfies
- macOS 26 or newer, which the target does not satisfy because it is Linux

For Linux, including Docker, the reference says to report native installation as unsupported and not to install a macOS bundle there. Matching arm64 does not help: the only release asset is `ScreenRecorder-<tag>-macos-arm64.zip`, a macOS `.app` plus launcher.

The documented steps also depend on macOS-only tools (`sw_vers`, `/usr/bin/plutil`, `ditto`) and a `~/Applications` app bundle, so the procedure would fail in the container even if attempted.

### Verification status
| Check | Status |
|---|---|
| `command -v screenrec` | Not run (trial is inspection-only) |
| `screenrec capture.status --help` (launcher and bundled runtime) | Not run; cannot pass on Linux |
| `screenrec service.health` (service readiness) | Not run; cannot pass on Linux |
| Release tag, app path, launcher path | None — nothing installed |
| Capture permissions and sources | Not applicable — no native app |

### What is possible on Linux
The skill says a portable JavaScript CLI bundle can run on Linux with Node for schema and transport tests. Two limits apply:

- **It proves little:** it does not install the macOS launcher, and it does not verify native service or capture readiness. A passing `--help` there would not count as a verified install.
- **The supplied files do not say how to get it:** there is no download location, asset name, or invocation for that bundle. The skill folder contains only `SKILL.md` and four references (`installation.md`, `media-workflows.md`, `mcp.md`, `editorial-checks.md`). I did not guess a source for it.
- **Node would be needed separately:** "Node is bundled" applies to the macOS app, so the container would need its own Node.

Building from source is ruled out by the skill as a consumer-install fallback, so I did not consider it.

### To get a working install
Use an Apple Silicon Mac on macOS 26+ and follow `installation.md`: download the latest stable release, check `SHA256SUMS`, install to `~/Applications/Screen Recorder.app` and `~/.local/bin/screenrec`, then run `screenrec capture.status --help` and `screenrec service.health`.

Expect a Gatekeeper prompt there, since the developer preview is ad-hoc signed and not notarized. The user has to approve it via System Settings → Privacy & Security → Open Anyway; the reference says not to strip quarantine attributes or disable Gatekeeper.
