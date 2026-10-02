# 24z — Source-selection cardinality in bounded cursor reads

Status: **open**. Historical correctness and owner attribution are retained;
the original timed cohort is red under recorded contention. Material24z1–12 owner
and delivery corrections are integrated. [Current preparation](../assets/24z-current-preparation/README.md)
uses a fresh format22 public fixture and passes untimed current-production
correctness. The [current measurement](../assets/24z-current-preparation/user-window.json)
returns complete correct output but exceeds the unchanged p95 budget. The
[metadata correction and successor measurement](../assets/24z-current-preparation/metadata-batch.json)
preserve output and pass the 512-source arm; 1,024 sources remain red. The next
action is diagnosis of remaining current owner/transport work from its profile.
No latency pass is claimed.
Dependencies: [24x](24x-evidence-continuations.md), [24y](24y-source-event-duration.md).
Final production acceptance remains with [23](23-cutover.md).

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
establishes only this compact fixture's default-client delivery. The preserved
24y large-edit failure has separate scoped complete-result proof in
[24z11](24z11-operation-result-delivery.md), and pre-consumption media envelope
admission is covered by [24z12](24z12-mcp-media-admission.md). Those proofs do not
establish cached cardinality latency or general scale. Do not expand a client
limit or truncate operation data to hide a failure.

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

Keep this child open. The retained diagnostic itself grants no new cohort or
budget change. Its original default-SDK failure remains immutable;24z11/12 own
the later scoped delivery corrections. The currently authorized measurement uses
new current-production authority and root coordination, not the historical timing
runtime. Full slice24 acceptance remains open.

## Separate owner-profile preparation

The [preparation record](../assets/24z-owner-profile-preparation/verification.json)
and [review](../assets/24z-owner-profile-preparation/review.json) preserve a separately
pinned runtime for owner attribution against the retained catalog. The original
red cohort and its frozen-worker authority remain unchanged. Exact query sources,
compiled modules and local import resolution are checked independently of the
current worker's provenance; this runtime does not inherit a performance verdict.
The [merged verification](../assets/24z-owner-profile-preparation/merged-verification.json)
rechecks those identities and actual ESM SDK resolution without starting the service.

The harness has an opt-in profile phase using the existing service IPC owner.
Sampling ends before oracle comparisons and artifact serialization; native work
inside a profiled read is refused. Synthetic lifecycle checks cover delivery,
interruption and operator limits, but do not establish actual service integration.

Preparation recorded **zero actual profile attempts, project read attempts or
service starts** at that checkpoint. The whole-host preflight showed substantial unrelated compiler
and renderer activity, so dispatch was deferred without polling or retry. Raw
process inventories remain outside the repository; their hashes are retained.
A future attempt requires a separately coordinated window, fresh whole-host
inspection and reverified runtime pins. The prepared catalog and isolated runtime
remain available even if the main camera implementation changes. No owner
attribution, optimization or broader acceptance is claimed.

The [read-only runtime authority check](../assets/24z-owner-profile-preparation/runtime-authority-preflight.json)
preserves this as historical owner attribution. It rechecks the isolated code and
module pins and compares logical catalog rows with the pinned seed. Current source
has advanced; do not refresh that runtime or open its catalog through later
capture startup. Its catalog predates the capture-table contract. Already READY imports require
no unfinished-donor recovery. No database-byte history, current-production SLA,
profile or timing pass follows from this read-only check. Coordinate a separate
bounded profile window after owned capture checks finish.

The later [coordinated window](../assets/24z-owner-profile-preparation/coordinated-window-preflight.json)
confirmed those owned checks were terminal but found unrelated whole-host CPU
contention. Dispatch was deferred before runtime re-verification or service start;
actual profile/read attempts remain zero. Own-lane quiescence is insufficient.

