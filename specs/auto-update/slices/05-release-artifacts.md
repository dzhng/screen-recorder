# 05 — Package one authenticated release candidate

Unlock: the existing tag workflow produces coherent fresh-install and auto-update
artifacts. Depends on 01–03 for the engine/signing/launcher recipes.

## Seam and artifact

Use existing [build](../../../scripts/build-macos.mjs),
[release](../../../scripts/release.mjs) and
[tag workflow](../../../.github/workflows/release.yml), not a second release tool.
Export catalog format from its existing [core owner](../../../packages/core/src/catalog.ts).
The app manifest supplies versions; core supplies format. Derive bundle metadata,
release receipt, bundled service runtime metadata and `screenrecCatalogFormat`
in the feed from these inputs. Health consumes those bundled facts rather than
maintaining another version/format constant.

Artifact facts: `{version, revision, catalogFormat, architecture, minimumMacOS}`,
bundle version, archive digest and signing identity. Stable bundle/feed comparison
version is the numeric manifest version; keep user display version aligned.
Old bundles with fixed build version 1 have no updater and enter through manual
bootstrap; do not invent ordering compatibility against that old value.
Normal `vMAJOR.MINOR.PATCH` tags including `v0.*` publish stable; suffixed tags
publish prerelease and never enter latest stable discovery.

Keep the app-plus-coordinated-launcher install kit; add app-only Sparkle ZIP and
signed `appcast.xml`. Sign finalized feed bytes **after** adding custom metadata,
using supported upstream tools. Feed URL remains GitHub latest/download/appcast.xml.
Keep existing `SHA256SUMS` scoped to the install kit and receipt: onboarding
fetches only those before verifying every listed entry. Feed/update ZIP authenticity
comes from Sparkle signatures. Keep app trees in the install kit and update ZIP
identical, including signed metadata and helpers. Upload all assets to a draft
before publishing; delegate latest stable selection to GitHub’s semantic-version
policy so a delayed older draft cannot force the update feed backward. Prereleases
never become latest. Never mutate published assets or tags. No server,
tester-feedback stage or rollout channel is introduced.

Only release packaging injects feed URL/public update key and enables the updater;
source/personal builds remain inert despite the source plist sharing release ID.
Use distinct IDs or isolated test accounts for installed lab bundles so Sparkle
never writes the user's release defaults.

Human artifact: inspectable release directory/receipt and a relocation report.
The one-time manual bootstrap installs app plus launcher; old released apps cannot
retrofit themselves. Personal source identity/host-runtime installation stays manual.

## Proof

Extend `scripts/release.test.mjs` with failing real packaging/publication fixture
cases before changes; use narrow script checks before native packaging:

- Tag/manifest/bundle/feed/receipt versions agree and newer stable ordering works.
- Authenticated feed format matches the actual packaged core/bundle format; omitted,
  changed or forged metadata fails the contract before publication/installation.
- Final archive/feed verification succeeds; tampering fails. Preserving nested code,
  helpers, symlinks and modes does not get overwritten by current ad-hoc re-signing.
- Missing durable signing inputs fails the release build before publication. Private
  material never enters archives, receipts, stdout/stderr or evidence. Import
  CI signing identities only into a temporary keychain and clean it up afterward.
- Documented fresh install verifies successfully when only kit, receipt and checksum
  file are downloaded; source/personal builds make no updater feed requests.
- Normal/prerelease classification and all-assets-before-publish run through the
  workflow's real publication logic with fixture commands, not a duplicate oracle.
- Relocation uses bundled Node and the fixed launcher proved in 03; bootstrap backup
  and recovery instructions preserve home/library and unrelated settings.

Keep release-input integrity and immutable-publication checks green. Run existing
`scripts/release-smoke.mjs` only for a newly assembled native artifact; update
focused CI coverage for the changed owners. An empty relocation smoke is not an
installed-update or populated-library proof.

## Verdict and freedoms

Delegated: internal helper structure, asset basenames and CI secret names consistent
with the existing workflow. Credential handoff: prepare the exact public-key embed,
private-key backup/export/import and isolated CI-signing steps; implement with
actual authorized credentials, never a checked-in placeholder. Version/trust/source
ownership and one-time bootstrap are fixed. Human review inspects receipt/feed and
bootstrap commands; paid signing or a new release ceremony is out of scope.

## Source checkpoint — 2026-10-04

The release pipeline now derives runtime and receipt facts from the app manifest
and exported core catalog format. Release packaging requires supplied durable
credentials, uses the proved temporary-keychain signing recipe, and assembles
app-only/authenticated-feed and app-plus-fixed-launcher artifacts from one signed
app tree. The production launcher holds the persistent account lock before loading
Node or CLI and until that process ends. Normal version tags publish stable,
including the selected next version `0.1.3`; suffixed tags remain prerelease.

Focused script proofs cover missing signing inputs, omitted/stale built catalog
facts, production launcher lock lifetime and startup refusal, upload-before-publish,
stable classification, immutable published assets and update receipt tampering.
Disabling launcher flock or built metadata validation made their respective checks
fail. The package links the exact protected r3 framework; the real SDK manifest
and its frozen build receipt were inspected without another framework build.

Native sources and durable credentials are now integrated. Finalized signed
kit/update/feed packaging, identical extracted app-tree comparison and relocated
archive smoke are implemented; the isolated installed journey separately exercises
the assembled host/helper/launcher path. This does not establish published artifact
readiness. Slice 09 owns final accepted-source packaging, publication and HTTPS
redirect verification. Permission continuity is an accepted prerequisite;
this pass does not repeat it or claim a new recipient/Gatekeeper observation.

Integration refinement: launcher coordination resolves the passwd account home,
matching Foundation/Sparkle even when `HOME` selects a different default app
location. The launcher also shares the helper's single-link/inode validation.
Its regression substitutes only the passwd API at compile time so fixture state
stays in scratch storage; production has no runtime account-home override.

The exact-archive smoke does not execute the signed production host or launcher:
their update preferences and lock belong to the real account. It verifies both
signed app trees and the launcher signature, compares files/modes/links, and loads
bundled Node schema help plus native ping after relocation. Host/service/update
and coordinated launcher execution are proved in the separately identified
installed fixture. This reduced smoke is an explicit accepted scope boundary,
not installed-update acceptance.
