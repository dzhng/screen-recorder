# Automatic app and CLI updates

Installed releases download updates automatically and replace the app only when
existing work permits it. The bundle contains the executable CLI, Node, service
and workers, so they update together. Skill changes remain explicit through
`npx skills`. The [decision map](discovery.md) preserves product requirements and
attribution; the [consolidated choices](choices.md) describe implemented tradeoffs.
This spec remains active until accepted source is published and live delivery works.

## Next Agent Prompt

**Status:** production integration is complete; final acceptance and publication
remain open. Final artifact source is frozen at `4387da97`; accepted installed
executable payload `0dd14443` is unchanged. Evidence/docs-only followups may land
after the frozen source without moving its tag. Updated 2026-10-04.

The [final repository checks](assets/final-repository-checks.json) retain the full
run and narrow affected followups. Build, types, format, helper and focused native
gates passed; lint passed with warnings. App checks have 65 passes and 23 retained
source-app capture-permission/derived countdown-timeout failures. **Do not claim
the full suite green.** The user accepted existing permission proof and directed
no repeats; do not rerun those failures or describe them as missing production
fields. Finish final review, package the frozen payload and publish normally.

The final Docker matrix is **44/44**: eleven distinct cases, two agents and two
fresh trials, bound to consumer-source `4fbeee26` and unchanged consumer/case hashes
in [the retained receipt](assets/final-agent-matrix.json). It binds raw artifacts
and the production CLI bundling route. Its README acquisition uses a controlled
source mirror; live published-source onboarding still remains open.

The [installed acceptance receipt](assets/installed-acceptance.json), committed in
`964a8a20`, records passing upgrade and manual-recovery journeys. Both bind payload
`0dd14443`; upgrade runner `b079fffa` and recovery runner `80e989fd` preserve their
separate provenance. They prove scoped old-MCP exclusion, quiet replacement,
populated-library preservation and explicit reinstall after controlled successor
startup failure. Recovery restores version `0.1.2` with updates disabled. The
persisted-Off startup/quit arm now passes with controlled defaults; owner setter
persistence and staged cancellation retain their separate native/SDK proof.
Isolated identity/feed/home/lock substitutions do not establish published HTTPS
delivery. Repeat only what later product changes invalidate.

After final review and accepted-source packaging, use the committed manifest's
release version, push the accepted source and evidence/docs followups to main, and
tag exact frozen source `4387da97`. Let the existing release workflow publish.
Verify stable feed/archive redirects and live skill acquisition. **Main push, tag, published release and live-source
onboarding remain OPEN.** Archive only after those checks, through
[close-spec](../../.agents/skills/close-spec/SKILL.md). No additional release approval
or tester-feedback ceremony is required.

The user accepted prior permission continuity on 2026-10-04 and directed us not
to repeat it. Reuse that prerequisite; do not add recipient accounts, VMs, TCC or
Gatekeeper runs. Durable production signing/update keys are approved and provisioned
under [the custody contract](assets/signing-custody.md). Use isolated fixture
identities, app locations, defaults, account-lock namespaces and libraries; preserve
the user's installation and media.

## Integration and remaining acceptance

| Slice | Current state | Remaining work |
| --- | --- | --- |
| [01 Engine](slices/01-sparkle-replication.md) | Protected engine accepted; pinned patch is integrated. | Reuse its failure/cancellation proof; repeat only if engine inputs change. |
| [02 Signing](slices/02-signing-identity.md) | Durable identity provisioned; signing/restoration and release packaging integrated. | Final published artifact verification; no new permission run. |
| [03 Launcher](slices/03-launcher-replacement.md) | Fixed executable and account-home lock integrated; real old-MCP lifetime exercised. | Retain scoped installed evidence and final delivered-kit checks. |
| [04 Service](slices/04-service-admission.md) | Atomic admission and existing-owner progress integrated. | Retain full-run limits and passed affected checks without weakening the contract. |
| [05 Artifacts](slices/05-release-artifacts.md) | Signed kit/update/feed and GitHub semantic latest selection integrated. | Publish accepted source and verify delivered artifacts/redirects. |
| [06 Native](slices/06-native-coordination.md) | Native intent, permit, exclusion and clean EOF/exit joined; installed upgrade/recovery passed. | Bind final payload and preserve measured failure limits. |
| [07 Preference](slices/07-update-preference.md) | Settings and Sparkle-owned persistence integrated; controlled installed Off startup/quit passed. | Reuse separate setter/staged-cancellation proof; shots establish presentation only. |
| [08 Skill](slices/08-skill-lifecycle.md) | Explicit lifecycle integrated; final 44/44 portable matrix retained. | Live current-source acquisition after publication. |
| [09 Installed/release](slices/09-installed-acceptance.md) | Scoped upgrade and manual-recovery receipts retained. | Final review/package binding, publication and live verification; retain full-run limits. |

## One owner per concept

| Concept | Owner and invariant |
| --- | --- |
| Schedule, download, authentication, replacement and preference | Sparkle; no second scheduler, defaults store or updater daemon. |
| Installation opportunity | Native coordinator joins existing intent, service permit and acknowledged launch exclusion. |
| Accepted work/resources | Existing service owners expose blockers; private preparation atomically fences new admissions. |
| Status and private control | Shared protocol owns health projection and permit schemas; no public updater command family. |
| Library compatibility | Core owns catalog format; authenticated same-format updates only, without migration. |
| Version, signing and artifacts | Existing build/release owners derive finalized bundle/feed/receipt facts. |
| CLI entry | Fixed external launcher retains kernel exclusion through the entire CLI/MCP lifetime. |
| Skill discovery/refresh | Pinned upstream installer; complete pinned acquisition, read-only diff and explicit changes. |

Waiting for service/native work leaves ordinary operations and preview renewals
usable. Preparation either grants the current permit or reopens admission and
waits for existing-owner progress. Unknown prepare/release acknowledgement keeps
native intent fenced until explicit quit/reopen. A busy launcher ends the current
SDK cycle; Sparkle owns the next attempt, with no reader-exit scheduler.

Only acknowledged exclusion permits service pipe EOF. Clean child exit precedes
final SDK authorization and app-owned termination. Post-EOF failure cannot reopen
that service or launch a competing successor; recovery is manual. Ordinary quit
keeps its existing capture-finalization semantics and never installs a staged
candidate. [The choices ledger](choices.md) walks these cases in full.

## Evidence and scope

Frozen engine/source and signing inputs live under [assets](assets/).
[Protected engine proof](assets/protected-engine-proof.json),
[signing boundary](assets/signing-boundary.json),
[launcher lifetime](assets/launcher-lifetime-proof.json) and
[Settings review](assets/update-settings/README.md) remain scoped observations.
The [installed receipt](assets/installed-acceptance.json) names its identity/feed/defaults
substitutions; exact production archive smoke checks identical signed app trees and loads bundled code
without touching real-account preferences. Neither replaces published delivery.

Keep source and artifact identities with evidence. A source/version change
invalidates only the behavior it can move; an evidence-only commit does not
rewrite an earlier payload identity. Preserve original failures and unverified
scope. Generated bundles, media and raw transcripts stay outside source; retain
compact receipts and reproducible inputs.

Every behavior fix follows [write-tests](../../.agents/skills/write-tests/SKILL.md).
[AGENTS.md](../../AGENTS.md) owns narrow checks and the final full run. Visual
changes need before/after and reference comparison, an unprimed critique and user
preview. No automatic skill edits, model downloads, media edits, catalog rebuild,
permission grants, new update server or custom postlaunch rollback is introduced.
