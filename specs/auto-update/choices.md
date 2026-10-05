# Implementation choices

## Sound

### Use the SDK's native callback language for the disposable reproduction

- **When:** slice 01 replication checkpoint.
- **Choice:** The test app calls Sparkle directly from Objective-C. When a signed
  update is found, the fixture receives the real SDK callbacks and logs them;
  the shipped app will remain Swift. A SwiftPM reproduction would add package
  setup to this isolated SDK test without changing the callback contract.
- **Gap:** The plan proposed a tiny SwiftPM app, but this machine has Command Line
  Tools and can compile the direct Objective-C boundary without full Xcode.
- **Reach:** This is test-only. The Swift integration must prove parity against
  the same feed and callback decisions; this language choice grants no parity.
- **Verdict:** sound: it exposes the actual engine behavior and preserves the
  production-language proof requirement.
- **Confidence:** medium.

### bounded text beside complete file hashes

- **When:** eval folder receipts pass.
- **The choice:** retain complete SHA-256 file hashes and symlink targets, but give the
  judge only the beginning/end of long file text (500 characters total). A hash is
  a fingerprint of all the file bytes: the judge can compare every reference or
  backup byte-for-byte without receiving repeated copies of long guides. Full text
  would exhaust the judge's input limit before it can evaluate the task.
- **The gap:** actual file/link inspection was required; its report representation
  and input-size bound were unspecified.
- **The reach:** hashes own equality claims; excerpts support explanation rather
  than proving full content. Changing excerpts must not drop the complete hash.
- **Verdict:** sound; a first judge failed its 1 MiB input limit when unrelated Node
  compilation cache files entered receipts. The corrected fixture disables that
  disposable cache and retains hashes for every observed project/backup file.
- **Confidence:** medium.

### Optional adjacent runtime version

- **When:** service admission pass.
- **Choice:** read `runtime.json.version` beside the running service entry. When a
  packaged app supplies `"2.0.0"`, health reports that running release. A source
  service or a personal build without that metadata reports null. The alternative
  would derive a version from the checkout, executable path or a CLI process;
  those can describe a different release from the service the caller reached.
- **Gap:** the spec prescribed owner-derived bundle metadata but not the metadata
  field or service loading seam. The bundle already owns an adjacent runtime
  manifest for interpreter/control facts.
- **Reach:** later packaging must write this optional field from its version owner.
  This pass does not generate it or claim an old live CLI has upgraded.
- **Verdict:** sound; reuses the existing metadata owner and preserves the specified
  unavailable/null fallback.
- **Confidence:** medium.

### Scheduled custom-driver downloads preserve explicit install control

- **When:** protected engine acceptance.
- **Choice:** Sparkle schedules checks, and the app's custom user driver requests
  download when it finds an acceptable candidate. It retains the ready reply while
  waiting and after asking to install, so a later opt-out can still cancel. Enabling
  Sparkle's separate automatic-install driver would bypass this measured callback
  route; that mode is disabled in signed release configuration.
- **Gap:** automatic downloading was required, but the Sparkle driver selection
  that would preserve the corrected explicit-install handshake was not named.
- **Reach:** production must link the same driver path; the preference controls
  Sparkle's check scheduling rather than selecting an unproved install driver.
- **Verdict:** sound; keeps one scheduler and the demonstrated permission boundary.
- **Confidence:** medium.

### One account lock covers every release app path

- **When:** production launcher/native contract agreement.
- **Choice:** all released app copies use one persistent private account file,
  `Library/Caches/com.david.screenrec/launch.lock`. A CLI keeps a shared kernel lock
  while it lives; the installer needs its exclusive form to replace the app.
  Launching through a symlink or another app path therefore cannot choose a
  different lock accidentally. Separate release copies also defer one another;
  this favors simple exclusion over deriving a new lock from each app path.
- **Gap:** the measured lock required a permanent location, but the plan did not
  choose whether path aliases and multiple copies shared it.
- **Reach:** the fixed launcher and signed host metadata agree on this account
  path. Scratch identities get their own injected path; personal builds stay manual.
