A developer preview of the macOS recording and agent-operated editing primitives.
The toolkit makes zero editorial decisions and preserves source media.

Requires **Apple Silicon and macOS 26 or newer**. Node is included; speech model
preparation remains an explicit caller action. The ZIP includes the app, optional
CLI launcher and a receipt identifying the source commit and runtime.

This build is **ad-hoc signed and not notarized**. After trying to open it, use
System Settings → Privacy & Security → Open Anyway if macOS blocks the launch.
Managed Macs may prohibit that override. Capture permissions are granted separately
when you request recording.

Quit any running copy before replacing it. Install the app in `~/Applications/Screen Recorder.app`. To install the optional CLI,
copy the ZIP's `screenrec` file into `~/.local/bin` and add that directory to PATH.
MCP clients use that launcher with `mcp` as its argument. Other app locations require
an absolute `SCREENREC_APP` environment variable.

Verify the downloaded ZIP and receipt with `shasum -a 256 -c SHA256SUMS`.
See the [README](https://github.com/dzhng/screen-recorder#releases) for the release
process and the [retained acceptance limits](https://github.com/dzhng/screen-recorder/blob/main/specs/done/agent-editing/release-closeout.md).
Third-party notices are included. The pretrained RNNoise model's license has not
been explicitly clarified upstream; its [existing provenance and limitation](https://github.com/dzhng/screen-recorder/blob/main/helpers/denoise/README.md)
remain recorded rather than implying a confirmed model-license grant.
