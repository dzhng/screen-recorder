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
