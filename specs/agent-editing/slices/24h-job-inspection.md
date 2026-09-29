# 24h — Read job status without loading execution plans

Dependencies: [24e](24e-job-status.md), capture catalog16.

Status: compact inspection and bounded digest identity are implemented; focused
lifecycle, public10k, export preservation and independent review pass. Evidence
retains the exact bounded-work check and the earlier failing measurements.

JobQueue owns the exact execution recipe and its digest. The digest selects an
indexed candidate; admission, adoption and publication compare the original input
before accepting identity. A hash collision refuses explicitly. Public inspection
reads the stored digest and current summary, without reading or rehashing the
recipe. Availability checks preserve exact project/revision membership and deletion
without hydrating project content. Asset availability checks indexed presence without
loading physical segment rows; import/acquisition intents contain only bounded
identity and file-role metadata. Existing result and failure semantics remain.

Compact digest indexes replace recipe-sized identity indexes. Export recovery also
needs ordered retirement of its bounded export/attempt keys, so its existing owner
keeps a partial index limited to that artifact. Exact SQL joins use JobQueue's same
digest function; no second identity computation, queue or cache is introduced.

Catalog17 follows the developmental refusal contract: older catalogs are not
rewritten. Frozen historical evidence remains intact. Raw recipes are still stored
for execution and provenance; this pass does not make all retained history free.

The public [workload](../../../packages/test-harness/editing/job-inspection.mjs)
compares one occurrence and10,000 occurrences, admits and cancels each preparation,
then measures CLI/MCP reads after restart. SQL capture is separate from timing.
The bounded-work gate is no recipe/document materialization or recipe-sized binds,
not a machine-specific latency threshold. [Evidence](../assets/24h-job-inspection/README.md)
retains the original red and storage/query plans.

Whole24 remains open. Preparation/admission and readiness APIs that return full
recipes still do work proportional to those inputs. Published result size, general
startup/history scans, other target owners and cross-revision export recovery
eligibility are not newly proven constant-work. No DSP, listening or scale budget
is relaxed by this checkpoint.
