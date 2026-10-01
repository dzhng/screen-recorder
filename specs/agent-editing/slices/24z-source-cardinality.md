# 24z — Source-selection cardinality in bounded cursor reads

Status: planned diagnostic; no production defect or fix selected. Dependencies:
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
