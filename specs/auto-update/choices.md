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


## Slice 08 — Node owns Git-free acquisition

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

## Slice 08 — bounded text beside complete file hashes

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

## Slice 08 — real-installer proof is an explicit integration run

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

Fixture names, controlled acquisition mirrors, health interpretation data, canonical
topology and explicit overwrite semantics follow delegated or fixed slice decisions;
they are not new product policy. No app updater implementation belongs to this pass.
