# Matched public export acknowledgement loss

The installed format-1 recording service and current project service each pass one
cached-movie export with concurrent identity replay, loss of the actual native
commit reply, process death, restart and public recovery. This fills the bounded
[23b](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/23b-export-recovery-preservation.md) comparison; existing broader
recording/publication and 09 project fault evidence is reused rather than repeated.

## Actual boundary

Both services use the retained 23a isolated homes and exact pinned revisions. The
[harness](../../../../../packages/test-harness/editing/export-preservation.mjs)
revalidates executable and cached-file hashes, requires no outstanding queued work,
and gives each service a fresh private destination. A sandbox denies writes to the
original library and installed app. No catalog/lifecycle/intent rows are fabricated.

The [fixture observer](../../../../../packages/test-harness/editing/publication-observer.py)
uses the existing native-executable environment seam. It records and forwards exact
request/response bytes and all inherited descriptors, retaining and forwarding
native stderr. FD 3/4 are the real stage/destination contract in Publication.call,
worker stdio mapping and native PublicationOperation; measured dev/inode values
must match the request. FD 5 during preparation must identify the retained cached
movie. Nothing reopens those inputs through substitute paths.

Only after the real native child exits successfully does the observer hold the
commit reply. The external file and native prepared receipt already exist, while
public status still reports running with no acknowledged receipt/output. Killing
and reaping the owned service precedes releasing the proxy without forwarding the
reply. The proxy closes inherited locks and its exit is observed before restart.
A 15-second fixture hold watchdog prevents a lost controller from retaining those
locks indefinitely; production native/service deadlines are unchanged. The
watchdog did not fire in the accepted run.

Startup recovery may complete before explicit export.recover is dispatched. Both
paths converge on the exact original receipt, pinned snapshot and external inode.
Subsequent retry and creation replay preserve them. Each side made exactly one
native prepare and one commit, so recovery did not republish. Concurrent creates
returned the same job, and changed arguments returned REQUEST_CONFLICT.

The allowlist admits publication/storage operations plus exact startup workspace
recovery and audio-capability identity lookup. Rendering, ASR and model work are
not forwarded. The first two fixture attempts wrongly rejected ordinary startup
operations; their partial passing publication evidence and final red outcomes are
retained. Neither failure caused a render or model run.

## Evidence and reuse

The final report retains all public requests/results, process identities, native
call receipts and file identities. The archive retains all three attempts, native
wire bytes, stderr, executable fixture copies and service logs. Its inventory
covers every stored member. The exported movies are byte-identical to the already
banked 23a movies; media references name their existing archive members instead of
storing identical videos again. Live scratch destinations remain intact for
independent inode/hash verification. Archived inode identities describe the live
experiment, not inode values after extraction.

Exact movie identity also reuses 23a's media and final visual proof; this pass adds
no new pixels, audio, playback or listening claim. It does not establish all
concurrency/recovery combinations, power-loss durability, installed switching,
old-owner deletion or physical capture. Parent 23 remains open.

## Closeout

[Independent code review](code-review.md) found no actionable defects. Shape
review retains one fixture transport observer and the existing product owners;
no production code changed. Syntax, formatting, lint, all archived member hashes
and live output identities pass. [Verification](verification.json) records the
actual scope, retained failures and file identities. Self-review also made final
shutdown reject an already-exited service's unexpected status; the accepted run's
normal shutdown path is unchanged, and the follow-up review checked that guard.
