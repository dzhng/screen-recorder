# Durable prepared-audio lifecycle evidence

The [native harness](../../../../../packages/test-harness/editing/prepared-audio.mjs)
uses the production service audio renderer and core queue, asset and project owners.
Its frozen worker digest is recorded in `report.json.gz`, together with the actual
commands, complete pinned manifests and exact sample comparisons. `prepared.wav`
is the initial published float PCM. No external model is needed.

Reproduce after building composition, core and service packages:

```sh
SCREENREC_NATIVE=/path/to/verified/worker node packages/test-harness/editing/prepared-audio.mjs --out /tmp/prepared-audio-evidence
```

The worker must match the harness digest; this run used the current root build
with picture/movie recipe versions 13/10. Native full unit-rate output equals the
independent authored sample oracle. A pure split produces identical PCM under a
different immutable revision identity. Constant gain matches an independent
float32 oracle. After restart, a late historical excerpt reads only its requested
samples with no native invocation or prefix replay.

Core lifecycle tests exercise cancellation, stale completion after retry, database
rollback, orphan recovery, changed files, unavailable-source diagnostics, concurrent
revisions, owner deletion and identical bytes with different upstream sources. The
publication test was first run before queue support and failed rather than passing
a disconnected mock. The [portable transfer checkpoint](../14a-prepared-portable/README.md) now carries
these receipts through public package export/adoption.

Independent review found missing output diagnostics and a portable omission risk;
both were corrected with regression coverage. A subsequent review found no
actionable regression. Shape review keeps bytes in AssetStore, readiness in
JobQueue and historical retention in ResourceReferences. No parallel owner or
background loop was introduced.

Broad core verification is not fully green on this host. The initial concurrent
run had timing failures and a subprocess deadline failure. Serial reruns cleared
all but two deadline failures; a narrower rerun cleared scene ownership. The
remaining large-history project test also exceeds its unchanged five-second limit
with the original pre-change ProjectStore restored. No timeout was increased.
Focused final results are retained in `gates.txt`. Portable relocation is verified in its linked checkpoint; public processor
integration remains open. RNNoise and stretch quality and readiness are unchanged.

[Combined root confirmation](root-integration.json) reproduces the native oracles
and focused lifecycle tests after integration. The retained initial test failure
came from overlapping a dependency rebuild; the completed build and isolated
rerun pass without a code or assertion change.
