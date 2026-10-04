I read `README.md` and the skill's `references/installation.md` that it points to for the executable commands; nothing was installed or run, and I did not check that the GitHub release or URLs actually exist.

I've assumed your agent is Claude Code. For Codex CLI, swap `~/.claude/skills` for `~/.agents/skills` and invoke with `$screenrec` instead of `/screenrec`.

## 0. Prerequisites

- **Agent:** install your agent first; the README does not cover this.
- **Hardware and OS:** confirm Apple Silicon and macOS 26 or newer:
  ```sh
  uname -m                  # must print arm64
  sw_vers -productVersion   # must be 26 or newer
  ```
- **Not needed:** Git, Xcode, Command Line Tools, Node, Bun and Swift are not required to run the app or CLI (Node is bundled).

## 1. Install the screenrec skill

Copy the whole `skills/screenrec` folder, including `references/`, to `~/.claude/skills/screenrec/`. Do not install the repository's `.agents/skills`; those are development skills.

**On a new Mac without Git (your case):** the README says not to install Xcode or Command Line Tools just to fetch the skill. Instead it says to use the agent's repository skill installer or the GitHub contents API, but it gives no commands for this. The listing calls would be:

```sh
curl -fsSL https://api.github.com/repos/dzhng/screen-recorder/contents/skills/screenrec
curl -fsSL https://api.github.com/repos/dzhng/screen-recorder/contents/skills/screenrec/references
```

Download each entry's `download_url` to the same relative path under `~/.claude/skills/screenrec/`. The copy in this directory contains `SKILL.md` plus `references/installation.md`, `media-workflows.md`, `editorial-checks.md` and `mcp.md`; the remote may differ.

**If Git is already usable**, the README's sparse checkout (with the Claude Code path substituted, as its comment instructs):

```sh
screenrec_skill_source=$(mktemp -d)
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/dzhng/screen-recorder.git "$screenrec_skill_source/repo"
git -C "$screenrec_skill_source/repo" sparse-checkout set skills/screenrec
screenrec_skill_parent="$HOME/.claude/skills"
mkdir -p "$screenrec_skill_parent"
# Refuse to overwrite an existing skill; review it before updating.
test ! -e "$screenrec_skill_parent/screenrec" && \
  test ! -L "$screenrec_skill_parent/screenrec" && \
  cp -R "$screenrec_skill_source/repo/skills/screenrec" "$screenrec_skill_parent/screenrec"
```

Then start a new agent session and confirm `screenrec` appears in the skill list.

## 2. Install the app and CLI from the latest release

Either ask the agent: "Use the screenrec skill to install the app and verify the CLI." Or run the commands yourself. Use the latest stable release, not a source build.

**Download and verify:**

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

Stop if the checksum fails. In `release.json`, check the tag, `arm64`, a compatible minimum macOS version, and the signing status. Keep the ZIP and receipt until the install is verified.

**Install** (fresh install only; it refuses existing destinations). Replace the first path with the one printed above:

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

**PATH** for the current session:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

Also make it persist for future agent sessions. The docs leave the method to you; on a default zsh setup, adding that same line to `~/.zshrc` does it.

## 3. Verify before operating

```sh
screenrec capture.status --help
screenrec service.health
```

- **`capture.status --help`:** returns a JSON schema without launching the app. This proves only that the launcher and bundled runtime work.
- **`service.health`:** may launch the app's local service but never starts recording. Check `ok` and the service status in the JSON reply. Help passing alone is not service readiness.

## What to expect on first launch

- **Gatekeeper:** this developer preview is ad-hoc signed and not notarized. If macOS blocks it, try opening the app, then approve System Settings → Privacy & Security → **Open Anyway**. Do not strip quarantine attributes or disable Gatekeeper; a managed Mac may forbid the override.
- **Permissions:** installation grants no capture permissions. Screen, microphone and camera are separate approvals you give later.
- **Speech models:** none are downloaded at install; they need explicit preparation when you request them.