- **Verdict:** sound; the product already has one app/service owner per account,
  and this avoids a path registry or two implementations of path hashing.
- **Confidence:** medium.

### Helper deadlines cancel permission rather than forcing progress

- **When:** protected engine acceptance.
- **Choice:** if an authorized host remains alive for 20 seconds, the helper starts
  cancellation and waits for the host to suppress callbacks and close its received
  descriptor. It never makes a paused callback lose kernel exclusion just because
  time passed. Quiet launch acknowledgement has a 10-second failure budget; that
  failure reports unavailable startup rather than rolling back an installed app.
- **Gap:** the spec required bounded failure behavior but did not select these
  helper budgets.
- **Reach:** native clean shutdown must finish within the installation opportunity
  or report cancellation honestly. A live paused host can retain exclusion until
  it resumes or exits; a deadline cannot safely pretend its descriptor disappeared.
- **Verdict:** sound; time bounds an attempt, while actual descriptor lifetime owns
  replacement authority.
- **Confidence:** medium.

### Propose one private local credential folder and three CI secrets

- **When:** independent slice 02 prepared custody handoff.
- **Choice:** The proposed handoff keeps the encrypted app identity, its password and
  independent updater key in a private local folder, with matching repository
  secrets for CI. The agent has prepared exact import/secret steps but created
  no production credentials; the owner must authorize that custody folder or
  supply existing files. The owner can copy the folder for backup without a
  prescribed device, mounted volume or password-manager requirement.
- **Gap:** the plan requires custody outside CI without selecting a local folder or CI secret names.
- **Reach:** the handoff names proposed paths and secret contracts so packaging can
  fail on missing inputs. The owner can choose another private location or secret
  names before provisioning; no shipped identity depends on those names.
- **Verdict:** sound: the reversible proposal keeps one concrete custody choice and isolated CI inputs
  without imposing a physical-backup ceremony or claiming uncreated files exist.
- **Confidence:** medium.

### Give pre-dispatch launcher failures a fixed identity

- **When:** slice 05 release pipeline checkpoint.
  **The choice:** Treat the launcher startup refusal as an operation-shaped JSON failure with the fixed identity `launcher`. When replacement owns the exclusive lock, no user request or bundled CLI has started, so the external executable emits `UPDATING` with `retryable:true` and exits 75 before reading bundle code. Trying to obtain a request identity from the CLI would first load the very bytes whose replacement is being fenced.
  **The gap:** The plan required framed retryable startup failure before dispatch, but did not name the identity for a failure occurring before a request exists.
  **The reach:** Consumers can recognize a bounded startup refusal; the external launcher does not become another request parser or replay mutations.
  **Verdict:** sound — preserves the pre-load exclusion boundary and distinguishes startup from a dispatched operation.
  **Confidence:** medium.

### Reproduce the rejected engine instead of pretending the lab is acceptance

- **When:** slice 01 replication checkpoint.
- **Choice:** When the busy app quits, upstream Sparkle replaces the app without
  an install reply. The lab records that defect and its command exits nonzero.
  Its test suite asserts that the defect is reproduced; the spec's acceptance
  gate stays failed. Treating a green reproduction as safe updating would hide
  the very failure that production must fix.
- **Gap:** The plan did not specify how to retain a useful upstream reproduction
  after the upstream engine failed a mandatory contract.
- **Reach:** Future production work must first make the busy-quit command pass
  the actual preservation requirement, with a separately accepted engine.
- **Verdict:** sound: a retained failing gate prevents this research checkpoint
  from becoming a false shipping claim.
- **Confidence:** high.

### Node owns Git-free acquisition

- **When:** consumer lifecycle pass.
- **The choice:** use the already required Node runtime to recursively download the
  GitHub contents API. On a Mac without usable Git, the agent runs one Node script:
  it resolves `main` once, downloads every reference at that same commit, and stops
  on missing or unsupported input. A Python implementation would add another
  consumer prerequisite; a Git-only implementation would leave this Mac blocked.
