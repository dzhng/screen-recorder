The supplied skill requires **Apple Silicon (`arm64`) and macOS 26+**, so the specified Mac meets its platform requirements. No installation was executed. I could not retrieve GitHub’s latest release during this trial, so the release tag and asset availability remain unverified; the procedure below resolves the latest stable tag when run.

This follows the supplied [installation reference](/private/tmp/screenrec-agent-audit-20261004/final-codex-setup-2/.agents/skills/screenrec/references/installation.md).

1. Check the machine and existing CLI:

```sh
uname -m
sw_vers -productVersion
command -v screenrec
```

Expect `arm64`, macOS `26` or newer, and no existing `screenrec` command.

2. Download one release’s ZIP, receipt, and checksums, then verify and extract:

```sh
(
  set -eu
  screenrec_download=$(mktemp -d)
  cd "$screenrec_download"
  curl -fL https://api.github.com/repos/dzhng/screen-recorder/releases/latest -o latest.json
  screenrec_tag=$(/usr/bin/plutil -extract tag_name raw -o - latest.json)
  screenrec_release="https://github.com/dzhng/screen-recorder/releases/download/$screenrec_tag"
  curl -fL "$screenrec_release/ScreenRecorder-$screenrec_tag-macos-arm64.zip" -o "ScreenRecorder-$screenrec_tag-macos-arm64.zip"
  curl -fL "$screenrec_release/release.json" -o release.json
  curl -fL "$screenrec_release/SHA256SUMS" -o SHA256SUMS
  shasum -a 256 -c SHA256SUMS
  cat release.json
  ditto -x -k "ScreenRecorder-$screenrec_tag-macos-arm64.zip" unpacked
  printf 'Verified release extracted at: %s\n' "$screenrec_download/unpacked"
)
```

Before continuing, confirm `release.json` names the selected tag, `arm64`, and a minimum macOS version compatible with the Mac. Review its signing and notarization information. **Stop on checksum failure.** Keep the ZIP and receipt until verification is complete.

3. Substitute the printed extraction path below, then install:

```sh
(
  set -eu
  screenrec_unpacked="/absolute/path/printed/above/unpacked"
  screenrec_app="$HOME/Applications/Screen Recorder.app"
  screenrec_launcher="$HOME/.local/bin/screenrec"
  test ! -e "$screenrec_app"
  test ! -L "$screenrec_app"
  test ! -e "$screenrec_launcher"
  test ! -L "$screenrec_launcher"
  mkdir -p "$HOME/Applications" "$HOME/.local/bin"
  ditto "$screenrec_unpacked/Screen Recorder.app" "$screenrec_app"
  cp "$screenrec_unpacked/screenrec" "$screenrec_launcher"
  chmod +x "$screenrec_launcher"
)
```

These fresh-install commands refuse existing destinations, including symlinks.

4. Configure PATH:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

Add that same line to `~/.zshrc` for future interactive zsh sessions. Ensure the agent’s launch environment also receives it.

5. Verify runtime execution and service readiness separately:

```sh
screenrec capture.status --help
screenrec service.health
```

The first command returns the schema without launching the app. The second may launch the service but does not start recording. Inspect its JSON `ok` and service status; successful help alone does not establish service readiness.

6. Before recording, inspect sources and permissions:

```sh
screenrec capture.sources
screenrec capture.status
```

Screen, microphone, and camera permissions require separate user actions. Node is bundled; no source checkout, Bun, separate Node, Swift, or MCP configuration is required.

Installation blockers and limits:

- GitHub API authentication, rate limits, network failures, missing assets, checksum failures, or incompatible receipt metadata block installation.
- The supplied reference describes the developer preview as **ad-hoc signed and not notarized**. If macOS blocks launch, open the installed app and approve **System Settings → Privacy & Security → Open Anyway**. Managed Macs may prohibit this override. Do not remove quarantine or disable Gatekeeper.
- Capture permissions can block recording independently of installation and service health.
- This trial’s filesystem is read-only, and installation was explicitly excluded. No app, launcher, PATH changes, or health checks were performed.

To make the skill available on the new Mac, copy its **entire folder, including `references/`**, to `~/.agents/skills/screenrec/`, start a new Codex session, and confirm discovery with `$screenrec`.