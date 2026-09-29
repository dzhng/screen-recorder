# 23b — Matched export acknowledgement-loss preservation

Status: scoped matched public checkpoint verified; both actual cases and independent reviews pass. [Evidence](../assets/23b-export-recovery-preservation/README.md).
Dependencies: [23a](23a-recording-project-preservation.md)'s retained recording, isolated homes and pinned cached movies.

## Contract

Compare one actual installed recording export and one project export when native
publication commits but its reply is lost. Concurrent identical creates must
share intent/job identity; changed arguments must conflict. Restart/recovery and
subsequent retry preserve the real committed receipt, external bytes and inode,
without a second native commit.

Reuse existing rendered movies and actual revisions. Do not fabricate jobs,
intent rows, lifecycle state or native results. All new destinations belong to an
isolated test directory. Original library/application paths are write-denied.
The fixture-only observer uses the existing native executable environment seam,
forwards exact request bytes and inherited descriptors to the frozen worker,
and holds only a real successful commit response after reaping that worker.
Service death precedes releasing the held proxy; recorded process identities and
exit observations ensure inherited staging locks cannot survive into recovery.
Unexpected media/model operations fail the fixture before forwarding them.

## Scope and evidence

Retain public requests/responses, exact native wire bytes, descriptor identities,
real prepared/committed receipts, complete file hashes/inodes and process exits.
Keep failures and the final independent review. Existing recording publication
and 09 project cancellation/recovery evidence remain authoritative for their
broader cases; this adds no new fault matrix, product hook, deadline or recipe.
No render, ASR, model preparation, installed switch, original output mutation,
physical capture or listening acceptance belongs to this checkpoint.
