# Normalized cursor evidence index

Core consumes the native cursor export, never the capture journal. Native owns
coordinates, geometry epochs and journal integrity; indexing preserves its raw
fields and receipt without interpreting pointer eligibility as OS visibility.

An immutable caller-supplied generation identifies each attempt. Index completion
is separate from artifact publication: only the queue may expose a generation.
Readers must use that published identity, so concurrent attempts cannot mix pages.
The service must remove an abandoned generation only after it knows the queue did
not publish it. Recording-wide deletion remains outside this slice.

The catalog stores normalized records alongside revisions and jobs. Ingestion
bounds file chunks, individual records and transaction batches, yielding between
batches so cancellation can remove partial work. A complete, matching receipt is
required before any page is readable. Native corrupt-prefix/truncated-tail markers
remain evidence, not an indexing error; malformed normalized output is an error.

Pagination seeks by source time and normalized record sequence. Sequence is a
stable ordinal in the derivative, not the original journal's sequence. Half-open
ranges exclude their end. Geometry and display-space records remain in the index
for later boundary selection; this slice adds no trail or boundary policy.

Implementation and executable contracts live in
[core evidence](../../packages/core/src/evidence.ts) and its
[tests](../../packages/core/src/evidence.test.ts). Verified with real SQLite:
equal timestamps, out-of-order source times, identity/generation isolation,
partial-ingest cancellation and malformed data cleanup, raw-field preservation,
and a streamed 50,000-sample file whose later pages remain readable after the
normalized file is removed. The SQL plan uses the time index without a temporary
sort. Core build, typecheck and all 54 core tests passed. The source journal is
never opened; the normalized export hash is unchanged by indexing.

Next integration: the service passes the job attempt identity, stores the returned
metadata in the queue publication, and resolves raw cursor requests only through
that publication. Those service/public-protocol paths are not proved here.
