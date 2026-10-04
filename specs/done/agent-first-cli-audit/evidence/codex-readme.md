The README specifies a **release install**, with the complete consumer skill installed first. Apple Silicon and macOS 26 meet its requirements. **I only read files; no installation was executed.**

The procedure below follows [README.md](/private/tmp/screenrec-agent-audit-20261004/final-codex-readme/README.md) and its installation reference.

1. **Confirm the Mac’s architecture and OS**

   ```sh
   uname -m
   sw_vers -productVersion
   ```

   Expect `arm64` and macOS `26` or newer. You do not need Xcode, Command Line Tools, Bun, Swift, or a separate Node installation. Node is bundled.

2. **Install the complete consumer skill**

   For Codex, use `~/.agents/skills/screenrec/`. For Claude Code, use `~/.claude/skills/screenrec/`.

   Since this Mac has nothing installed, use the README’s GitHub contents API option. This script uses macOS tools, recursively downloads `skills/screenrec` including its references, and refuses an existing destination:

   ```sh
   (
     set -eu
     screenrec_skill_parent="$HOME/.agents/skills"
     screenrec_skill_target="$screenrec_skill_parent/screenrec"
     test ! -e "$screenrec_skill_target"
     test ! -L "$screenrec_skill_target"
     screenrec_skill_temp=$(mktemp -d)

     screenrec_fetch_folder() {
       local source_path="$1" destination="$2"
       local listing index=0 entry_type entry_name entry_path entry_url
       listing=$(mktemp "$screenrec_skill_temp/listing.XXXXXX")
       curl -fL \
         "https://api.github.com/repos/dzhng/screen-recorder/contents/$source_path" \
         -o "$listing"
       mkdir -p "$destination"
       while entry_type=$(/usr/bin/plutil \
         -extract "$index.type" raw -o - "$listing" 2>/dev/null); do
         entry_name=$(/usr/bin/plutil \
           -extract "$index.name" raw -o - "$listing")
         entry_path=$(/usr/bin/plutil \
           -extract "$index.path" raw -o - "$listing")
         case "$entry_type" in
           file)
             entry_url=$(/usr/bin/plutil \
               -extract "$index.download_url" raw -o - "$listing")
             curl -fL "$entry_url" -o "$destination/$entry_name"
             ;;
           dir)
             screenrec_fetch_folder \
               "$entry_path" "$destination/$entry_name"
             ;;
           *) return 1 ;;
         esac
         index=$((index + 1))
       done
     }

     screenrec_fetch_folder \
       "skills/screenrec" "$screenrec_skill_temp/screenrec"
     test -f "$screenrec_skill_temp/screenrec/SKILL.md"
     test -d "$screenrec_skill_temp/screenrec/references"
     mkdir -p "$screenrec_skill_parent"
     cp -R "$screenrec_skill_temp/screenrec" "$screenrec_skill_target"
   )
   ```

   Install the consumer folder `skills/screenrec`, as above. The repository’s `.agents/skills` contains development procedures.

3. **Start a new agent session**

   Confirm `screenrec` appears in the skill list. Invoke `$screenrec` in Codex or `/screenrec` in Claude Code, then request:

   > Use the screenrec skill to install the app and verify the CLI.

   The agent should carry out the following release procedure.

4. **Download and verify the latest stable release**

   Resolve the release once and download all three assets from that tag:

   ```sh
   (
     set -eu
     screenrec_download=$(mktemp -d)
     cd "$screenrec_download"
     curl -fL \
       https://api.github.com/repos/dzhng/screen-recorder/releases/latest \
       -o latest.json
     screenrec_tag=$(/usr/bin/plutil \
       -extract tag_name raw -o - latest.json)
     screenrec_release="https://github.com/dzhng/screen-recorder/releases/download/$screenrec_tag"

     curl -fL \
       "$screenrec_release/ScreenRecorder-$screenrec_tag-macos-arm64.zip" \
       -o "ScreenRecorder-$screenrec_tag-macos-arm64.zip"
     curl -fL "$screenrec_release/release.json" -o release.json
     curl -fL "$screenrec_release/SHA256SUMS" -o SHA256SUMS

     shasum -a 256 -c SHA256SUMS
     cat release.json
     ditto -x -k "ScreenRecorder-$screenrec_tag-macos-arm64.zip" unpacked
     printf 'Verified release extracted at: %s\n' "$screenrec_download/unpacked"
   )
   ```

   Stop on checksum failure. Check that `release.json` identifies the selected tag, `arm64`, a compatible minimum macOS version, and its signing/notarization status. Keep the ZIP and receipt until verification finishes.

5. **Install the app and launcher**

   Replace the placeholder with the extraction path printed above:

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

6. **Configure PATH**

   For the current terminal:

   ```sh
   export PATH="$HOME/.local/bin:$PATH"
   ```

   Add that same line to `~/.zshrc` for future interactive zsh sessions. Ensure the environment used to launch your agent also includes `~/.local/bin`.

7. **Verify the CLI and running service**

   ```sh
   command -v screenrec
   screenrec capture.status --help
   screenrec service.health
   ```

   Operation help verifies launcher and bundled runtime execution without launching the app. `service.health` may launch the local service but does not start recording. Inspect its JSON `ok` value and service status; help succeeding alone does not establish service readiness.

   The README describes this preview as ad-hoc signed and not notarized. If macOS blocks launch, try opening `~/Applications/Screen Recorder.app`, then approve **System Settings → Privacy & Security → Open Anyway**. Do not remove quarantine attributes or disable Gatekeeper.

8. **Prepare for the first recording**

   Inspect `capture.sources` and `capture.status` before requesting capture. Screen, microphone, and camera permissions require separate user actions. Installation does not grant them or download speech models.

   Use each installed operation’s `--help` schema when operating the app. MCP configuration is optional; the CLI is the default interface.