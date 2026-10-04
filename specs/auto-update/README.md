# Automatic updates

Status: discovery in progress. These are agreed requirements and open questions;
installed-app updating is not implemented. Publishing a release already means
bumping the version and pushing its tag through the existing
[release workflow](../../scripts/README.md#versioned-github-releases).

## Agreed behavior

Answered by the user:

- Download updates automatically and install when recording and background work
  are idle, with an opt-out setting. Keep updates automatic without interrupting
  work in progress.
- Update both the application and CLI. They are one delivered product; installing
  a new app must leave the installed CLI usable with that same release.
- Release publishing needs no separate tester rollout or feedback process.
- Installed skills are not changed by automatic app/CLI updates. Skill installation
  and updates use `npx skills` directly; their usage and latest-skill checks belong
  in the consumer skill itself.
- Canonical skill content comes from repository `main`, independently of app
  releases. Resolve a specific commit when comparing its files.
- `.agents/skills/screenrec/` is the canonical project installation. Selected
  agents' skill paths, including `.claude/skills/screenrec`, link to it rather
  than holding independent copies.
- No Apple Developer membership or Developer ID certificate is available. Paid
  membership is not a prerequisite for automatic updates.

## Existing boundaries

The [release packager](../../scripts/release.mjs) places CLI code, service and Node
inside the app. Its separate launcher executes the selected app's bundled CLI.
Replacing the app therefore updates the executable CLI code; any required launcher
change must also be accounted for. The consumer skill is managed separately.

The [app](../../apps/macos/README.md) owns the service child's lifetime. The updater
must coordinate replacement with that owner and preserve library and source media.
Current installation and upgrades follow the consumer skill's
[manual installation guide](../../skills/screenrec/references/installation.md).
No Sparkle integration exists. Released bundles are ad-hoc signed and not notarized.

## Explicit skill management

Use [Vercel's skills CLI](https://github.com/vercel-labs/skills) directly. It owns
agent discovery, installation, source tracking and links. No custom `screenrec
skills` commands or second installation manager are planned. Select symlink mode;
do not use `--copy`. Verify the resulting agent skill paths resolve to `.agents`:
the upstream installer can fall back to copies when symlink creation fails.
Agent configuration directories remain separate; the links are at their skill
paths, not entire `.claude` or other configuration roots.

The complete consumer folder, including references, is the installation and
comparison unit. The consumer skill must teach checking current `main`, showing
a diff against the installed canonical folder, explicitly updating it or applying
selected changes to preserve customization. First-run setup must also work before
the Screen Recorder CLI is installed. `npx` needs a compatible Node/npm setup;
that prerequisite is separate from the app's bundled runtime.

Territory findings, checked against the published `skills` 1.7.0 package:

- `add` supports agent discovery and a canonical `.agents` folder with symlinks.
  A scratch project probe installed all references, verified Claude's link and
  explicit overwrite, and retained unrelated agent settings.
- `update screenrec --project` refreshes a tracked project skill. `check` is an
  alias for updating, not a read-only latest-version check. There is no implemented
  `--dry-run`; unknown update options are ignored. Never present those invocations
  as safe inspection.
- A read-only review therefore needs the latest complete skill staged in scratch
  state, followed by an ordinary diff. Installed files and their tracking metadata
  must remain untouched until an explicit update.
- For this repository owner, direct GitHub installation clones the whole repo
  despite a skill subpath. The tracked spec/fixture content is about 2.8 GB. Use a
  lightweight acquisition path before installation; the existing sparse checkout
  or GitHub contents API can fetch only the consumer folder for a local `skills
  add`. A local-source install does not acquire GitHub update tracking by itself.

## Signing and update authenticity

Answered by the territory: Sparkle's [setup documentation](https://sparkle-project.org/documentation/#3-segue-for-security-concerns)
recommends Developer ID signing and notarization "if possible", separately from
signing update archives with Ed25519. Its [update validator](https://github.com/sparkle-project/Sparkle/blob/2.x/Sparkle/SUUpdateValidator.m)
explicitly permits ad-hoc app signing when authenticating through the update key.
A paid Apple Developer membership is therefore not needed for this update mechanism.

Recommendation, awaiting the remaining planning decisions: use Sparkle rather than
build another download/replacement engine. Embed the update public key in the app,
retain the private key for release signing, and serve signed update archives over
HTTPS through the existing tag-release workflow. The key does not depend on an
Apple account. Its retention and backup are necessary for future signed updates.

Update authenticity, Gatekeeper approval and capture permissions are distinct.
Current releases are ad-hoc signed; [local source signing](../../scripts/signing-identity.mjs)
can use a stable self-signed certificate, but the release packager currently
re-signs ad hoc. Neither path is notarization. Initial launch can still require
manual macOS approval. An actual old-to-new update must establish which signing
choice retains screen/microphone permissions; neither archive signatures nor an
unchanged bundle ID alone prove that behavior. No keychain trust or permission
settings have been changed during discovery.

## Open questions

Still in the known-unknowns stage of exploration:

- Release discovery: the current tag workflow makes every `v0.*` tag a prerelease,
  while onboarding resolves latest stable. Settle one meaning for normal releases.
- Final updater/signing choice, signing-key custody and recovery, and proof of
  permission continuity without paid Apple signing.
- Lightweight skill acquisition and source tracking through `npx skills`, without
  duplicating its agent/link logic or requiring a full media-repository clone.
- Read-only skill comparison procedure, diff format, and treatment of local extra
  files and upstream removals.
- Exact idle conditions, handling new requests during replacement, restart and
  update status available to agents.
- Recovery after failed download, replacement or startup, and compatibility of the
  retained library with the previous version.

Preferences and failure scenarios remain to be explored after these questions.
