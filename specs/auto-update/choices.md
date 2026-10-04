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
