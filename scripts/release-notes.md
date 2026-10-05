A developer preview of the macOS recording and agent-operated editing primitives.
The toolkit makes zero editorial decisions and preserves source media.

Requires **Apple Silicon and macOS 26 or newer**. Node is included; speech model
preparation remains an explicit caller action. The ZIP includes the app, CLI
launcher and a receipt identifying the source commit and runtime. The primary
agent interface is the screenrec skill and CLI.

This build uses a **stable self-signed release identity and is not notarized**. After trying to open it, use
System Settings → Privacy & Security → Open Anyway if macOS blocks the launch.
Managed Macs may prohibit that override. Capture permissions are granted separately
when you request recording.

Follow [agent setup](https://github.com/dzhng/screen-recorder#agent-setup) to install
the skill, then the app and CLI. The skill's
[installation procedure](https://github.com/dzhng/screen-recorder/blob/main/skills/screenrec/references/installation.md)
owns checksum verification, destinations, PATH, updates and readiness checks.
Installed releases check for authenticated app updates and wait for existing work and CLI/MCP processes to finish before replacing the bundle. Automatic checks can be disabled in Settings.
Skill updates remain an explicit installation step.
MCP clients can optionally use the same launcher with `mcp` as its argument.
See the [retained acceptance limits](https://github.com/dzhng/screen-recorder/blob/main/specs/done/agent-editing/release-closeout.md).
Third-party notices are included. The pretrained RNNoise model's license has not
been explicitly clarified upstream; its [existing provenance and limitation](https://github.com/dzhng/screen-recorder/blob/main/helpers/denoise/README.md)
remain recorded rather than implying a confirmed model-license grant.
