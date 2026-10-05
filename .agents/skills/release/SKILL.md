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
4. Follow the [tag workflow](../../../.github/workflows/release.yml) through build
   and publication. Fix actionable failures; retry only after understanding them.
   The workflow owns signing, packaging, update-feed publication and release checks.
5. Finish with the version, main commit and release URL. A pushed tag alone is
   not a published update; report any publication blocker and unverified limits.
