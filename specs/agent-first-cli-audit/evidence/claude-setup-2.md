Nothing was executed. This procedure comes from the skill's `references/installation.md`; I had no network or shell access here, so the actual latest release tag and its assets are unverified.

## Procedure

**1. Preflight**

```sh
uname -m                  # must print arm64
sw_vers -productVersion   # must be 26 or newer
command -v screenrec      # expected: nothing on a new Mac
```

No source checkout, Bun, separate Node, Swift or MCP configuration is needed; Node is bundled.

**2. Download and verify the latest stable release**

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

- Stop if the checksum fails.
- Confirm `release.json` names the same tag, `arm64`, and a minimum macOS version of 26 or lower. It also reports signing and notarization status.
- Keep the ZIP and `release.json` until the install is verified.
- Copy the printed `…/unpacked` path; the variables do not survive the subshell.

**3. Install (fresh install only)**

Replace the placeholder with the path printed in step 2.

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

The block refuses to overwrite an existing app or launcher, including symlinks.

**4. Configure PATH**

```sh
export PATH="$HOME/.local/bin:$PATH"
```

A new Mac does not have `~/.local/bin` on PATH, so also persist this line for future agent sessions. The skill does not name a file; on default zsh I would use `~/.zshrc`. If the app ever lives elsewhere, set `SCREENREC_APP` to its absolute path.

**5. Verify, in this order**

1. Run `screenrec capture.status --help`. A JSON schema proves the launcher and bundled runtime work, without launching the app.
2. Run `screenrec service.health` and inspect `ok` and the service status. This may launch the app's service but never starts capture.
3. Run `screenrec capture.sources` and `screenrec capture.status` before any real recording, to see devices and existing permissions.

Report the installed tag, both paths and the observed health result. If only step 1 passed, say so: help succeeding is not service readiness.

## Installation blockers

- **Gatekeeper:** the developer preview is ad-hoc signed and not notarized, so macOS may block launch. You must open the installed app yourself, then approve it under System Settings → Privacy & Security → **Open Anyway**. Do not remove quarantine attributes or disable Gatekeeper.
- **Managed Macs:** device management may prohibit the Open Anyway override. That is a hard stop with no supported workaround.
- **Network and GitHub access:** an authentication, rate-limit or download failure in step 2 is a blocker, not a partial install.
- **Capture permissions:** screen, microphone and camera are separate approvals only you can grant. A healthy service does not mean capture is ready.
- **Speech/voice models:** these are not installed by setup and need explicit preparation when a task calls for them.
- **No source fallback:** if the release cannot be downloaded or verified, the skill forbids building from source instead.

Two risks I could not check without network access (my inference, not from the skill files):

- **No stable release:** `/releases/latest` ignores pre-releases. If this preview has only pre-release tags, the first `curl` returns 404 and the script stops.
- **Extra entries in `SHA256SUMS`:** the script downloads only the ZIP and `release.json`. If `SHA256SUMS` lists other assets, `shasum -c` fails on the missing files even though nothing is corrupt.
