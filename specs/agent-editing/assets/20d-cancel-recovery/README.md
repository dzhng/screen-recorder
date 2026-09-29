# An absent native take is not proof of absent media

When native no longer holds a take whose terminal report was lost, cancellation
consults the existing recovery owner before deleting its directory. Recoverable
capture evidence settles interrupted and reaches the existing explicit library
deletion rule. Inspection failure retains the take. A successful zero-duration,
headerless result is insufficient: source files must also be absent or the allocated
source directory empty. Unreadable, packed or otherwise unclassified remaining bytes
refuse cancellation rather than being silently discarded.

The existing service fixture reproduced deletion of retained bytes after native
INVALID_STATE (red ENOENT). Its never-started empty control remained cancellable.
The correction covers known media, explicit empty source, failed recovery and
successful-but-ambiguous recovery with bytes remaining. Sixteen focused lifecycle
checks and the existing public-service cancel regression pass. This is a service
boundary proof with a controlled native/worker response, not a physical capture or
native decoder claim. Explicit library deletion/quiesce remains separate.

Verification from repository root:

```sh
node_modules/.bin/vitest run apps/service/src/capture-lifetime.test.ts apps/service/src/capture-finalizing.test.ts
node_modules/.bin/turbo run build --filter=@screenrec/service
node_modules/.bin/vitest run apps/service/src/capture.test.ts -t 'cancel|discard'
```

Shape review shares recovery inspection and settlement with reconciliation; it adds
no parser or state owner. Independent read-only review found no concrete defect.
No devices, permissions, downloads or live capture were used. The input-session
extraction is separate work and is not accepted by this evidence.

The [combined-root follow-up](root-verification.json) confirms preservation and the
actual client/service cancellation path with recovery lasting beyond the old
control-only client deadline. Cancellation now budgets one native call and one
recovery; restart budgets recovery for discard and for an unanswered new start.
Global control/worker timeouts are unchanged. The restart total is derived from
those existing branches, not a measured long-restart run. Large canonical workloads
still require their separate operation-specific worker-budget gate.
