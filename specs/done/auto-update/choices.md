# Implementation choices

This ledger describes the shipped updater and its release-tooling followups.
The [decision map](discovery.md) retains the user's requirements and planning
attribution. This document records the implementation choices the user now owns;
[the evidence](README.md#evidence-and-limits) owns verification and publication status.

Review the three medium-confidence tradeoffs first: an uncertain private
acknowledgement requires manual restart, a live MCP reader ends the current update
cycle, and one account lock couples every released app copy. These are implemented
limits, not provisional mechanisms awaiting another slice. No unresolved user-only
choice remains in this ledger. Verification status does not change these product
contracts.

## Sound — medium confidence

### Uncertain admission acknowledgement keeps the app fenced

- **When:** native integration, `8e5fbf4c`.
- **The choice:** The app asks the service for a permit: a private reference that
  temporarily prevents new product requests. If the answer is lost, the app cannot
  know whether the service granted that reference. It keeps native actions fenced
  and reports `UPDATE_RESTART_REQUIRED`, telling the person to quit and reopen.
  The same rule applies when the answer to releasing a known reference is lost.
  The alternative would guess that the service's deadline or cleanup succeeded,
  resume native actions, and possibly act while the service still refuses work.
- **The gap:** The plan required safe lost-answer handling without deciding whether
  the native app would recover automatically after the service's deadline.
- **The reach:** A service-side uncommitted permit may expire, but expiry alone
  does not reopen native controls. Ordinary quit remains available; there is no
  hidden prepare retry, competing service or automatic successor launch.
- **Verdict:** sound; uncertainty cannot establish restored admission.
- **Confidence:** medium; this favors an explicit restart over automatic recovery.

### A busy CLI reader ends this attempt; Sparkle owns the next attempt

- **When:** protected engine and production driver integration.
- **The choice:** An agent leaves an MCP session open between requests. MCP is the
  CLI's long-lived tool-server mode; its Node process still reads the old bundle.
  Sparkle, the update library, fails to acquire exclusive launch exclusion, ends
  its current update cycle, and the native coordinator releases service admission. The old app stays
  usable. When that agent eventually closes, no new reader-exit scheduler wakes
  installation immediately; Sparkle's next scheduled cycle can try again.
- **The gap:** Safe reader deferral was specified, but neither prompt retry after
  reader exit nor a second scheduler was required.
- **The reach:** Updater errors use `retryable:false`. This means there is no public
  updater request for an agent to replay; it does not mean Sparkle can never retry.
  The shared launcher refusal `UPDATING` remains a separate, retryable startup error.
- **Verdict:** sound; one scheduler owns retries and no agent kills a valid reader.
- **Confidence:** medium; safe deferral can wait until a later SDK check.

### One persistent account lock covers every release app path

- **When:** production launcher agreement and account-home correction, `d3da79a2`.
- **The choice:** The same person launches two copies of the released app, or uses
  a symlink to one. Every coordinated launcher uses the persistent account-owned
  `Library/Caches/com.david.screenrec/launch.lock`. A shared kernel lock allows
  multiple CLI readers; an exclusive lock permits replacement only after those
  readers finish. Both launcher and Sparkle use the account home, even when `HOME`
  selects another default app location. Separate copies therefore defer each other.
- **The gap:** The measured mechanism did not choose how aliases or multiple app
  copies should identify their common installation lifetime.
- **The reach:** The external launcher and signed host metadata must continue to
  agree. Neither may unlink the lock: replacing its inode would create a second
  kernel object and allow two supposed owners at once. Scratch fixtures have their
  own account-relative namespace; production has no runtime lock-path override.
- **Verdict:** sound; a single account owner avoids path hashing and a copy registry.
- **Confidence:** medium; simplicity deliberately couples separate release copies.

### Deadlines revoke permission without pretending ownership expired

- **When:** protected engine acceptance.
- **The choice:** The update library's installing callback is paused while its helper waits for the
  app to terminate. After its bounded termination budget, the helper requests
  cancellation. It retains exclusion until the host suppresses the callback and
  closes its transferred lock, and any pending descriptor transfer is acknowledged.
  A timer cannot make an already-delivered kernel object disappear. Quiet relaunch
  also has a bounded acknowledgement deadline; failure reports the installed app's
  startup limit rather than inventing a rollback.
- **The gap:** Bounded failures were required, but the helper budgets and the
  distinction between a deadline and actual lock release were unspecified.
- **The reach:** A paused live host can retain exclusion until it resumes or exits.
  Future timeout changes must preserve cancellation acknowledgement, not merely
  pick a duration long enough for one successful run.
- **Verdict:** sound; elapsed time ends an attempt, not its outstanding authority.
- **Confidence:** medium; bounded attempts can still require manual recovery.

### Durable release credentials use the approved private custody

- **When:** owner-authorized provisioning, `6a036795`.
- **The choice:** The owner approved a private local folder and repository release
  secrets. That folder now contains the encrypted app-signing identity, its password
  and a separate updater signing key. CI imports those same credentials; it does
  not create a new certificate for each release. The owner can copy the folder for
  backup, but no off-machine backup is claimed. The alternative would silently
  regenerate identities or impose a new password-manager or physical-device gate.
- **The gap:** Stable keys were required without prescribing their custody location
  or CI transfer. The owner subsequently authorized the concrete arrangement.
- **The reach:** The [custody contract](assets/signing-custody.md) and
  [public identity](assets/release-identity.json) are current, not proposed inputs.
  Losing the updater key may require manual bootstrap; same-named new certificates
  do not preserve the old app-signing identity.
- **Verdict:** sound; approved durable custody keeps private material outside source.
- **Confidence:** medium; backup placement remains the owner's responsibility.

### Complete hashes accompany bounded judge text

- **When:** eval folder-receipt integration.
- **The choice:** An agent replaces a customized skill containing long references.
  The separate judge receives every file's full SHA-256 fingerprint and each
  symlink target, plus beginning/end text excerpts. A fingerprint covers every
  byte, so unchanged files and backups can be compared even though prose is
  abbreviated. Supplying every long file repeatedly could exhaust the judge input.
- **The gap:** Actual file/link evidence was required without defining its bounded
  representation.
- **The reach:** Excerpts explain a change; full hashes establish byte equality.
  Future receipt changes must preserve all hashes and link facts. Disposable Node
  compilation caches are disabled rather than mistaken for task output.
- **Verdict:** sound; bounds prose without dropping full-file identity.
- **Confidence:** medium; bounded excerpts cannot themselves prove every changed hunk.

### Runtime metadata identifies the service actually reached

- **When:** service admission and release assembly.
- **The choice:** An old CLI connects to a new service. Health reads the version
  from the service's adjacent runtime manifest, so it reports the running service,
  not the caller's version or some checkout on disk. The app builder supplies
  version, source revision and catalog format from existing owners. A standalone
  service with absent version metadata reports null; a personal app build can have
  version metadata while its updater remains unavailable.
- **The gap:** The plan required owner-derived identity without selecting the
  existing manifest as the loading boundary.
- **The reach:** Packaging validates those built facts against committed source.
  An update-health reply does not claim that a live old CLI process has upgraded.
- **Verdict:** sound; the reached runtime owns its identity independently of clients.
- **Confidence:** medium; null remains an intentional standalone fallback.

### Keep SwiftPM's existing native output contract explicit

- **When:** Xcode 27 build integration, `0dd14443`.
- **The choice:** Existing checks locate Swift modules, object files and debug
  executables in SwiftPM's native layout. Xcode 27 selects a different default
  engine, so a successful build could leave those consumers looking in the wrong
  place. Builds and owning checks now explicitly select the native engine. The
  alternative would migrate every consumer to the new engine's artifact contract.
- **The gap:** The repository depended on an old default without naming it.
- **The reach:** This applies to production compilation and existing native checks,
  not only a Settings fixture. If upstream removes this deprecated option, migrate
  the artifact consumers together rather than add another competing output path.
- **Verdict:** sound for the current toolchain; makes an existing contract explicit.
- **Confidence:** medium; a future toolchain change still needs deliberate migration.

## Sound — high confidence

### The installed launcher is a fixed executable, not the research wrapper

- **When:** release pipeline, `6f3ceec0`, and account-home integration.
- **The choice:** The install kit ships the C launcher from
  [its production owner](../../../scripts/launcher/main.c). Before reading Node or
  CLI from the replaceable app, it acquires shared exclusion and passes that open
  descriptor through `exec` into Node. Node retains exclusion for the complete CLI
  or idle MCP lifetime; process exit releases it. The shell bootstrap and lock
  wrapper in the launcher lab remain research inputs, not installed components.
- **The gap:** The successful reader experiment did not itself choose or authorize
  a shipped launcher before actual installer ownership was established.
- **The reach:** Automatic updates replace the app's Node, CLI, service and workers
  together, leaving this external launcher in place. Older releases require one
  manual app-plus-launcher bootstrap. A future launcher contract change is another
  explicit bootstrap, not hidden negotiation or forced client termination.
- **Verdict:** sound; the production executable reuses the proved lifetime boundary.
- **Confidence:** high.

### Pre-dispatch launcher failure has its own fixed identity

- **When:** release launcher implementation.
- **The choice:** An agent asks for help while the installer holds exclusive
  exclusion. The launcher has read no bundled code and parsed no user request, so
  it emits operation-shaped JSON with `id: "launcher"`, retryable `UPDATING`, and
  exit 75. Loading the CLI merely to obtain a request ID would violate that boundary.
- **The gap:** The plan required a framed startup refusal without naming an identity
  for a request that has not started.
- **The reach:** This bounded refusal is not a dispatched mutation. Consumers retry
  after replacement without assuming the original write reached the service.
- **Verdict:** sound; startup evidence remains distinct from operation execution.
- **Confidence:** high.

### The real installer transfers its actual locked kernel object

- **When:** protected engine acceptance and native integration.
- **The choice:** The helper obtains exclusive exclusion, then sends an open file
  descriptor through NSXPC, the existing macOS process connection. The host keeps
  another reference to the same locked kernel object. If the helper dies before
  a paused callback runs, the host still excludes new readers. Cancellation drains
  both callback permission and pending descriptor-transfer acknowledgement before
  confirming release. Reopening the file path would acquire a different reference
  with no proof that the original helper still protects it.
- **The gap:** The public SDK could not preserve exclusion through helper failure
  and delayed callback delivery.
- **The reach:** Every install/cancel route must close retained copies deliberately.
  Channel failure is not a successful cancellation acknowledgement; neither a
  timestamp nor a host-only lock can replace this ownership.
- **Verdict:** sound; authority follows the actual kernel object across process loss.
- **Confidence:** high.

### The app alone quits after clean service exit and final authorization

- **When:** protected engine and native integration.
- **The choice:** A candidate is ready, native intent is idle, and the service has
  granted and committed its permit. The app requests installation. Only the SDK's
  installing callback acknowledges launch exclusion. The app then closes its
  service pipe, observes a clean child exit, and invokes the retained callback to
  request final replacement permission. Only its final acknowledgement allows the
  app to terminate itself. The helper sends no queued quit event.
- **The gap:** Upstream helper-requested quit did not respect the service's
  irreversible shutdown boundary.
- **The reach:** The ordering is:
  ```text
  native idle + committed service permit
  → SDK acknowledges held launch exclusion
  → service pipe EOF → observed clean child exit
  → SDK final authorization acknowledgement → app quits → replacement
  ```
  Ordinary user/system quit retains its own capture-finalization semantics; it
  never promotes a staged candidate to installation.
- **Verdict:** sound; each owner proves its own obligation before irreversible work.
- **Confidence:** high.

### Failure after service EOF requires manual recovery

- **When:** native integration and consumer recovery guidance.
- **The choice:** The app closes the service's control pipe, which irreversibly
  starts shutdown. If the child stalls or installation stops afterward, the old
  bundle is preserved where replacement has not begun, but its closing service is
  not reported as ready. The person uses ordinary quit and reopen; that ordinary
  shutdown may use its existing bounded escalation. The updater never signals the
  child, manufactures idle or launches a competing successor.
- **The gap:** The plan allowed a bounded automatic recovery launch but did not
  require one. The final implementation chose honest manual recovery instead.
- **The reach:** Update failures are nonretryable public status errors. Recovery
  instructions distinguish pre-EOF restored admission from post-EOF unavailability,
  and do not promise automatic postlaunch rollback or arbitrary downgrade.
- **Verdict:** sound; explicit recovery keeps one service owner and preserves sources.
- **Confidence:** high.

### A permit belongs to one preparation attempt

- **When:** service admission and integrated native review.
- **The choice:** The app prepares A, loses its answer, and a second preparation
  arrives. The service returns retryable `UPDATING` rather than handing A to the
  second call. An uncommitted A expires on the existing control-call deadline;
  committed A lasts until its owner releases it or the service closes. Releasing
  absent A succeeds, even if a later B is held, and never releases B. Committing
  stale A still fails `INVALID_PERMIT`.
- **The gap:** Repeated prepare/release semantics were unspecified.
- **The reach:** No historical permit cache or replay registry is needed. Service
  idempotent release supports cleanup, but the native unknown-answer rule still
  requires restart when it cannot prove that cleanup was acknowledged.
- **Verdict:** sound; one current owner and idempotent cleanup preserve successor safety.
- **Confidence:** high.

### Waiting status subscribes to existing owners' progress

- **When:** service admission.
- **The choice:** A candidate waits because a job or delivery resource is active.
  The service subscribes to that owner's existing progress while a blocked prepare
  or native status says `waiting`. Resource release invites another native check;
  it does not install or cancel work. Successful preparation, discard, release
  and shutdown remove the subscriptions. Ordinary requests and preview renewals
  remain usable while waiting.
- **The gap:** Notifications were required without prescribing another private
  watch/discard operation.
- **The reach:** Native status owns candidate lifetime; existing work owners retain
  their domain state. There is no updater polling loop or permanent subscription,
  and these callbacks are not a launcher-reader-exit scheduler.
- **Verdict:** sound; reuses existing status and progress without duplicate lifetimes.
- **Confidence:** high.

### Sparkle schedules downloads through the measured custom driver

- **When:** protected engine and production driver integration.
- **The choice:** Sparkle finds an authenticated compatible candidate. The custom
  user driver requests its download and retains the ready reply while native and
  service work finish. Off changes Sparkle's persistent check preference and
  cancels download or staged installation before the coordinator requests final
  authorization after proven clean child exit. The coordinator marks that request
  irreversible before sending it; Off while the SDK acknowledgement is pending
  applies to the successor. The acknowledgement separately permits app termination.
  Sparkle's separate automatic-install driver is disabled in release metadata.
- **The gap:** Automatic downloading was required without naming the SDK path
  that preserves the protected install/cancel handshake.
- **The reach:** Settings observes effective owner facts and never saves another
  boolean. Source/personal builds link the SDK but receive no release feed or
  public update key, so they remain manual. Off remains a usable persisted
  preference on an installed release; it does not make that release unavailable.
- **Verdict:** sound; scheduling, persistence and retries have one SDK owner.
- **Confidence:** high.

### Authentication binds compatibility metadata as well as archive bytes

- **When:** discovery refinement and release integration.
- **The choice:** An update archive is valid, but someone changes the feed's library
  format declaration. Releases sign both finalized feed and app-only archive;
  the app rejects unsigned, missing or different catalog format before installation.
  The catalog format is the existing core's stored-library layout identity, not a
  new protocol version. Builder, bundle, feed and receipt derive it from that owner.
- **The gap:** Archive authentication alone did not bind candidate-selection metadata.
- **The reach:** Same-format updates need no migration, deletion or reconstruction.
  Signed-feed failure cannot fall back to an unsigned feed. Future format migration
  requires an explicit design rather than relaxing this candidate check.
- **Verdict:** sound; authenticated compatibility protects the existing library.
- **Confidence:** high.

### Release signing selects the exact certificate without installing trust

- **When:** scratch signing recipe and release pipeline.
- **The choice:** CI restores the encrypted PKCS#12, which contains the stable app
  certificate and private key, into a temporary keychain. It validates the actual
  certificate's public fingerprints and selects it explicitly for codesign. It
  grants Apple signing tools access to the imported private key only in that
  temporary keychain, so a headless runner needs no password dialog. A denied
  grant aborts packaging. It signs nested executables and bundles before the
  enclosing app, then verifies them strictly. The temporary keychain remains on
  the account search list while the signing tool finds its certificate chain.
  Cleanup removes only that owned entry. The certificate need not be trusted by
  the build account; the alternative would alter the login keychain or trust.
- **The gap:** Stable self-signing did not prescribe exact identity selection or
  whether account trust or headless private-key access would be required.
- **The reach:** Personal `Screen Recorder Local` signing stays separate. No
  valid-only discovery, same-name reissue or ad-hoc final re-signing substitutes
  for the supplied release identity. Temporary signing secrets are cleaned up;
  the developer signing lab separately owns its interrupted command cleanup.
- **Verdict:** sound; fingerprints preserve identity without changing account trust.
- **Confidence:** high.

### The signing lab cleans up its owned commands before reporting interruption

- **When:** scratch signing review.
- **The choice:** A developer interrupts the signing lab while an external command
  is paused. The lab stops only that command's owned process group, waits for its
  exit, then removes scratch keys and keychains before reporting failure. A command
  deadline follows the same cleanup. Exiting the lab immediately could leave the
  command alive and temporary signing material behind.
- **The gap:** Scratch-only cleanup was required without choosing how interruption
  would account for subprocess lifetime.
- **The reach:** This applies to developer proof commands. It does not permit the
  production updater to signal the app's service or manufacture idle.
- **Verdict:** sound; interrupted proof retains ownership through cleanup.
- **Confidence:** high.

### Packaging replaces the embedded framework with the verified input

- **When:** release pipeline.
- **The choice:** A local app build contains an older or differently signed
  framework. Packaging removes that embedded copy, installs the protected framework
  matching its pinned build receipt, then signs the final app. The install kit and
  app-only update ZIP are produced from that same finalized app tree. Checking a
  separate correct framework while retaining the app's stale copy would not prove
  which installer the recipient executes.
- **The gap:** Pinned input checks did not specify treatment of a previously built
  developer bundle's embedded framework.
- **The reach:** Framework identity covers all bytes, permissions and internal
  symlinks, including helper executables; links cannot escape its tree. Its input
  fingerprint precedes final signing, which intentionally changes signed bytes.
- **Verdict:** sound; release assembly owns the actual delivered dependency.
- **Confidence:** high.

### Quiet relaunch carries only the selected storage context

- **When:** protected engine acceptance.
- **The choice:** An update completes in a selected library and preferences domain.
  The installer passes `SCREENREC_HOME` and `SCREENREC_DEFAULTS`, which select that
  library and domain, to the successor along with the quiet-launch argument. It
  does not copy unrelated environment variables such as agent credentials. Losing
  the selection would open the wrong library; copying the whole environment would
  transfer unrelated private state.
- **The gap:** The plan required preserving selected storage without choosing its
  transport through the existing installer input.
- **The reach:** Any additional forwarded variable needs a deliberate contract
  change. Quiet launch still suppresses Settings and never starts capture.
- **Verdict:** sound; preserves the requested storage context with a bounded input.
- **Confidence:** high.

### Raw compiler inputs, not Git presentation, own provenance

- **When:** protected engine build closeout.
- **The choice:** A developer's Git clean filter or staged extra file hides changed
  compiler input. The builder compares actual source bytes, modes and links with
  the pinned tree plus maintained patch using a private temporary index, with Git
  replacement objects disabled. It verifies the loaded input hashes again after
  compilation before issuing a receipt. A normal clean diff would miss such input.
- **The gap:** A pinned commit label did not establish actual compiler input identity.
- **The reach:** Source overrides still need the same receipt and complete framework
  identity. The check never edits the user's index or defines another release pipeline.
- **Verdict:** sound; configurable Git presentation cannot authorize different bytes.
- **Confidence:** high.

### GitHub selects latest stable by its semantic policy

- **When:** publication review, `05ecd378`.
- **The choice:** Builds of two stable tags finish out of order. Both complete their
  asset upload while still drafts; publication asks GitHub for `make_latest: "legacy"`,
  letting GitHub apply its version-based latest selection rather than force the
  older late-finishing release to latest. A suffixed prerelease uses `"false"`.
  Already published assets remain immutable. The feed and fresh installer both
  follow GitHub's latest stable route.
- **The gap:** Stable classification did not specify safe latest selection under
  independently running tag workflows.
- **The reach:** There is no second semantic-version parser or custom release index.
  The release publisher uses the API's structured body because the CLI edit command
  exposes only boolean latest selection. Publication and live redirect readiness
  still require their separate verification.
- **Verdict:** sound; the platform owns ordering and prereleases stay out of discovery.
- **Confidence:** high.

### Proof fixtures stay distinct from production identity and acceptance

- **When:** engine, launcher, Settings and installed-lab integration.
- **The choice:** The direct Objective-C fixture exercises real SDK callbacks;
  the shipped app remains Swift. The launcher experiment bundles the real adapter
  cheaply from source; final assembly uses the normal builder. Settings shots draw
  the production view with synthetic facts. Installed tests use a distinct signed
  identity, account lock namespace, selected library/defaults and controlled feed.
  These substitutions avoid touching release preferences or a user's media, while
  each receipt states what is and is not proved.
- **The gap:** The plan left fixture construction and the cheapest valid proof open.
- **The reach:** A passing defect-reproduction test is not engine acceptance. Input
  hashes and named substitutions must survive reuse. Archive smoke checks the
  exact signed trees and loads bundled code, but does not launch the production
  host or account-owned launcher; installed fixture proof owns those lifetimes.
- **Verdict:** sound; narrow fixtures preserve evidence without borrowing user state.
- **Confidence:** high.

### Complete pinned skill acquisition reuses the required Node runtime

- **When:** consumer skill lifecycle integration.
- **The choice:** A Mac has Node/npm for `npx skills` but no usable Git. The agent
  resolves repository `main` once, recursively fetches the entire consumer folder
  through GitHub's contents API at that commit, and stops on missing input. A
  Git-only route would block this Mac; a Python fetcher would add a prerequisite.
  The sparse-Git route produces the same pinned full-folder input when available.
- **The gap:** Recursive Git-free acquisition was allowed without choosing its runtime.
- **The reach:** App-bundled Node is not the separate `npx` prerequisite. Installation
  uses the real pinned upstream installer, verifies the canonical project folder
  and selected discovery symlinks, and never links an entire agent config directory.
- **Verdict:** sound; one prerequisite supports complete immutable acquisition.
- **Confidence:** high.

### Real installer proof is separate from fast offline eval checks

- **When:** consumer lifecycle review and Docker integration.
- **The choice:** A developer changes the eval observer. Fast checks exercise
  deterministic harness logic without registry access. A separately named
  integration proof executes actual `npx skills@1.7.0` in a disposable npm home;
  model trials also use the real installer. Controlled source mirrors replace
  acquisition only, not installation. A judge receives completed tool receipts and
  file/link evidence independently of the runner's acceptance bar.
- **The gap:** Both offline harness checks and real published-installer execution
  were required without choosing their default command boundary.
- **The reach:** Full-folder comparison is read-only; surgical edits preserve local
  extras, and explicit replacement backs up and restores on failure. No app update
  edits skills. A focused old matrix remains bounded evidence; final trials must
  identify their actual consumer, case, CLI and observer bytes.
- **Verdict:** sound; cheap checks do not impersonate installation or final acceptance.
- **Confidence:** high.

### A workflow retry validates the selected source without rewriting a release

- **When:** hosted release-signing repair, `ef8add44`.
- **The choice:** A version tag's build fails after the release has already been
  published from verified local artifacts. The same workflow can run manually on
  the repaired main branch with an explicit tag. It validates that tag against
  the selected source's app version and verifies its own rebuilt package. The
  publisher sees the existing published release and leaves all assets unchanged.
  Retagging would destroy the original source reference; uploading replacement
  assets would silently change bytes users had already received.
- **The gap:** The simple tag-triggered release did not specify how to prove a
  later CI repair without moving a published tag or issuing another app version.
- **The reach:** The retry source and published artifact source remain distinct.
  This retry establishes hosted build readiness, not new release delivery. A
  product correction still needs a new version; this adds no second publisher.
- **Verdict:** sound; the same release owner validates retries and preserves
  published provenance.
- **Confidence:** high.


### Signing failures retain public context and redact the supplied credentials

- **When:** hosted signing diagnosis, `5d1b7153`.
- **The choice:** A CI signing command fails with a message the release code has
  never seen. Its error records the owned file's relative path, tool exit state
  and a bounded, escaped diagnostic. The signing session removes every supplied
  password and encoded private key from that text before logging, including
  overlapping values. Security and OpenSSL import errors remain fully suppressed.
  Suppressing all signing output would hide which file failed and why; blindly
  forwarding every tool's output could reveal credentials.
- **The gap:** Secret-free release logs were required without specifying how an
  unfamiliar signing failure should remain diagnosable.
- **The reach:** Redaction follows the actual imported signing context rather than
  assuming credentials came from environment variables. Future signing inputs must
  join that context, and diagnostics must remain bounded and escaped before logging.
- **Verdict:** sound; preserves useful failure evidence without publishing private
  signing inputs.
- **Confidence:** high.
