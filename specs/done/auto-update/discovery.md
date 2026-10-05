# Automatic updates: four-quadrant map

Status: completed discovery record; implementation has not started. The
[implementation ladder](README.md) now owns pickup order, refinements and proof status.
This map preserves settled product decisions and their attribution. Publishing remains
version, tag, [release](../../../scripts/README.md#versioned-github-releases), without
a tester rollout or release approval process.

## Known knowns

Confirmed by the user:

- Download automatically, install when idle, and provide an opt-out. Accepted
  work must finish without interruption.
- Update the application and actual CLI together. Skills update only explicitly.
- Use `npx skills` directly. The canonical project folder is
  `.agents/skills/screenrec`; other agents' skill paths link there. Whole agent
  configuration directories remain separate.
- Latest skill content comes from repository `main`, independently of releases.
  The skill itself teaches installation, latest-version checks and read-only
  comparison before explicit replacement or surgical edits.
- No Apple Developer membership or Developer ID certificate is available or
  required. Initial macOS approval is distinct from update authentication.

Established by the territory:

- The [release packager](../../../scripts/release.mjs) bundles Node, CLI, service and
  workers in the app. Its external launcher resolves bundled executables from
  `SCREENREC_APP` or the default location. One bundle replacement can update
  these components together without separately installing a CLI runtime.
- The [native app](../../../apps/macos/README.md) owns the service lifetime. The
  [library layout](../../../packages/protocol/src/layout.ts) lives outside the app.
  Source media must stay intact; installing a build must not migrate a library.
- Existing releases contain no updater. Current
  [onboarding](../../../skills/screenrec/references/installation.md) is manual;
  the new skill instructions described here have not shipped.
- Sparkle supports Ed25519-authenticated updates without paid Apple signing.
  Its [setup guide](https://sparkle-project.org/documentation/) recommends
  Developer ID/notarization “if possible”; its
  [validator](https://github.com/sparkle-project/Sparkle/blob/2.x/Sparkle/SUUpdateValidator.m)
  permits ad-hoc signing authenticated by the update key. This does not prove
  Gatekeeper or capture-permission continuity.

## Known unknowns: decision ledger

The user opted into answering remaining planning choices on their behalf.
Delegation covers this walk, not implementation. Confirmed preferences are quiet
updates, one delivered app/CLI product, explicit skill changes, upstream tools,
simple releases and no paid Apple prerequisite.

Each agent entry is **Answered by the agent on your behalf**; its reason records
which preference it follows. OPEN entries name the evidence that will resolve them.

| Question | Decision and reason | Closed by |
| --- | --- | --- |
| Update engine? | App-owned Sparkle; reuse its installer, scheduler and persistent preferences rather than creating another updater. | Agent: upstream tools, simplicity |
| Scheduling and opt-out? | Automatic checks/downloads enabled; install at a safe idle opportunity. Reuse Sparkle's default interval and opt-out preferences, exposed in app settings. | User: automatic/idle/opt-out; agent: reuse defaults |
| Stable release meaning? | Ordinary `vMAJOR.MINOR.PATCH` tags, including `v0.*`, are stable. Explicit suffixed prereleases stay out of the stable feed. | Agent: a release is a release |
| Feed and artifacts? | Upload `appcast.xml` and a signed app-only ZIP before publishing the same stable GitHub release. Feed URL: `https://github.com/dzhng/screen-recorder/releases/latest/download/appcast.xml`. Keep the fresh-install app-plus-launcher kit. A latest-item feed suffices while automatic updates require the same library format. | Agent: existing tag workflow, no update server |
| Signing and keys? | Embed an Ed25519 public key; back up the private key outside CI and supply it as a release secret. Use a stable self-signed app identity without paid membership. Losing the update key may require manual reinstall; do not assume Developer ID-assisted rotation. | Territory: Sparkle authentication; agent: no paid prerequisite, simple recovery |
| App/CLI coupling and bootstrap? | Keep bundled executable paths and the launcher contract stable. One-time manual bootstrap installs the updater and coordinated launcher. Personal source builds retain their separate identity and manual installation. | Agent: one product, no parallel installers |
| What means idle? | No pending/countdown/active/finalizing capture, accepted requests, queued/running work, model preparation, publication, deletion, retained package/delivery/preview resources or native save intent. Drain existing owners and fence new work atomically before replacement; do not cancel work to obtain idle. | Agent: no interruption; territory: lifecycle owners |
| Requests during replacement? | Reject before dispatch with retryable `UPDATING`; accepted mutations are never automatically replayed. Pause native observation polling during the gate. Existing resources may finish/release; acquiring or renewing resources must not race committed replacement. | Agent: preserve work, avoid starvation |
| Agent-visible state? | Add update state, available version and concrete blockers/errors to existing `service.health` through the shared protocol. During disconnected replacement, transport failure may still occur. No separate updater command family. | Agent: JSON-first CLI, one contract |
| Library compatibility? | Automatically install only a candidate with the same catalog format, declared in authenticated candidate metadata and derived from the catalog owner. Missing/incompatible metadata blocks installation. No automatic migration, deletion or reconstruction. | Territory: catalog refuses other formats; agent: preserve library |
| Failure recovery? | Download/authentication failure leaves the installed app intact. Failed clean drain defers installation and restores admission. Reuse and prove Sparkle's replacement recovery. After new-app startup failure, provide manual reinstall guidance using retained release assets; no custom rollback daemon or promise of postlaunch rollback. | Agent: simple recovery, preserve work |
| Lightweight skill source? | Fetch the complete consumer folder at a resolved `main` commit with sparse checkout or GitHub contents API, then use local `npx skills add` in symlink mode for discovery/links; never `--copy`. Refresh repeats fetch → compare → explicit add. Local installs have no remote update tracking. | Agent: upstream linking without cloning media |
| Comparison and customization? | Stage the whole folder in scratch state; display textual diffs, additions, removals and local extras. Read-only comparison changes neither installed files nor metadata. Surgical edits preserve custom files. Explicit replacement backs up and replaces the entire canonical folder through `npx skills`, including removing local extras/upstream deletions; verify links and preserve unrelated agent settings. | User: explicit/surgical updates; agent: clear overwrite semantics |
| Safe upstream inspection? | Do not advertise `skills check` or `update --dry-run` as read-only. `check` updates; the inspected version has no implemented dry-run. | Territory: published `skills` 1.7.0 |

## Unknown knowns: extracted context

Two concrete proposals drew useful corrections: a tester-feedback spec added
process the user did not want, and bespoke skill commands duplicated the upstream
installer. Those reactions establish ordinary releases and reuse as preferences.

Consumers are external agents using the skill and CLI. The runtime target is
Apple Silicon/macOS 26+, established by [onboarding](../../../README.md#agent-setup).
Docker exercises portable agent behavior; it cannot prove macOS updates or
permission retention. Done means quiet app/CLI replacement, a usable existing
library, finished accepted work, and one canonical skill folder after explicit
skill management.

Illustrative proposed field inside the existing health result, using fake data;
this is not a shipped response or final schema:

```json
{"update":{"state":"waiting","availableVersion":"0.1.3","blockers":["recording"]}}
```

This expresses the delegated choice to expose evidence without making agents
manage another release lifecycle. Implemented schemas and operation help remain
authoritative. Opt-out controls updating; it grants no capture permission and
authorizes no skill changes, model downloads or media edits.

## Unknown unknowns: landmines

At source revision `c960af65`, read-only scans covered release/build/install/signing,
launcher/discovery, catalog/library boundaries, native/service lifetime, both service transports,
jobs/workers, model work, capture, exports, deletion, packages, delivery and native
preview/save/countdown ownership. Sparkle docs/source and `skills` 1.7.0 were also
inspected. This is boundary discovery, not an executed installed-upgrade test.

| Finding and evidence | Why it bites; disposition |
| --- | --- |
| [Service close](../../../apps/service/src/project-service.ts#L114) aborts model work and revokes leases; [job idle](../../../packages/core/src/jobs.ts#L985) ignores queued jobs and shutdown interrupts attempts. | Ordinary quit/idle can destroy accepted work. **Decided:** admission/drain gate over existing owners. |
| [Socket](../../../apps/service/src/index.ts#L83), [control dispatch](../../../apps/service/src/control.ts#L77) and [native controls](../../../apps/macos/Sources/ScreenRecorder/RecordingControls.swift#L231) admit through different paths. | Status snapshots race new work; countdown precedes the service request. **Decided:** fence every admission path, including native intent. **OPEN:** race proof. |
| [Launcher](../../../scripts/release.mjs#L148) loads bundled Node/CLI before connecting to the service. | A service gate cannot protect file loads during replacement; running clients may retain old code. **OPEN:** coordinate launcher loading/swap and long-lived MCP/CLI clients; prove no partial bundle or unsafe mixed release. |
| [Capture](../../../apps/macos/Sources/ScreenRecorder/CaptureController.swift#L68), [save chooser](../../../apps/macos/Sources/ScreenRecorder/ExportController.swift#L43), [preview](../../../apps/macos/Sources/ScreenRecorder/PreviewController.swift#L88), [delivery](../../../apps/service/src/delivery.ts#L22) and [package handles](../../../apps/service/src/package-registry.ts#L73) outlive requests. | “No active request” is insufficient; preview renewals/polling may prevent idle. **Decided:** keep legitimate blockers, gate new acquisition, use existing release/expiry semantics; never revoke to update. |
| [Native quit](../../../apps/macos/Sources/ScreenRecorder/main.swift#L162) finalizes capture; [service shutdown](../../../apps/macos/Sources/ScreenRecorder/ServiceHost.swift#L210) escalates to signals. | Updater quit could stop a recording or kill work. **Decided:** idle before updater shutdown; failed drain defers rather than forcing termination. **OPEN:** all Sparkle install paths, including ordinary quit. |
| [Catalog](../../../packages/core/src/catalog.ts#L29) refuses other persisted formats without migration. | Successful replacement can leave a library unusable. **Decided:** same-format automatic updates only; validate authenticated candidate metadata first. |
| [Plist](../../../apps/macos/Info.plist#L11) fixes build version; [builder](../../../scripts/build-macos.mjs#L88) writes only display version. | Sparkle needs increasing comparable versions. **Decided:** derive stable bundle/feed versions from the app manifest and verify agreement. |
| [Workflow](../../../.github/workflows/release.yml#L88) makes all `v0.*` tags prerelease while onboarding uses latest stable. | Published versions disappear from normal discovery. **Decided:** align normal-tag publication and feed; publish all assets together from draft. |
| [Packager](../../../scripts/release.mjs#L137) re-signs ad hoc; [personal installer](../../../scripts/install-personal.mjs#L97) uses separate identity and can reference host Node. | Stable signing can be overwritten; app swap cannot repair a host-bound launcher. **Decided:** preserve release signing and bootstrap once. **OPEN:** permission continuity. |
| Sparkle [customization](https://sparkle-project.org/documentation/customization/) and [delegate](https://github.com/sparkle-project/Sparkle/blob/2.x/Sparkle/SPUUpdaterDelegate.h) provide deferred install-on-quit with an immediate-install block. | Default silent install waits for quit; a relaunch delegate is not a universal gate. **Decided:** invoke the install block only when our gate permits it; verify quit paths. |
| [Programmatic setup](https://sparkle-project.org/documentation/programmatic-setup/) needs framework/helper embedding outside Xcode. | Lost symlinks, executable modes, rpath or incompatible library validation can break a relocated app. **OPEN:** pin Sparkle and prove packaged helper execution/signatures. |
| Published [skills CLI](https://github.com/vercel-labs/skills) clones this whole repo for direct GitHub sources, may fall back to copies, and lacks read-only update mode. | Media clones, independent copies or accidental updates violate the contract. **Decided:** pinned lightweight fetch, scratch diff, local add and link verification. A scratch probe verified canonical installation, Claude links, references, overwrite and unrelated settings. Updated instructions/evals remain **OPEN**. |

## OPEN implementation proofs

Close these with evidence during implementation, not another preference interview.
A failed proof reopens its affected decision and is recorded here.

- **Sparkle integration:** pin a supported release/license; prove framework/helpers,
  archive authentication before extraction, version ordering, GitHub redirects/feed
  discovery, opt-out persistence and install-block behavior. Check ordinary quit
  while an update is staged.
- **Admission and replacement:** exercise queued/running/cancel-cleanup work,
  leases, native intent and new arrivals at the commit boundary. Prove clean drain
  or safe deferral, coordinated launcher loading, long-lived clients, replacement
  failure recovery and relaunch without capture. Select launch/swap synchronization
  only after this probe.
- **Existing library:** upgrade a disposable populated library; show unchanged
  original media and usable recording/project/job data. Reject incompatible or
  missing format metadata before replacement. Empty-library smoke is insufficient;
  do not probe on the user's library.
- **Signing and permissions:** provision/back up keys during implementation, then
  perform real old-to-new upgrades. Test ad-hoc bootstrap and repeated stable-identity
  releases; observe screen/microphone permissions and Gatekeeper. If permissions
  need user action, document it instead of claiming continuity.
- **Failure limits:** prove failed download/signature/replacement leaves a usable
  installation. Expose startup failure/manual recovery honestly. Establish which
  previous releases can read the retained catalog; do not promise arbitrary
  downgrade or Sparkle postlaunch rollback.
- **Skill instructions/evals:** update README and consumer skill together. Verify
  first install without app CLI, pinned read-only full-folder diff, additions/
  removals/extras, surgical edits, backed-up replacement, agent discovery and real
  links. Run Claude/Codex in disposable Docker projects; confirm supported
  `npx skills` behavior/version before prescribing commands. Node/npm availability
  for `npx` is a separate prerequisite from the app's bundled runtime.

## Superseded kickoff

The original build-and-release prompt is superseded by the implementation ladder's
[Next Agent Prompt](README.md#next-agent-prompt). This record does not independently
start implementation or publishing. The ladder refines authenticated metadata to
require a signed feed and adds transport-reply and staged-opt-out proofs.