The [post-atomic window](../assets/24z-owner-profile-preparation/post-atomic-window-preflight.json)
again found unrelated compiler/simulation contention after owned checks ended.
Its full raw inventory is hashed outside the repository. Dispatch and runtime
reverification were deferred; no service, read, profile, timer or polling began.

The [dispatch-readiness audit](../assets/24z-owner-profile-preparation/dispatch-readiness.json)
found the heavy workloads absent and reverified runtime/import identities. Dispatch
was withheld under the then-recorded restriction: this pinned service always
constructs `Models`, whose constructor creates directories and clears/recreates
staging. A query-only worker allowlist does not prevent that startup mutation.
No service or profile began during that audit. The user subsequently explicitly
authorized model work, so ordinary model-storage initialization is permitted in
the isolated library. Preserve the historical runtime; dispatch remains subject
to a fresh whole-host preflight and identity verification. Do not substitute a
different service or transfer this profile to current-production acceptance.

## Completed owner attribution

The [profile checkpoint](../assets/24z-owner-profile/README.md) retains one failed
module-link dispatch and one corrected service run with two bounded collections.
The runtime's omitted JSON resources are restored from its original emitted
files, with exact historical source identity and parsed-data equality. Query code,
worker authority and limits are unchanged. Every collection returns the complete
expected rows through advancing checkpoints without native work inside the read.

The raw samples identify acquisition reads and asset header/segment reads as a
material share of work. Investigate repeated metadata resolution at those owners;
preserve complete dependency validation before and after checkpoint publication,
generation/refusal semantics, coverage and exact public output. Review a concrete
owner change and prove its affected contracts before new measurements. Background
apps remained active; this is attribution, not isolated timing or an explanation
of the original red cohort. The unchanged p95 budget and final-production gate
remain open.

## Metadata owner correction

[24z1](24z1-source-metadata-resolution.md) removes repeated asset/acquisition
resolution within each synchronous capture-dependency phase. Fresh checks remain
on both sides of checkpoint publication. Its public proof uses a new isolated
catalog, four admissions and the retained authored input; no historical runtime,
original warm cohort or budget changes. Keep this parent open for coordinated
latency and final-production acceptance.

## Current production pickup

The [current preparation packet](../assets/24z-current-preparation/README.md) banks
one actual public preparation and untimed correctness from current owners. The
original format20 catalog is never opened through current startup. Fresh admissions
preserve the same authored input and independent512/1024 comparison; no private
rows, migration or model preparation is used. Current worker0a and emitted/SDK
closure are pinned separately from historical workers and runtime.

Accepted preparation/correctness and later measurement observation have separate
executed source identities. Every query-native boundary is checked; correctness
contains no latency samples. Before measuring, require completed storage/source
closure, all root lanes terminal, one fresh whole-host CPU check and explicit root
coordination. Run the existing measure phase once with unchanged250ms p95 and twenty
alternating warm collections per arm, without coverage/profiling instrumentation.
A non-ready reply fails immediately. Preserve a red result rather than retrying,
polling host contention, changing a limit or inventing another required slice.

The [current offered window](../assets/24z-current-preparation/user-window.json)
supplies the first measurement and complete two-arm CPU profiles. The
[successor](../assets/24z-current-preparation/metadata-batch.json) follows one
general metadata-read correction: complete output and 78 merged owner tests pass,
512 sources meet the target and 1,024 do not. Each run retains its observed load.
Never combine validation phases across checkpoint publication. Further measurement
requires a concrete correction justified by remaining owner/transport attribution.

The [single coordinated preflight](../assets/24z-current-preparation/coordinated-preflight.json)
after preparation integration found unrelated active graphics/simulation work.
Dispatch was deferred before runtime reverification or service startup. The raw
whole-host inventory stays outside Git with its complete hash and criteria; no
measure phase, timing sample, host polling or retry occurred. The prepared namespace
and immutable preparation/correctness packet remain available for a separately
coordinated window. This condition supplies no latency verdict or causal claim.
