The macOS capture menu keeps its approved 352-point geometry while using a translucent
popover surface, lighter card treatment, fitted icons and vertically centered labels.
Settings remains visible across macOS permission panes and returns to the front after
Yap becomes active again. Live camera and microphone checks remain unverified
on the development Mac, which has no camera or microphone input.

The menu bar now opens a compact capture panel with Display, Window, Area and
Camera Only. Saved recordings, projects, tracked exports and storage move to a
separate Library window that stays open while you return to capture controls.

Camera Only records the explicitly selected camera with optional microphone and
system audio. Existing recordings remain readable; no library migration is
required. Live camera, microphone and camera-only system-audio checks remain
unverified on the development Mac, which has no camera or microphone input.

Check and download updates immediately from Settings → General → Check for Updates
or the public CLI `update.check` operation. Both use the same native updater;
`update.status` reports progress and `update.setEnabled` controls automatic updates.
A manual check works with automatic updates off without changing that preference.
Installation waits for recording, background work and CLI clients to finish.
Existing v0.1.5–v0.1.7 installations can update without resetting their library.

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
