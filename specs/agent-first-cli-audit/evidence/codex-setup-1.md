I inspected the supplied [screenrec skill](/private/tmp/screenrec-agent-audit-20261004/final-codex-setup-1/.agents/skills/screenrec/SKILL.md) and [installation reference](/private/tmp/screenrec-agent-audit-20261004/final-codex-setup-1/.agents/skills/screenrec/references/installation.md). Nothing was installed.

The following procedure resolves the latest stable release when run. I could not verify today’s release tag because GitHub access failed in this environment.

1. On the target Mac, check the prerequisites:

   ```sh
   uname -m
   sw_vers -productVersion
   command -v screenrec
   ```

   Require `arm64` and macOS `26` or newer. A fresh Mac should have no `screenrec` command. No separate Node, Bun, Swift, source checkout, or MCP setup is needed; Node is bundled.

2. Download and verify all assets from one release tag:

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

   Stop on checksum failure. Before installing, check that `release.json` identifies the selected tag, `arm64`, and a minimum macOS version compatible with the Mac. Inspect its signing and notarization information. Keep the ZIP and receipt until verification is complete.

3. Install using the absolute extraction path printed above:

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

   These commands refuse existing destinations, including symlinks.

4. Configure PATH:

   ```sh
   export PATH="$HOME/.local/bin:$PATH"
   ```

   Add that same line once to `~/.zprofile` for future zsh login sessions. Ensure future agent sessions also inherit it through their launch environment.

5. Verify the CLI and service separately:

   ```sh
   screenrec capture.status --help
   screenrec service.health
   ```

   The help command verifies the launcher and bundled runtime without launching the app. `service.health` may launch the service but does not start recording; inspect its JSON `ok` field and service status. Help success alone does not establish service readiness.

6. For agent skill discovery, copy the **entire supplied screenrec folder**, including `references/`, to `~/.agents/skills/screenrec/`. Start a new Codex session and confirm discovery with `$screenrec`.

Installation blockers and limits:

- **This trial:** GitHub browsing failed, and the read-only API request failed with `Could not resolve host: api.github.com`. The latest tag, assets, and receipt remain unverified.
- **Downloads:** Network, authentication, rate-limit, missing-asset, or checksum failures block installation.
- **macOS launch:** The supplied reference describes the preview as ad-hoc signed and not notarized. If blocked, open the installed app and use **System Settings → Privacy & Security → Open Anyway**. Managed Macs may prohibit this override. Do not remove quarantine attributes or disable Gatekeeper.
- **Capture readiness:** Screen, microphone, and camera permissions require separate user actions. Before recording, inspect `screenrec capture.sources` and `screenrec capture.status`; installation and service health do not prove capture permissions.