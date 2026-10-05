# Builds, installation and releases

This directory owns build, installation, packaging and developer-lab entry points.
The [root manifest](../package.json) selects commands; each tool owns its arguments.
Build output belongs outside tracked source. A build verifies and assembles an
artifact; installation changes the selected app location; packaging creates a
portable distribution. One does not imply the others.

## Native prerequisites

Bun installs workspace dependencies and orchestrates build scripts; Node runs the
service and CLI, and Swift builds the native boundary. Run bun install before a
checkout build. The [Node pin](../.node-version) and root manifest own tool versions.

The [app builder](build-macos.mjs) composes the workspace and native outputs.
Manifests pin toolchains and dependencies. The [denoiser owner](../helpers/denoise/README.md)
explains its verified build input; the [FFmpeg owner](../helpers/ffmpeg/README.md)
prepares the pinned LGPL executable and shared-library distribution. Speech and voice model readiness is explicit
runtime work, not permission to download models during ordinary execution.

Personal source builds may record a host interpreter. Tagged packages include
an interpreter resolved relative to the app, so moving the package cannot retain
a builder's machine path. [Runtime resolution](../apps/macos/README.md#runtime-resolution)
owns probing and failure behavior.

## Versioned GitHub releases

The [app manifest](../apps/macos/package.json) owns the version. Update it, commit
the source, and push an annotated tag whose name is v followed by that version.
Push the source branch as well. Never move a published tag or silently replace
its assets; a correction receives a new version.

The [tag workflow](../.github/workflows/release.yml) validates version agreement,
prepares pinned inputs, builds on macOS, checks the relocated package and publishes
only verified assets. The workflow owns triggers, permissions and prerelease policy.
[Focused CI](../.github/workflows/release-checks.yml) checks release contracts on
relevant source changes without starting capture or model inference.

The [release tool](release.mjs) owns validation, explicit preparation and packaging.
[Release inputs](release-inputs.json), the repository's Node version and denoiser
provenance bind acquired bytes. Package receipts bind source and runtime identity;
checksums bind delivered bytes. Neither is a notarization claim. The
[recipient guide](release-notes.md) is also the release-notes template and links
to [agent setup](../README.md#agent-setup). The consumer skill's
[installation procedure](../skills/screenrec/references/installation.md) owns
executable release-install commands and readiness checks.

## Personal source installation

The [installer](install-personal.mjs) owns app and launcher destinations and
refuses to replace a running app. The installed bundle identity is separate from
development builds. macOS capture permissions follow code identity, so local
[signing setup](signing-identity.mjs) matters when repeatedly replacing that build.
A signing identity is not notarization or permission to start capture.

## Developer labs

Probe and measurement scripts exercise selected platform or product boundaries.
The [verification guide](../packages/test-harness/README.md) explains their evidence
roles and how to choose a focused existing runner. Read the selected tool's inputs
and state ownership before running a lab against a real installation.
