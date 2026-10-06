---
name: release
description: Release this repository's current work to everyone. Use when the user asks to ship a version, push to main and tag, or publish an app update.
---

# Release

Carry the scoped work through review, main integration and a published release.
Read the [release guide](../../../scripts/README.md#versioned-github-releases)
for the process; use its linked code as the authority for commands and packaging.

1. Fetch main and tags. Preserve unrelated work and integrate the intended changes
   with current main. Run [review](../review/SKILL.md) over the complete release diff;
   reuse valid checks and verify integration fixes narrowly.
2. Choose the next unused version from the manifest and published releases unless
   the user supplied one. Update the [app manifest](../../../apps/macos/package.json)
   and [release notes](../../../scripts/release-notes.md), then commit.
3. Validate version/tag agreement through the release tool. Push main and an
   annotated version tag. Never force-push main, move a published tag or replace
   published assets.
4. Prefer building on an available Apple Silicon Mac and uploading directly to
   GitHub Releases through the publication owner. Use the
   [tag workflow](../../../.github/workflows/release.yml) as the checklist for
   preparation, signing, packaging and relocated smoke/media checks; local builds
   must satisfy the same gates. Cancel the tag-triggered Actions run before local
   publication so there is only one publisher. Use Actions when no suitable local
   Mac is available or the user requests it.
5. Build from the tag's exact commit. If main advances, use a temporary checkout
   pinned to the tag; preserve unrelated work. Reuse valid prepared dependencies,
   keep build output private to its source checkout, and verify the package receipt
   matches the tag before publishing the complete asset set. Remove the temporary
   checkout afterward.
6. Verify the public release and its assets. If installation was requested,
   follow the consumer installation procedure linked by the release guide, using
   the downloaded published kit; verify checksums, installed version and service
   health without recording or granting capture permissions.
7. Finish with the version, main commit and release URL. A pushed tag alone is
   not a published update; report any publication blocker and unverified limits.

## Signing credentials

- Reuse the production signing certificate and Sparkle key. A product or repository
  rename does not require rotating either, even if the certificate subject carries
  the old name. Missing local credentials are a restore task, not a reason to
  generate replacements. GitHub Actions secrets cannot be read back for local use.
- Follow the release signing owner for credential inputs. Keep secret files
  restricted and pass secrets without printing them or placing them in shell
  history, logs, source control or release assets. Keep personal backup locations
  and private restore instructions outside the repository.
- Rotate only when necessary. If credentials change, update the private backup
  and restore instructions, GitHub credentials and public fingerprints together;
  verify a future developer can restore and sign, and preserve update trust.
