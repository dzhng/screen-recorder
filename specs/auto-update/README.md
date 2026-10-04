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

## Existing boundaries

The [release packager](../../scripts/release.mjs) places CLI code, service and Node
inside the app. Its separate launcher executes the selected app's bundled CLI.
Replacing the app therefore updates the executable CLI code; any required launcher
change must also be accounted for. The installed consumer skill is a separate copy.

The [app](../../apps/macos/README.md) owns the service child's lifetime. The updater
must coordinate replacement with that owner and preserve library and source media.
Current installation and upgrades follow the consumer skill's
[manual installation guide](../../skills/screenrec/references/installation.md).
No Sparkle integration exists. Released bundles are ad-hoc signed and not notarized.

## Open questions

Still in the known-unknowns stage of exploration:

- Release discovery: the current tag workflow makes every `v0.*` tag a prerelease,
  while onboarding resolves latest stable. Settle one meaning for normal releases.
- Updater mechanism, authenticity verification and signing setup.
- Whether agent skill updates belong in this scope.
- Exact idle conditions, handling new requests during replacement, restart and
  update status available to agents.
- Recovery after failed download, replacement or startup, and compatibility of the
  retained library with the previous version.

Preferences and failure scenarios remain to be explored after these questions.
