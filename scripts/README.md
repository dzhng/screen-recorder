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
Manifests pin toolchains and dependencies. Native compilation explicitly selects
SwiftPM’s native build system: controls checks link its modules/object map, and
native runners consume its debug executable layout. A different build engine
requires migrating those consumers together. The [denoiser owner](../helpers/denoise/README.md)
explains its verified build input; speech and voice model readiness is explicit
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
only verified assets. Its manual retry runs the selected source with an explicit
version tag validated by the same release owner; published assets remain immutable.
Relocation smoke loads schema help and the native worker
from the exact signed archives; it does not launch the production host or external
launcher, whose preferences and lock belong to the real account. Host/service and
updater lifetime proof uses an isolated signed fixture identity. The workflow owns
triggers and permissions. Normal version tags, including `v0.*`,
publish stable; suffixed tags publish prerelease. The [publication owner](release-publish.mjs)
uploads the complete draft before publishing, verifies receipts, and leaves
published releases untouched. GitHub selects the latest stable release by its
semantic-version policy, so publishing a delayed older draft cannot force the
update feed backward. Prereleases do not become latest.
[Focused CI](../.github/workflows/release-checks.yml) checks release contracts on
relevant source changes without starting capture or model inference.

The [release tool](release.mjs) owns validation, explicit preparation and packaging.
[Release inputs](release-inputs.json), the repository's Node version and denoiser
provenance bind acquired bytes. Package receipts bind source and runtime identity;
checksums bind delivered bytes. The install kit and app-only update ZIP contain
the same finalized signed app; the kit's checksums remain scoped to the kit and
receipt, while Sparkle authenticates the update ZIP and finalized feed.
The [signing owner](release-signing.mjs) requires externally supplied durable
credentials and public fingerprints, imports the identity into an ephemeral
keychain, authorizes headless signing only within that keychain, and signs nested
code before its enclosing bundles. A signing failure identifies the owned target
and bounded tool error after removing the current keychain’s private inputs;
security and OpenSSL diagnostics stay suppressed. Secret material
never belongs in the app, release directory, receipt or logs. The
[custody handoff](../specs/done/auto-update/assets/signing-custody.md) owns backup and CI
credential transfer; a missing input fails rather than creating another identity.
The [protected engine](sparkle/README.md) owns framework preparation; an explicit
framework override must match its pinned build receipt. Source builds link the
same SDK but have no feed or public update key. Only release packaging enables
updates and derives compatibility metadata from core. The fixed
[launcher](launcher/main.c) holds shared kernel exclusion before any bundled code
read and until the CLI process ends. Its lock follows the passwd account home,
matching Sparkle even when `HOME`
selects another default app location. The account lock persists across bundle
replacement; neither launcher nor updater may unlink it. Neither is a notarization
claim. The
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

The [installed update runner](installed-update-lab/README.md) proves assembled
app/CLI replacement and library preservation using uniquely owned signed fixtures.
Its controlled local feed is separate from published GitHub artifact readiness.

Probe and measurement scripts exercise selected platform or product boundaries.
The [verification guide](../packages/test-harness/README.md) explains their evidence
roles and how to choose a focused existing runner. Read the selected tool's inputs
and state ownership before running a lab against a real installation.

The [updater boundary lab](update-lab.mjs) reproduces pinned Sparkle behavior in
uniquely identified scratch bundles. Its suite includes an expected defect
reproduction; a passing lab suite does not approve the engine. The
[active updater proof](../specs/done/auto-update/README.md#evidence-and-limits)
records acceptance separately from observed behavior.

The [protected Sparkle input](sparkle/README.md) owns the pinned source patch
and source-build requirements. The [native guard suite](update-guard.test.mjs)
requires an explicitly built framework and protects the install/cancellation
contract. Public fixture retention binds exact signed bytes while private keys
are always deleted; these native boundary results are separate from installed
product acceptance.

The [launcher lifetime lab](launcher-lab.mjs) is a disposable concurrency proof,
not an installer. It shows why selecting Node and then reading a mutable app path
needs exclusion covering the whole CLI process, including an idle MCP session.
Its lock wrapper is research input until the updater's post-exit installation
owner is proved; a passing lab is not installed-update acceptance.

The [scratch signing lab](signing-lab.mjs) proves certificate-anchored app and
nested signatures, encrypted identity restoration and relocation with explicitly
selected framework/Node inputs. It creates and deletes only scratch keys; it
changes no certificate trust and performs no permission checks. The
[release signing checkpoint](../specs/done/auto-update/README.md#evidence-and-limits)
keeps the scratch recipe separate from owner-approved
[production credential custody](../specs/done/auto-update/assets/signing-custody.md).
