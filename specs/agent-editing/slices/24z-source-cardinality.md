# 24z — Source-selection cardinality in bounded cursor reads

Status: **open**. Correctness diagnostic completed; the single timed cohort is red
on a contended machine, and owner profiling is unavailable. No production defect
or fix is selected. Dependencies:
[24x](24x-evidence-continuations.md) and [24y](24y-source-event-duration.md).
Final production acceptance still follows [23](23-cutover.md).

## Contract and missing proof

A complete cached 250-row project cursor query keeps its unchanged 250 ms p95
budget at the existing 1,024-selection boundary, with truthful pinned source
dependencies and complete rows. 24y's duration cohort held source cardinality at
one; it does not establish this dimension.

## Seam and ownership

Exercise existing `ProjectEvidenceInspection`, `CaptureSourceRead`, source
selection/acquisition lookup and continuation owners through public CLI/MCP.
Validation resolves every dependency even for a bounded page. The 1,024-selection
cap bounds that work; source growth is an unmeasured risk, not proof of a bug.

Reuse the tiny authored movie in `assets/10d-public-scenes`. Prepare one explicit
synthetic journal with one in-support cursor observation using existing native
normalization/import owners. Import under distinct request identities so video
bytes deduplicate while 1,024 acquisition identities remain independent. No new
recording, inference or personal-content judgment is required.

Compare 512 acquisition selections reused twice with 1,024 used once. Both
projects contain 1,024 explicitly authored clips, identical placements/ranges,
one video track, empty processing/routing and the same revision count. Use the
same populated catalog; only referenced dependency cardinality changes.

## Work and review surface

Create a focused source-cardinality harness using existing service/fixture helpers.
Record cold setup/query cost separately. Query the full window containing all
1,024 clips. Collect exactly the first 250 rows, requesting the remaining count
on each continuation, including empty pages; stop at 250 and retain a nonnull
continuation. Run twenty warm collections per arm and measure the unchanged
250 ms p95 over each complete collection. Alternate arm order;
record service RSS, total/page latency, checkpoint/manifest and response bytes,
dependency-resolution work and actual native calls. Query-time media/inference
work is forbidden. Compare all expected rows from independently authored input:
source/project clocks, coordinates/buttons, ordinals, occurrence/acquisition IDs
and coverage. Verify checkpoint progress and pinned-query refusal.

Use an unconfigured SDK client for this compact fixture’s MCP reply and compare
both text/structured bodies with CLI. Report actual bytes and capacities. This
can establish only this fixture’s default-client delivery; 24y's preserved default
10 MiB failure for a large edit receipt remains open. Do not expand a client
limit or compact production receipts to hide a failure.

The [diagnostic harness](../../../packages/test-harness/editing/source-cardinality.mjs)
separates public preparation, correctness verification and timed collection. Its
[authored fixture](../../../packages/test-harness/editing/source-cardinality-fixture.mjs)
places 1,024 clips at `i * 200000` microseconds, each 100,000 microseconds long.
The first 64 select source `[0,100000)` and contain no cursor observation; the
rest select `[350000,450000)`. One authored observation at capture time 650,000
maps to asset time 400,000 through the admitted -250,000 offset. Thus the prefix
must cross an empty continuation and then return occurrences 64–313. Both arms
query the entire `[0,204700000)` project window. Arm 512 selects acquisition
`i % 512`; arm 1,024 selects acquisition `i`. All other authored state and the
populated catalog are shared controls.

Collection timing starts before the first public MCP request and stops after the
last ready response supplies row 250. Complete row/dependency/coverage comparisons,
MCP text-versus-structured checks and artifact serialization happen outside that
interval. Cold preparation is reported separately; warm collections must require
one ready response per page. Saved checkpoint bytes must change as traversal
advances, including when a page is empty. Module-resolution paths and hashes pin
the isolated compiled owners, independently of external dependency symlinks.

## Acceptance and failure boundary

Preserve the unchanged cached 250 ms p95 budget and source/dependency correctness.
Report memory against the exact source-cardinality controls; the duration-memory
less-than-2x rule is not automatically a source-cardinality acceptance threshold.
Preserve original media and existing continuation/preservation gates. A red
measurement is retained and profiled at its existing owner before selecting a
fix; it does not justify a new cache, endpoint, retry loop, schema or higher budget.
No full-scale/post-cutover acceptance, physical timing or listening verdict is
claimed here. No installed switch or frozen-worker replacement.

Delegated: harness organization and bounded instrumentation/report names. This
pass adds verification only unless a separately reviewed owner fix is justified
by its red result. User feedback changing this contract updates the child before
expansion; passed unrelated cohorts are not repeated to create activity.

## Retained diagnostic and next boundary

The [verification record](../assets/24z-source-cardinality/verification.json) and
[curated evidence archive](../assets/24z-source-cardinality/evidence.tar.gz) retain
public admission, complete independent oracles, default-client delivery, CLI
parity, changed-query refusal, checkpoint progress and the deliberate wrong-clock
failure followed by restored correctness. Source bytes deduplicate while all
acquisition identities are publicly admitted and independently normalized.
The [root integration check](../assets/24z-source-cardinality/merged-verification.json)
verifies every retained member and the measured harness pins without another run.

The one approved alternating timing cohort completed without a retry or budget
change. Its original red measurements remain in the packet. Before/after process
snapshots reveal substantial unrelated CPU workloads, so these measurements do
not establish an isolated p95 or source-cardinality causality. Any later latency
claim needs a whole-host contention preflight before launch; coordinating only
this project's lanes does not establish that condition. Resident memory is
descriptive only. Static dependency-resolution counts identify the existing read
path's repeated work; they do not measure its share of elapsed time.

The frozen worker's hash was verified for preparation and at timed-run startup;
query logs contain only workspace cleanup, with no media or inference work. A
subsequent bounded profile attempt failed its worker-file check with `ENOENT`
before the service started. Known retained locations yielded no identical copy.
The packet marks owner profiling unavailable; a current-source worker is not a
substitute for this frozen cohort. The failed startup CPU trace is not a query
profile. The prepared catalog remains retained for a separately scoped native-free
query profile with its own verified runtime and explicit provenance; no substitute
run was performed.

Keep this child open. Further work needs reviewed runtime authority and owner
attribution before selecting an optimization. This pass does not authorize another
cohort, relax the budget, close the preserved default-SDK large-edit-receipt
failure, or claim full slice-24 acceptance.