- **The gap:** the plan permitted recursive API retrieval without naming its runtime.
- **The reach:** future acquisition changes keep one runtime prerequisite and preserve
  the recorded commit across every directory/file request.
- **Verdict:** sound; actual API and sparse-Git acquisition produced identical file
  hashes, and controlled unavailable/incomplete API inputs fail explicitly.
- **Confidence:** high.

### real-installer proof is an explicit integration run

- **When:** independent review closeout.
- **The choice:** keep the registry-dependent command proof under `evals/integration`,
  outside the fast `eval:test` file glob. A developer running the ordinary fast
  harness checks gets deterministic offline checks. A developer proving the actual
  documented install/replacement runs the named integration test with real
  `npx skills@1.7.0`. Combining them would make every fast check depend on registry
  availability because each proof uses a scratch npm home.
- **The gap:** the plan required both model-free harness checks and actual published
  installer execution, without deciding whether they shared the default fast command.
- **The reach:** real installer proof remains mandatory for this slice, but future
  harness-only edits can use the fast suite without another package download.
- **Verdict:** sound; this separates infrastructure needs without stubbing the
  installer or treating offline tests as proof of installation.
- **Confidence:** high.

### Releasing an absent permit succeeds without disturbing its successor

- **When:** integrated service review.
- **Choice:** release is idempotent: repeating it reaches the same end state and
  succeeds. For example, the app releases A, loses that answer, obtains B, then
  retries releasing A. The service reports A released while leaving B fenced.
  Committing A still fails with `INVALID_PERMIT`, because it no longer grants
  permission to install. Refusing a repeated release would force the native
  cleanup path to interpret an ordinary completed cleanup as an error.
- **Gap:** the spec fixed invalidation and successor safety, but not the stale
  release response. Only the current permit is retained; no historical cache is
  needed to recognize that A is already absent.
- **Reach:** native cleanup can release its reference repeatedly. It must still
  reject failed commitments rather than treating them as installation permission.
- **Verdict:** sound; the simpler cleanup contract preserves successor ownership.
- **Confidence:** high.

### A second prepare does not reuse a held reference

- **When:** service admission pass.
- **Choice:** while A is prepared or committed, another prepare returns retryable
  `UPDATING`. If A's preparation response is lost, its existing call deadline
  releases the uncommitted fence; the app can then request a fresh reference. The
  alternative would hand A back on another prepare, requiring a replay/ownership
  rule the protocol never specified.
- **Gap:** concurrent or repeated prepare response semantics were not specified.
- **Reach:** the native coordinator owns one preparation attempt and waits for its
  answer or deadline; the service does not create or hand over a successor while
  a committed owner remains live.
- **Verdict:** sound; one current reference and the existing deadline cover lost
  acknowledgement without another registry.
- **Confidence:** high.

### Candidate waiting status owns notification subscription

- **When:** service admission pass.
- **Choice:** a blocked prepare or native `update.report` with state `waiting`
  enables progress callbacks. A nonwaiting report, a successful preparation,
  release or shutdown removes them. If a candidate is discarded while blocked
  (so no permit exists), its nonwaiting report disarms notifications. The unbuilt
  alternative would add another private watch/discard command or leave every
  owner permanently subscribed.
- **Gap:** the spec required subscriptions only while needed and removal on
  discard, but did not add a separate subscription operation.
- **Reach:** native status reporting must reflect candidate discard. Progress is
  an invitation to recheck; the service does not re-run prepare or schedule an
  updater loop on the app's behalf.
- **Verdict:** sound; the existing private status contract supplies candidate
  lifetime without creating another control surface or snapshot owner.
- **Confidence:** high.

### A launcher proof does not silently become a production launcher

- **When:** slice 03 launcher-only checkpoint.
- **The choice:** keep the measured lock wrapper in the developer lab until the
  updater helper proves ownership through replacement. When an agent launches
  the CLI, the wrapper acquires a shared file lock, meaning any number of CLI
  readers may run together. An installer needs an exclusive lock, meaning every
  reader must have ended before it can replace the app. The lock survives the
  wrapper becoming Node through `exec`, and the kernel releases it when Node
  exits or crashes. Installing this wrapper immediately would protect readers
  only if Sparkle's actual installer used the same lock; it currently does not.
