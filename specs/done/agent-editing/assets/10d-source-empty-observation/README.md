# Physical no-picture observations

A source analysis grid can miss a narrow supported interval. The actual-native
[short-island experiment](short-island.json) demonstrates a supported interval
between grid requests: every grid point is unavailable while demanded pictures at
both support edges succeed and name the same physical sample. Source index
selection must request those edges directly.

A failed decoder does not prove a missing picture. Native extraction now names
only the known empty-buffer result with a dedicated outcome. Missing timestamp
metadata remains invalid evidence. MediaFrameInspection normalizes the empty
result into a precise requested-point observation and snapshots the selected
stream/context, support digest, renderer identity and originating attempt.
The [actual-native receipts](native.json) show this through queued frame requests
for two tracks with real empty edits inside deliberately coarse declared support.
The snapshot survives forgetting the temporary job; reading it never needs that
job to remain. Surrounding pixels remain unknown.

Verification: core types/build and 22 focused source/project/index tests pass.
The existing native source-frame harness preserves stream selection, physical
clock receipts, support exclusion and original bytes; its empty-edit assertion now
requires the dedicated no-picture outcome. Generic unavailable, decoder,
unsupported-media and invalid-response failures cannot become retained empty
observations. No app was launched, capture made or audio played. This changes no
successful PNG pixels and makes no new visual quality claim.

This is a prerequisite for source-index selection/materialization. Automatic index
selection, storing demanded-observation provenance and public index routes remain
open. The service must use the new source renderer implementation identity when
integrating this outcome so earlier generic failures cannot answer its requests.

Independent review found no actionable correctness issues and reran 14 core
source-frame tests. Shape review keeps normalization and snapshot authority in the
existing frame owner; it introduces no cache, scheduler or native success schema.
Native execution evidence above was gathered separately by the implementer.


The integrated service now pins `native-source-picture-v2`, so an older generic
unavailable attempt cannot stand in for a typed no-picture observation. The actual
source-frame CLI/MCP journey passes on the new frozen worker, preserving its
existing delivered-image, source-clock, gap, cancellation/retry and owned-media
checks (`integrated-public.json`). All 22 focused source/project/index tests pass
(`integrated-core.txt`). This does not make source-index selection public yet.

The combined integration review found no actionable defects and reran 19 targeted
source-frame/index tests. The separate 22-test and actual public native results
above retain their own verification scope.
