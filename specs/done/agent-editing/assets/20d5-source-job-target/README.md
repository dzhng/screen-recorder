# Source-owned recording job prerequisite

Explicit null selects a settled recording's source lifetime; omission still pins a
revision. The same recording owner handles availability, cancellation and deletion.
Catalog18 separates this persisted interpretation from earlier catalogs. No cleanup
operation, native mutation or project-target relaxation is included.

The actual no-r0 red fails because the old target owner tries to open a nonexistent
revision. The full service red rejects job.get as project-only; the corrected service
uses its existing queue for get/retry/drainJob. Public CLI/MCP returns null after
reopen. A service fixture prepares retained failed/ready jobs and proves public retry,
cancel and restart while ordinary r0 ready jobs remain unchanged. The capture-priority
fixture keeps retried heavy work queued; this does not claim a cleanup executor ran.

The six core suites passed145 checks before the last targeted additions; the final
jobs suite passed71, and the service/deletion/protocol group passed27. Typechecks and
independent final review pass. Exact commands and outcomes are in the retained logs.
An initial invalid finished(0) fixture and a stale compiled catalog17 subprocess
were corrected as fixture/build mismatches, not counted as product reds. Zero native
video duration continues to mean null/no-r0, never a zero-length revision.

## Hardlink consumer investigation

`ctime-report.json.gz` retains a separate bounded probe, not actual cleanup. It makes
one scratch candidate hardlink to canonical audio, prepares a ready recording source
generation, imports that source into a project, then unlinks only the known candidate.
The canonical inode remains, link count falls from2 to1 and ctime changes. Afterward:
recording generation and cursor.raw results survive restart unchanged, and a different
uncached project audio range renders exact prefix PCM. Canonical bytes remain identical.

Asset import copies the donor into its own staging/asset inode. Ready imported media
therefore does not depend on donor ctime; recording source metadata stores canonical
byte/proof identity, not that filesystem snapshot. This does not waive a frozen
in-flight admission's ctime check. The next actual cleanup vertical must serialize
through existing journal ownership and retain actionable contention/changed-identity
refusals; no implicit donor rebinding or evidence-generation rewrite is justified.

## Decisions

- Reuse the recording owner and nonrevision SQL sentinel; expose explicit null publicly.
- Require settled, noncanceled, nondeleting recordings for source-owned targets; no fake r0.
- Activate existing job continuations in the full service with required queue composition.
- Use the existing drain wait only for job.cancel; get/retry and global deadlines are unchanged.
- Preserve capture/cleanup and terminal diagnostic remaining scope for later20d passes.