- **The gap:** the plan delegates choosing a mechanism after measurement, but
  does not prescribe where an incomplete research result belongs.
- **The reach:** production must reuse the frozen reader lifetime while proving
  the installer lifetime, rather than treating a successful isolated lock test
  as evidence of Sparkle coordination.
- **Verdict:** sound; it preserves a demonstrated useful primitive without
  shipping an unproved safety guarantee.
- **Confidence:** high.

### Bundle the real adapter directly from unchanged source for its cheap lifetime proof

- **When:** slice 03 launcher-only checkpoint.
- **The choice:** the lab uses Bun's normal Node-target bundler and directs
  workspace imports to their source entry points. In a scratch app, an agent
  asks the real CLI for help and starts the real MCP server, then requests its
  tool list and leaves it idle. This observes help entry and the initialized MCP lifetime without
  building native recording helpers or writing package build output. The
  alternative is a complete app build, which does more expensive work while
  adding no evidence about whether the Node process owns the file lock.
- **The gap:** the plan requires real adapter proof but leaves the cheapest
  reproducible construction method open.
- **The reach:** this is explicitly a developer proof; final packaging still
  uses the existing app builder, and production parity must use its bytes.
- **Verdict:** sound; the receipt binds compiled adapter bytes and the test
  claims only the observed CLI/MCP lock lifetime.
- **Confidence:** high.

### Bind a framework input to its complete self-contained tree

- **When:** native framework-input harness checkpoint.
- **The choice:** a developer can select a separately built Sparkle framework.
  The receipt hashes every file's bytes and permissions, plus directory
  permissions and symlink targets, in stable path order. A symlink is a path
  pointing at another file; links must resolve inside the framework so all
  referenced bytes are included. Otherwise an external executable could change
  while the recorded fingerprint stayed the same. Hashing only the main library
  would also leave installer helpers and resources unbound.
- **The gap:** the plan required immutable dependency identity without choosing
  a fingerprint for a separately built framework directory.
- **The reach:** the builder and native lab share this calculation. The input
  fingerprint describes the supplied framework before fixture bundle signing;
  it does not claim that later signing leaves those bytes unchanged.
- **Verdict:** sound; one calculation binds the actual self-contained input
  rather than its version label or only one executable.
- **Confidence:** high.

### Transfer the actual lock and drain cancellation rights

- **When:** protected engine acceptance.
- **Choice:** Sparkle sends its actually locked file descriptor through its existing
  native interprocess connection. The host retains a duplicate of that same kernel
  object. If the helper dies while the installing callback is paused, the host
  still excludes new CLI readers. Reopening the path or using an expiry timestamp
  would leave that callback unprotected. Cancellation waits for both host callback
  suppression and the descriptor-transfer acknowledgement before confirming release.
- **Gap:** the public SDK could not keep launch exclusion valid through helper
  failure or queued callback delivery.
- **Reach:** future install/cancel paths must retain the transferred object and
  close copies to relinquish ownership; unlocking one duplicate changes the shared
  kernel lock for every participant. Failed channel loss is not successful release.
- **Verdict:** sound; measured helper-crash and paused-timeout controls rule out the
  weaker path/clock alternatives without another daemon.
- **Confidence:** high.

### The app alone owns quit after final authorization

- **When:** protected engine acceptance.
- **Choice:** installing first acknowledges held launch exclusion. The app then
  closes its service pipe, proves the child exited cleanly, and requests final
  authorization through the retained installing callback. Only the final SDK
  acknowledgement allows the app to quit itself. The helper sends no quit event,
  so cancellation cannot leave a delayed quit queued behind resumed user work.
- **Gap:** upstream helper-requested quit did not preserve the native service's
  reversible/irreversible shutdown boundary.
- **Reach:** the callback's retry closure now requests final authorization instead
  of another install attempt; every native adapter must honor that distinction.
