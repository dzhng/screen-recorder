# 14c3c3 — Public package raw cursor pages

Status: implemented. See [public cursor evidence](../assets/portable-inspection/public-package-cursor.md).

cursor.raw accepts exactly one recordingId or packageHandle through the existing
operation registry. Its range remains source time and its sourceRevisionId remains
r0: edited revision selection must not filter or reinterpret raw observations.

The range, continuation identity, integrity summary and response owner are factored
from SourceProcessing into shared core readRawCursor. SourceProcessing resolves
library readiness as before; PackageInspection resolves the existing retained
source metadata and FileSourceEvidence through its issued handle. The normalized
SourceEvidenceReader remains the one pagination/row-validation implementation.
No extra queue, native request, catalog row or source copy is needed.

Continuation binds the exact library target or process-local package handle,
source ID, generation and source range. Another open of the same ZIP cannot reuse
it. Changing page size is allowed; changing filters or generation is rejected.
Closed/restarted handles stay invalid and same-ID library deletion cannot revoke
package evidence. Existing positive sixty-second range and bounded page-size
limits stay unchanged, including library readiness errors.

Verification: preserve source-reader, processing and protocol tests. Through actual
CLI and MCP, read small pages from a generated relocated package, compare complete
samples and integrity with the normalized source fixture, prove range/generation/
cross-open continuation rejection, same-ID library deletion isolation, and close/
restart invalidation. The test keeps an unrelated sibling package readable and
hashes original archive bytes. No timeline/transcript surface is implemented here.
Internal naming is delegated; the raw source-time contract is fixed.
