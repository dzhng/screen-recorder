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
  and updates are explicit CLI actions; their usage and latest-skill checks belong
  in the consumer skill itself.

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

## Explicit skill management

Answered by the user; these commands are proposed contracts, not available CLI
features yet:

```sh
screenrec skills install [PATH]
screenrec skills update PATH --dry-run
screenrec skills update PATH
```

Install into the current repository's `.agents/skills/screenrec/` by default. An
explicit path selects another destination; update accepts a skill folder or its
`SKILL.md`. The existing consumer guidance also supports Claude's
`.claude/skills/screenrec/` location. The complete consumer folder, including
references, is the installation unit: updating only `SKILL.md` could leave its
instructions pointing at stale or missing resources.

Dry-run compares the selected local skill with the canonical upstream skill and
prints a diff without modifying installed files. Update explicitly permits replacing
local skill content; an agent can inspect the dry-run diff and apply selected
changes itself when preserving customization. The consumer skill must teach how
to check the latest canonical version, inspect that diff and perform an explicit
update. First-run README/skill setup must still work before the CLI is installed.

## Open questions

Still in the known-unknowns stage of exploration:

- Release discovery: the current tag workflow makes every `v0.*` tag a prerelease,
  while onboarding resolves latest stable. Settle one meaning for normal releases.
- Updater mechanism, authenticity verification and signing setup.
- Canonical skill source: latest repository `main` or a version tied to an app
  release; source identity shown in checks and diffs.
- Exact install/update path handling, diff format and treatment of local extra
  files and upstream removals.
- Exact idle conditions, handling new requests during replacement, restart and
  update status available to agents.
- Recovery after failed download, replacement or startup, and compatibility of the
  retained library with the previous version.

Preferences and failure scenarios remain to be explored after these questions.
