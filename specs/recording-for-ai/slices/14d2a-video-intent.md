# 14d2a — Durable ready-preview video intent

Status: internal implementation verified with generated native/process checks.
Its ready-only creation checkpoint is superseded by [14d2b2](14d2b2-pinned-waiting-video.md);
the publication/deletion evidence below remains applicable.
Independent review identified interrupted receipt publication; the native owner
now atomically publishes its complete prepared receipt and the regression passes. This is the first bounded consumer of the publication owner. The
public export operation must still accept requests whose dependencies are pending;
`createReady` is an internal checkpoint, not a public product restriction.

## One record of external truth

[VideoExports](../../../apps/service/src/video-exports.ts) owns one catalog intent
per request identity. The original revision/history snapshot, destination directory
identity and filename survive edits, retries and restarts. The selected preview is
retained by [the cache owner](../../../packages/core/src/cache.ts), which lends its
already-validated descriptor until the actual native preparation call settles.
The exporter never reopens the preview's advertised pathname.

JobQueue owns attempts and execution state. External commit truth is written to the
intent even when cancellation causes the queue to reject that attempt's late result.
The catalog retains only the committed native receipt; the publication owner retains
its prepared receipt while the external outcome is still uncertain. Ordinary status
is cheap historical truth: the export committed at that point. It does not promise
that a user-owned external file still exists or remains unchanged today. Retrying a
known commit never recreates a user-deleted file or replaces another file.

The existing managed-files authority validates the destination against the actual
library-root identity. Selecting a directory inside that managed storage is rejected
before creating an intent; otherwise recording deletion could erase an allegedly
external export. The shared native ancestor walk also prevents publication into its
own disposable staging. Other external directories receive no blanket restrictions.

## Creation and recovery boundaries

The intent records its random private sibling name before filesystem creation.
Allocation uses the retained destination descriptor and accepts only an empty,
private, exclusively owned directory. Its acquired identity is recorded before any
payload write. Thus a crash before identity registration can leave only an empty
directory. Reopening that gap refuses nonempty or substituted storage. The complete
receipt is written and synchronized under a pending name, then linked exclusively
to its canonical name. Death during writing therefore remains unprepared; death
after the canonical link retains valid evidence even if pending-name cleanup did
not finish. Discard and retirement own both receipt names.

Once bytes exist, every reopen checks the recorded staging and destination identities.
Recovery distinguishes the gap before catalog acknowledgement from the gap before
private cleanup: the first reconciles and records a committed file, while the second
only removes private evidence whose external truth is already durable. Concurrent
recovery with an active export attempt is refused; native staging ownership fences
other simultaneous callers. This internal recovery caller must await completion
before closing the catalog. No startup or public recovery sweep is wired here.

Uncertain recovery can hash a completed file. **14d2b must admit that recovery through
the existing heavy queue before startup/public consumption.** It must not invoke an
unbounded recovery loop or create a second scheduler. This pass proves one explicitly
sequenced recovery against real process death.

## Deletion

RecordingDeletion first marks the recording unavailable and drains its jobs. It then
retires registered export staging before purging source/cache data and forgetting the
catalog. Deletion verifies private ownership and retirement, not external-file
contents: an unreadable or altered user-owned output cannot prevent erasing safely
owned private bytes. A published external file is never a deletion target. Receipt, destination,
snapshot and intent metadata all disappear after successful recording deletion; there
is no permanent export tombstone retaining private context.

A missing staging directory is accepted only after checking absence beneath the
registered destination parent. This makes retirement repeatable after the native
removal succeeds but its response or catalog acknowledgement is lost. A changed
identity or unsafe/nonempty unregistered directory keeps deletion pending, preserving
both the privacy marker and unrelated data. Independent intents continue retiring
past that failure through a bounded catalog cursor; shutdown is checked between
intents. The first failure is reported after the other reachable cleanup completes.

## Evidence and next pass

[The integration harness](../../../apps/service/tests/video-export.mjs) creates a
real generated video through PreviewInspection and native rendering, pins independent
preview bytes before admission, then drives the actual JobQueue, publication worker,
recording deletion and killed-owner recovery. It uses no narration and no pointer
observations; it is not another acceptance claim for the production pointer pipeline
or real speech audition. [Evidence](../assets/export-publication/video-intent.md).

14d2b still owns waiting dependency admission, bounded/coalesced capacity/startup hooks,
queue-admitted uncertain recovery, and public service wiring. Its full-package branch
must preserve accepted-transcript prerequisites; this human-video pass fabricates no
speech readiness. [Private export storage accounting](../assets/export-publication/staging-usage.md)
now composes through the existing storage owner internally. Public service wiring
remains required. Attribute only identity-validated app-owned pending staging, exclude
completed external exports, and do not double-count the retained hard link to an
already committed file.

Before public admission, 14d2b must also choose a bounded, size-appropriate publication
budget for long videos and slow destination volumes using the existing configurable
`Publication` deadline. This internal consumer currently inherits the worker default
of 30 seconds per call. Repeating an intent with that same insufficient deadline is
not a progress strategy; no separate timer or retry scheduler should be added.
