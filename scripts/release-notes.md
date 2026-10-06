Yap is the macOS recording and agent-operated video toolkit. This release ships
`Yap.app`, the `yap` CLI and the `com.dzhng.yap` app identity. Install the complete
kit for this identity; capture permissions must be granted to Yap separately.

Opening recording controls from the menu bar now follows Codex Runway's native
activation and key-window sequence, including a second focus pass on the next
event-loop turn. The panel dismisses on outside clicks, Escape and application
switching. Delayed recording errors do not activate over another app.

This corrects the opening path used by v0.1.12, whose forced appearance flags did
not resolve the reported frosted first-open state. Compilation and focused native
checks passed; the actual first-open glass appearance remains visually unverified
because native UI automation was unavailable. Offscreen layout shots do not prove
composited glass appearance.

Readable icons, spacing beneath Start Recording and the fixed status footer remain.

Display, Window and Area controls are disabled until Screen Recording access is
granted, with a clear permission explanation and Allow action. Camera Only remains
available independently. To select an area, choose Area and drag a rectangle on
the screen; a click or tiny drag keeps the picker open, and selection returns to
the recording controls.

Enabled camera capture selects the system's default camera when none has been
chosen. The default microphone shows its device name after discovery. Existing
device choices are preserved, including unavailable devices.

Live camera, microphone and camera-only system-audio checks remain unverified on
the development Mac, which has no camera or microphone input. Existing recordings
remain readable; no library migration is required for this update.

Check and download updates immediately from Settings → General → Check for Updates
or the public CLI `update.check` operation. Both use the same native updater;
`update.status` reports progress and `update.setEnabled` controls automatic updates.
A manual check works with automatic updates off without changing that preference.
Installation waits for recording, background work and CLI clients to finish.
Updates within the Yap identity preserve its library.

Bundled FFmpeg/ffprobe, audio dynamics and loudness measurement, SDR correction,
qualified HDR-to-SDR conversion, HEVC delivery, caption sidecars and agent review
helpers remain available. FFmpeg needs no separate installation. Optional speaker
observations require caller-supplied local inputs.

This version uses catalog format 26 and portable package format 4. Earlier formats
are refused; no migration or automatic deletion occurs. Apps on older catalog
formats cannot auto-update to this version. Install the complete kit once with a
fresh library; use its new CLI launcher for protected `yap ffmpeg` extras.
The app updater does not replace external launchers or consumer skills.

A developer preview of the macOS recording and agent-operated editing primitives.
The toolkit makes zero editorial decisions and preserves source media.

Requires **Apple Silicon and macOS 26 or newer**. Node and FFmpeg are included; speech model
preparation remains an explicit caller action. The ZIP includes the app, CLI
launcher and a receipt identifying the source commit and runtime. The primary
agent interface is the yap skill and CLI.

This build uses a **stable self-signed release identity and is not notarized**. After trying to open it, use
System Settings → Privacy & Security → Open Anyway if macOS blocks the launch.
Managed Macs may prohibit that override. Capture permissions are granted separately
when you request recording.

Follow [agent setup](https://github.com/dzhng/yap#agent-setup) to install
the skill, then the app and CLI. The skill's
[installation procedure](https://github.com/dzhng/yap/blob/main/skills/yap/references/installation.md)
owns checksum verification, destinations, PATH, updates and readiness checks.
Installed releases check for authenticated app updates and wait for existing work and CLI/MCP processes to finish before replacing the bundle. Automatic checks can be disabled in Settings.
Skill updates remain an explicit installation step.
MCP clients can optionally use the same launcher with `mcp` as its argument.
See the [retained acceptance limits](https://github.com/dzhng/yap/blob/main/specs/done/agent-editing/release-closeout.md).
Third-party notices are included. The pretrained RNNoise model's license has not
been explicitly clarified upstream; its [existing provenance and limitation](https://github.com/dzhng/yap/blob/main/helpers/denoise/README.md)
remain recorded rather than implying a confirmed model-license grant.