- **Verdict:** sound; separates install intent, kernel exclusion and host exit at
  the owners that can prove each obligation.
- **Confidence:** high.

### Only selected storage context travels through quiet relaunch

- **When:** protected engine acceptance.
- **Choice:** the existing installer input transports only `SCREENREC_HOME` and
  `SCREENREC_DEFAULTS`, which choose library and preferences. B receives those
  values and the fixed quiet-launch argument. Other environment variables,
  including agent/provider credentials, are not copied into the new app.
- **Gap:** upstream relaunch discarded the selected fixture context; the spec
  required preserving that selection but did not name the transport owner.
- **Reach:** another forwarded variable must be a deliberate addition to this
  small constructor input, not a copy of the full parent environment.
- **Verdict:** sound; preserves selected storage without exporting unrelated state.
- **Confidence:** high.

### Raw source bytes own build provenance

- **When:** protected engine build closeout.
- **Choice:** the builder compares the checkout's actual bytes, modes and links
  against the pinned Git tree plus patch through a private temporary index. Git
  clean filters, replacement references and a user's staged extra files therefore
  cannot hide a different compiler input. The loaded input hashes and exact patched
  tree must still match after compilation before a receipt is issued.
- **Gap:** a pinned commit and normal Git diff did not establish raw compiler input
  identity in a configurable developer checkout.
- **Reach:** Git presentation and the user's index never authorize release source;
  this remains one source-build check rather than a second release pipeline.
- **Verdict:** sound; the negative controls demonstrated concealed input changes
  and the corrected check rejects them.
- **Confidence:** high.

### Select the exact release certificate without installing trust

- **When:** independent slice 02 scratch signing checkpoint.
- **Choice:** When CI restores the release's encrypted signing identity, it selects
  the certificate by its public fingerprint and explicitly names the temporary
  keychain. The certificate need not be trusted by the build account. The measured
  B→C signatures keep one requirement anchored to that exact certificate; importing
  the same encrypted backup into another scratch keychain preserves it. Reissuing
  a certificate with the same display name would give a different identity.
- **Gap:** the plan chose stable self-signing but did not say whether CI needed
  account trust or how to select the imported identity.
- **Reach:** packaging can remain isolated from the login keychain and must not
  use valid-only identity discovery or silently regenerate the certificate.
- **Verdict:** sound: actual signing, strict verification, restore and alternate-key
  negative control establish the narrower recipe without changing trust.
- **Confidence:** high.

### Own signing subprocess groups through interruption cleanup

- **When:** independent slice 02 review fix.
- **Choice:** If the signing lab receives SIGTERM while an external command is
  held, it stops only that owned command group, waits for its exit and deletes
  scratch keys/keychains before emitting its public failure receipt. The same
  bounded teardown covers a command that exceeds its deadline. The alternative
  synchronous runner exited immediately and left signing material behind.
- **Gap:** the scratch-only cleanup rule did not prescribe a process mechanism.
- **Reach:** this affects developer lab processes only, never the app/service
  shutdown path or production updater lifetime.
- **Verdict:** sound: the held-command negative control failed before cleanup and
  passed afterward, including reaped child and removed private material.
- **Confidence:** high.

### Re-embed the verified framework before release signing

- **When:** slice 05 release pipeline checkpoint.
  **The choice:** Copy the verified protected framework into the staging app again before final release signing. A developer may have built the app with a differently signed or older framework. Packaging takes the current framework whose bytes match the pinned builder receipt, puts that exact SDK into the staging bundle, then signs the complete app. Keeping the developer's embedded copy would let a stale installer survive despite checking a correct separate SDK artifact.
  **The gap:** The plan required pinned inputs and intact nested code but did not specify how packaging treats the already signed developer bundle's framework.
  **The reach:** Release assembly owns the framework copy used by the installer; developer signatures are never release credentials. App-only and install-kit archives are made from that same final app.
  **Verdict:** sound — ensures the release installer is the verified engine rather than whichever framework the prior local build retained.
  **Confidence:** high.

