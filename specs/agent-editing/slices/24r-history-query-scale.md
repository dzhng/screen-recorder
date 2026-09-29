# 24r — Bounded public history queries

Status: planned. Dependencies: [24h](24h-job-inspection.md), [24m](24m-query-duration-memory.md).

## Contract and owner

Reading a fixed-size history page must preserve exact revision order and its
initial upper boundary as history grows. Exercise the existing managed-project
`revision.history` operation through CLI/MCP; keep ProjectStore as the only
history owner. This does not introduce history expiration or asset collection.

## Verification

Create real, fixed-size canvas edits through ProjectStore in memory and back up
the resulting SQLite catalogs at 5,000 and 10,000 revisions. This controls setup
cost without synthesizing rows or replacing the disk-backed public read path.
Verify complete revision IDs and documents, first/middle/last pages and cursor
pinning after a public edit. A fresh query must see the new revision.

Restart the service before measuring the same three 250-row pages. Run three
alternating trials per history size, with repeated MCP reads and sampled service
RSS. Proposed history-specific gates: cached page p95 at most 250 ms, and less
than twice the median resident peak and growth when history doubles. Preserve
individual samples and distinguish sampled RSS from instantaneous peaks. These
extend the scale inquiry to history cardinality; they do not replace 24m's
separate timeline-duration result.

Prove the cursor oracle rejects an intentionally unpinned implementation, using
an isolated scratch mutation. Always drain the service/sampler and retain failure
reports. No media, model, capture, playback, installation or full-project render
is required. A failed budget leads to a measured owner fix, not a relaxed gate.

Implementation structure is delegated; production query semantics and existing
cursor limits remain unchanged. Root owns hub, evidence and choices integration.
