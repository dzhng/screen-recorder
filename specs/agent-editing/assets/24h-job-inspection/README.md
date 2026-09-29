# Recipe-independent public job inspection

The retained baseline reads a15,944,124-byte recipe twice, binds it twice, hydrates
a4,095,341-character project revision and hashes the input to return476 bytes.
The final public workload returns the identical status after restart using three
indexed reads, no returned recipe/document bytes and at most157 bound characters
per statement. One-clip and10,000-clip projects use the same source WAV hash.

Baseline/final MCP medians are0.80/0.58ms for the small job and29.96/0.52ms for the
large job. CLI includes process startup:89.00/87.68ms and122.21/87.52ms. Service
peak RSS across mixed polls falls from351,072KiB to102,368KiB. These are local
observations, not per-call allocation attribution, isolated throughput claims or
new acceptance thresholds. The gate is work independent of recipe/document size.

Actual canceled-job storage shows the identity index fall from15,970,304 bytes to
4,096 bytes. A separate storage-only experiment inserts explicitly synthetic
publication rows for those same recipes: the artifact identity index has the same
reduction. Raw payload tables retain their bytes. The synthetic publication rows
are not a successful processing claim; the prior full two-hour DSP evidence stands.

The valid source-target service gate imports a native-probe fixture with200,001
physical segment rows, admits a frame job and observes its persisted failure.
Public status remains identical while its availability query reads only indexed
asset presence. Restoring full metadata availability fails on metadata/segment
reads. This is a metadata/routing fixture, not native decoding evidence. Subsequent
intentional damage to segment JSON is a separate diagnostic-isolation control.
Import/acquisition intents retain bounded identity/file-role metadata.

Export lifecycle plans retain the covering snapshot page and exact digest seek.
Recovery retirement/cancellation uses its partial bounded-key range index. The
cross-revision startup eligibility join still has its existing target-prefix scope;
this checkpoint does not establish a global bound for that scan.

The archive preserves baseline, countercontrols, SQL/plan observations, exact
recipe inputs, synthetic source WAV, final public report and review. Every member
was reread and authenticated against [manifest.json](manifest.json).
[verification.json](verification.json) gives build order and reproduction commands.
Older catalog14/15 evidence was not migrated; catalog17 follows the development
format-refusal contract.

Independent Codex review found no actionable regression and passed102 core tests;
its service tests were blocked by local-socket sandbox restrictions. Author gates
pass147 focused tests including the source-availability and cross-table collision
followups, six export lifecycle tests, final public workload and types. Root direct
review resolved both followup concerns. Whole24 remains open: readiness/execution input costs,
retained history, result size and broader startup/routing remain separate.

[Integrated verification](root-verification.json) confirms catalog 17 inspection,
export recovery and prepared-asset package preservation on the combined native
worker. [Reports and logs](root-verification.tar.gz) retain that scope.
