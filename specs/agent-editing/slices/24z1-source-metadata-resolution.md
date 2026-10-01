# 24z1 — Fresh source metadata batches

Status: integrated with [merged public functional/work proof](../assets/24z1-source-metadata-resolution/merged-verification.json).
Root's original full project-evidence file retains three unchanged deadline failures;
the later [composition append correction](24z6-composition-appends.md) passes all
three in the full unchanged suite.
The preserved
source-cardinality latency budget and full production scale acceptance remain
open under [24z](24z-source-cardinality.md).

## Contract and owner

A synchronous source-dependency validation phase reads each shared asset once and
its acquisition identities once each. Source support and binding checks retain
exact clocks, availability, evidence generations and refusal semantics. A later
phase starts fresh: no metadata map crosses a checkpoint-publication await or
survives into another request.

[Source selection](../../../packages/core/src/source-selection.ts) owns the shared
support rules. Evidence can use those facts without resolving a renderable file
address. Render/inspection callers retain the same file-addressed selection shape.
[Capture reads](../../../packages/core/src/capture-source-read.ts) lower asset
metadata once per batch and retain complete acquisition checks. Project evidence
still validates every dependency before and after awaited checkpoint publication.
Scene preparation retains its existing per-source validation/admission order;
this pass does not batch its side effects or change transcript preparation.

## Why this work

The [historical profile](../assets/24z-owner-profile/README.md) attributes a material
share of sampled work to repeated acquisition and asset metadata reads. The bounded
red regression returns the correct cursor row while repeating those reads. This
justifies removing duplicate resolution at these existing owners; it does not
establish the cause of the original warm-cohort failure or a new latency result.

No durable cache, table, endpoint, schema, feature flag or budget is added. Physical
segment metadata still supplies exact support; this pass shares its reconstruction
within a phase rather than replacing it with an incomplete header or summary.

## Verification

[The packet](../assets/24z1-source-metadata-resolution/README.md) retains the red/green
metadata-work regression, post-await validation falsification/restoration, actual
public CLI/default-MCP queries and complete row/dependency/coverage oracles. The
public fixture reuses the retained authored journal and tiny movie, admits four
independent acquisitions and authors equal 1,024-clip projects using two versus
four identities. Complete 250-row collections preserve empty-prefix continuation,
checkpoint-byte progress, generation/query refusal and originals, without native
work during reads.

Broader source/asset/audio checks retain their observed failures under host
contention; deadlines are unchanged. Candidate correctness and reduced work do
not imply a 250 ms p95 pass. Any later timed measurement needs a named changed-code
hypothesis and a coordinated whole-host window. Do not reopen the historical
catalog, substitute its missing frozen worker or repeat its warm cohort.

Root's merged archive also retains the complete terminal scratch catalog/media,
checkpoint bytes and independent cursor/manifest/digest checks. The original
candidate packet is unchanged. The two new regressions pass in the merged test
file, while three existing larger cases time out on that producer. The later 24z6
producer passes the full suite; neither result rewrites the original packet.

Delegated: internal batch/helper names and bounded observer organization.
The request-local sharing and scene-order boundaries are disclosed in the packet's
choices report for the root implementation ledger.
