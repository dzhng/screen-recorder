# Install the released app and CLI

Use this procedure when `yap` or its selected app is missing. First check
`uname -m` and `sw_vers -productVersion`: the app requires Apple Silicon (`arm64`)
and macOS 26 or newer. On Linux, including Docker, report that native installation
is unsupported; do not install a macOS bundle there. Linux can independently run
the portable JavaScript CLI bundle with Node for schema/transport tests; that
does not install the macOS launcher or verify native service/capture readiness.
A consumer install needs no
source checkout, Bun, separate Node, Swift or MCP configuration.

## Download and verify

Resolve the latest stable release once, then download all assets from that tag.
The GitHub API and release downloads below need network access; an authentication,
rate-limit or download failure is a blocker, not evidence of installation.

```sh
(
  set -eu
  yap_download=$(mktemp -d)
  cd "$yap_download"
  curl -fL https://api.github.com/repos/dzhng/yap/releases/latest -o latest.json
  yap_tag=$(/usr/bin/plutil -extract tag_name raw -o - latest.json)
  yap_release="https://github.com/dzhng/yap/releases/download/$yap_tag"
  curl -fL "$yap_release/Yap-$yap_tag-macos-arm64.zip" -o "Yap-$yap_tag-macos-arm64.zip"
  curl -fL "$yap_release/release.json" -o release.json
  curl -fL "$yap_release/SHA256SUMS" -o SHA256SUMS
  shasum -a 256 -c SHA256SUMS
  cat release.json
  ditto -x -k "Yap-$yap_tag-macos-arm64.zip" unpacked
  printf 'Verified release extracted at: %s\n' "$yap_download/unpacked"
)
```

Check that `release.json` names the selected tag, `arm64` and a compatible minimum
macOS version. It also reports signing and notarization. Keep the ZIP and receipt
until installation has been verified. Stop on checksum failure.

## Install

Use the verified extraction path printed above for `yap_unpacked`. These
commands are for a fresh install and refuse existing destinations, including
symlinks. For an update, quit the running app and retain the old bundle and launcher
in a backup before replacing them. Do not replace a live app or discard its library.

```sh
(
  set -eu
  yap_unpacked="/absolute/path/printed/above/unpacked"
  yap_app="$HOME/Applications/Yap.app"
  yap_launcher="$HOME/.local/bin/yap"
  test ! -e "$yap_app"
  test ! -L "$yap_app"
  test ! -e "$yap_launcher"
  test ! -L "$yap_launcher"
  mkdir -p "$HOME/Applications" "$HOME/.local/bin"
  ditto "$yap_unpacked/Yap.app" "$yap_app"
  cp "$yap_unpacked/yap" "$yap_launcher"
  chmod +x "$yap_launcher"
)
```

After a successful install, set PATH in the current session:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

Ensure the PATH addition also reaches future agent sessions, using the user's
shell configuration or the agent launch environment. For another app location,
set `YAP_APP` to that bundle's absolute path; the launcher defaults to
`~/Applications/Yap.app`.

## Verify installation separately from permissions

1. Run `yap capture.status --help`. Its JSON schema proves launcher and
   bundled runtime execution without launching the app.
2. Run `yap service.health`. Inspect `ok` and the returned service status.
   This may launch the installed app's service, but never starts capture.
3. If macOS blocks launch, have the user try opening the installed app, then approve
   System Settings → Privacy & Security → **Open Anyway**. Check the receipt's
   signing status; these releases are not notarized. Managed Macs may prohibit
   that override.
   Do not remove quarantine attributes or disable Gatekeeper to bypass it.
4. Discover `capture.sources` and `capture.status` before an actual recording
   request. Screen, microphone and camera permissions are separate user actions.
   Speech/voice model downloads require explicit preparation when requested.

Report the installed release tag, app/launcher paths and observed health result.
If only help passed, say so; blocked app launch is not verified service readiness.
Use the installed CLI's schemas even when this skill is newer than that release.

## Refresh the media-tool launcher

After `service.tools` reports bundled media readiness, run `yap ffmpeg -version`
and `yap ffprobe -version`. Both must exit successfully and identify the
requested tool. An `UNKNOWN_OPERATION` or argument-parsing failure can mean the app
updated while its external launcher stayed older. Tool readiness alone does not
prove launcher support. Do not bypass update protection by running the raw path.

Use the download-and-verify procedure above to obtain a complete release kit that
supports media passthrough. If its launcher still does not recognize these commands,
report the unavailable capability; installing a separate FFmpeg is not the remedy.
Wait for existing CLI/MCP clients to finish. Retain the existing launcher and replace
only that launcher from the verified kit using a same-directory staged rename:

```sh
(
  set -eu
  yap_unpacked="/absolute/path/printed/above/unpacked"
  yap_launcher=$(command -v yap)
  test -f "$yap_launcher"
  test ! -L "$yap_launcher"
  test -x "$yap_unpacked/yap"
  yap_backup=$(mktemp -d)
  cp -p "$yap_launcher" "$yap_backup/yap"
  yap_staged=$(mktemp "${yap_launcher}.refresh.XXXXXX")
  trap 'rm -f "$yap_staged"' EXIT
  cp "$yap_unpacked/yap" "$yap_staged"
  chmod +x "$yap_staged"
  mv "$yap_staged" "$yap_launcher"
  printf 'Previous launcher retained at: %s\n' "$yap_backup/yap"
)
```

Repeat both version checks and ordinary CLI help. App and library contents remain
in place; a missing or unready app requires the full installation procedure.

## App updates and recovery

An older installation without the updater or coordinated launcher needs one
manual bootstrap using the complete app-plus-launcher kit above. Wait for accepted
work and old client processes to finish before replacing it; never kill clients,
cancel jobs or stop a recording merely to install an update. Retain the old bundle
and launcher and leave the library intact.

Updater-bearing releases download candidates automatically and install when the
app, service and existing CLI clients permit it. The app bundle contains the actual
CLI, Node, service and workers, so they update together; the external launcher stays
in place. An already-running CLI remains its old generation until it exits. The
app's automatic-update preference persists; turning it off cancels download or
staged installation until replacement has been finally authorized. After that
point it applies to the successor. Skill files are refreshed separately through
the skill lifecycle.

Read advertised `service.health` update state and errors literally. `UPDATING`
is a retryable installation fence; retry after relaunch, following the operation's
write-identity contract. `UPDATE_RESTART_REQUIRED` or `UPDATE_SHUTDOWN_FAILED`
requires ordinary user quit and reopen. A shutdown failure after the service pipe
closes can leave the service unavailable; it does not imply the old service
reopened. Do not force-kill a closing child, launch a competing service or replay
an uncertain mutation. Reopen only after the existing app and child have exited,
within the user's request.

If an installed update cannot start, retain the reported failure and use the same
verified download/install procedure for a specifically chosen previous release
with the same catalog format. Back up the app/launcher, preserve the library, and
verify health after reinstalling. Do not promise arbitrary downgrades, automatic
post-launch rollback or restoration of capture permissions from a checksum alone.
