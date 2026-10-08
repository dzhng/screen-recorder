Yap is the macOS recording and agent-operated video toolkit. This release ships
`Yap.app`, the `yap` CLI and the `com.dzhng.yap` app identity. Install the complete
kit for this identity; capture permissions must be granted to Yap separately.

The capture menu keeps its dark appearance after selecting a recording area and
shows the latest recording below the action buttons with Play and Copy agent prompt
actions. Screen recordings now include the pointer in the captured video.

## 0.1.25

Yap now maintains its account-level consumer skill through shared CLI and Settings operations. The Install skill preference defaults to enabled, discovers every supported global harness through `npx skills`, and safely stages, verifies, replaces and rolls back the global Yap skill. Disabling the preference removes the managed global installation so users can keep a customized skill.

The public `skill.status`, `skill.install`, `skill.update` and `skill.uninstall` operations report durable lifecycle state, ownership, discovered destinations and recovery diagnostics. Settings and the CLI use the same native handlers.

## 0.1.24

Transcript ingestion now normalizes fractional model timings at the native source
clock boundary, so tiny adjacent-word collisions do not fail an otherwise usable
recording. Diagnostics include the conflicting words and ranges when a malformed
payload still reaches ingestion.

The menu-bar item is compact again: it shows Yap's state icon only. The recording
overlay remains the place for elapsed time, so starting a take does not reserve a
large menu-bar slot or shift surrounding status items.

This release prepares the core transcription model in the background when Yap
starts, including after an app update. The CLI and `service.health` expose model
download state, byte progress and an estimated completion time so agents can wait
for readiness without discovering setup prerequisites themselves. Voice generation
and speaker diarization remain explicit downloads because they are secondary
capabilities with multi-gigabyte model/runtime footprints.

Recording library rows now focus on the two actions users need: play the recording
and copy an agent prompt containing its ID. Source IDs are no longer presented as
opaque details. The capture popover keeps its position when the menu-bar timer
appears, and its header actions use the tightened button sizing.

This release keeps Camera Only recordings alive when camera-session audio
timestamps carry a sub-frame synchronization residue. Continuous PCM stays on
one sample grid, while genuine full-frame overlaps remain rejected.

Fixes audio conversion that could interrupt Camera Only recording immediately after
countdown with `INVALID_AUDIO_FORMAT: Cannot create canonical PCM buffer.` Live PCM
callbacks can omit frame-duration metadata; conversion now derives the PCM frame
grid from the declared sample rate and preserves the timestamp and audio samples.

Recording controls retain a take's identity after it leaves capture status, resolve
its persisted outcome, and show the native interruption explanation. A new failure
reveals the panel without repeatedly reopening it on later polls. Confirmed deletion
releases retained controls, while transient read failures preserve their state.

Selected source tiles use their blue highlight without a redundant checkmark.
The dark recording panel, permission guidance, source defaults, area picker and
fixed status footer from the previous release remain available.

Synthetic live-buffer regression, decoded audio format checks and controls tests
passed. Live camera and microphone capture on physical devices remain unverified
on the development Mac, which has no camera or microphone input. Existing recordings
remain readable; no library migration is required for this update.

This release fixes Camera Only takes that could stop after several seconds with `AUDIO_OVERLAP: PCM classification overlaps admitted samples.` Audio admission now follows adjacent native callback timestamps, so small synchronization-clock residue cannot create invented one-frame gaps or overlaps. Genuine gaps, backward overlaps and pauses remain validated separately.

Recording action buttons now share aligned edges, equal spacing and consistent secondary-button sizing.

Synthetic live-buffer, clock, audio-format, controls and native build checks passed. Live camera and microphone capture on physical devices remain unverified on the development Mac, which has no camera or microphone input.

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

Requires **Apple Silicon and macOS 26 or newer**. Node and FFmpeg are included; the core
transcription model prepares automatically while secondary model downloads remain explicit.
The ZIP includes the app, CLI
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
Camera recording now shows a live preview above the floating transport controls,
using the same capture session as the recording. The preview is enabled by default
and can be hidden from Settings; screen-only recordings keep the compact controls.
Camera-only capture chooses the default available camera and no longer repeats a
redundant “Required” label after a camera is selected.
## 0.1.23

This release adds agent-first media evidence primitives: generation-pinned face
trajectories with explicit ambiguity and prediction refusal, fingerprinted
temporal correspondence receipts that never edit or synchronize a project, and
quality-gated long-form speaker continuity receipts that preserve refusal
metrics and anonymous identity boundaries. The public protocol, service, CLI and
MCP surfaces share the same strict contracts.

Live camera and microphone capture remain unverified on the development Mac,
which has no such devices.
