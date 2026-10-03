# Prepared admission choices

## Sound — high confidence

### Keep the first encounter order within each resource kind

When several clips use the same audio file, the first occurrence adds its asset
ID to retention and later occurrences add no catalog work. Acquisition IDs—the
separate identities describing admitted recording context—are deduplicated in
their own set. Thus an asset and an acquisition with equal ID text remain two
resources, while the recipe continues to contain every clip.

The requested unique `(kind, id)` contract left the representation and order
unspecified. Separate sets preserve the owner's asset-first, acquisition-second
order without changing the generic reference store or adding an identity format.
Future prerequisite kinds would require their own existing-owner representation.
Verdict: sound; the retention identity remains explicit and occurrence data is
preserved. Confidence: high.

### Observe database work before execution, then exercise normal recovery

A tiny project uses two independent imported files in four clip occurrences.
The existing queue startup barrier keeps execution from contaminating admission
counts. The test observes real SQLite calls, compares complete recipe and retained
resource values, then reopens the catalog and starts the queued preparation.
Ordinary publication releases temporary references; existing adoption tests own
recipient independence after donor output removal.

The task required a consumer proof but left its instrumentation unspecified.
Database observation checks externally executed work without mocking prepared
collaborators or adding a production test hook. Its revision-read ceiling includes
the fixture queue's independent target pin. An asset-header-only ceiling would
incorrectly include path-binding work owned elsewhere, so the final proof uses
revision reads. Verdict: sound; it guards bounded work and real completion while
preserving future cheaper implementations. Confidence: high.
