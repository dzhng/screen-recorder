Nothing was executed. This procedure comes from the skill's `SKILL.md` and `references/installation.md`; I could not check the live GitHub release, so its tag and asset names are unconfirmed.

## Blockers and risks

- **Gatekeeper will likely block first launch.** The build is an ad-hoc signed, non-notarized developer preview. The user must try opening the app, then approve System Settings → Privacy & Security → **Open Anyway**. A managed Mac may prohibit that override, which is a hard stop. Do not strip quarantine attributes or disable Gatekeeper.
- **Network access to GitHub is required.** An authentication, rate-limit or download failure is a blocker, not a partial install.
- **`releases/latest` may return nothing.** That endpoint only returns a non-prerelease release. If the project has published only prereleases, the `curl -f` fails. Stop there; do not build from source as a fallback.
- **The checksum step may abort on unlisted files.** If `SHA256SUMS` lists assets the procedure doesn't download, `shasum -c` exits nonzero and the script stops. The documented instruction is to stop on checksum failure, so check which line failed before doing anything else.
- **Capture permissions are separate user actions.** Screen, microphone and camera each need the user's approval; install cannot grant them. Speech/voice models are also not downloaded by install.
- **`~/.local/bin` is not on PATH on a new Mac.** Without the PATH step, `screenrec` won't be found in later sessions.

## Procedure

**1. Preflight**

```sh
uname -m                         # must print arm64
sw_vers -productVersion          # must be 26 or newer
command -v screenrec             # expected: nothing on a fresh Mac
```

Everything used below (`curl`, `plutil`, `shasum`, `ditto`, `mktemp`) ships with macOS. No Homebrew, Node, Bun, Swift, Xcode tools or source checkout is needed; Node is bundled in the app.

**2. Download and verify**

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

Then check by hand:
- `release.json` names the same tag, `arm64`, and a minimum macOS version of 26 or lower.
- Note the signing and notarization status it reports.
- Copy the printed `Verified release extracted at:` path; the variables are gone once the subshell exits.
- Keep the ZIP and `release.json` until the install is verified.

**3. Install (fresh install only)**

Replace the placeholder with the path printed in step 2. The `test` lines make it refuse to overwrite an existing app or launcher, including symlinks.

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

**4. PATH**

```sh
export PATH="$HOME/.local/bin:$PATH"
```

The doc requires this to reach future agent sessions but leaves the mechanism open. My suggestion for a default zsh setup is to append the same line to `~/.zshrc`:

```sh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
```

If the app ever lives somewhere other than `~/Applications/Screen Recorder.app`, set `SCREENREC_APP` to that bundle's absolute path.

**5. Verify, in this order**

```sh
screenrec capture.status --help
screenrec service.health
```

1. `capture.status --help` returning a JSON schema proves the launcher and bundled runtime work. It does not launch the app.
2. `service.health` may launch the app's service but never starts capture. Read `ok` and the service status in the JSON, even on a nonzero exit.
3. If macOS blocks the launch, use the Open Anyway path above, then rerun `service.health`.
4. Before any real recording, run `screenrec capture.sources` and `screenrec capture.status` to see devices and existing permissions.

**6. Report**

State the installed release tag, the app and launcher paths, and the observed `service.health` result. If only the help command passed, say so; that is not service readiness.

## Skill availability on the new Mac

The skill in this workspace is complete (`SKILL.md` plus all four `references/` files) at `.claude/skills/screenrec/`. To use it outside this project on the new Mac, copy the whole folder to `~/.claude/skills/screenrec/`, start a new session and confirm `/screenrec` is discovered. A lone `SKILL.md` is not enough.
