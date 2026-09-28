# Public project phrase search

The [retained live report](report.json) exercises CLI and MCP over the actual
project service, jobs, source ingestion and bounded query checkpoints. Only native
ASR output is frozen; [10b](../10b-source-transcript-journey/README.md) independently
verifies native inference. Every recorded runtime hash matches the integrated tree.

Independent expected word identities and authored placement arithmetic verify
cross-clip phrases, reordered words, rational retiming, positive second-track
results/filtering, separate speakers, authored/physical gaps and partial-word
interruption. A partial word between two otherwise matching whole words must
break the phrase. Limits 1/2/500 preserve results; raw-text and cross-domain cursor
reuse refuse. Historical continuations are drained after advancing the head and
restarting, checking the pinned revision on every page.

The same invocation preserves the full paging journey and its independent row
oracle. The subsequent [bounded-query journey](../10c-public-bounds/README.md) adds public
acquired-gap phrases, empty continuations and late-read observation; those claims
come from that later evidence, not this original run.

## Review and sensitivity

[Initial review](review-initial.txt) found weak positive track coverage, a partial
word placed only at phrase start, and historical paging assumptions. The revised
fixture addresses all three. [Final review](review-final.txt) found no actionable
defects; it checked syntax/diff but did not rerun the native fixture itself.

The [wrong-dispatch mutation](dispatch-mutation.json) makes search call the paging
owner and fails the actual journey. The [partial-suffix mutation](partial-suffix-mutation.json)
skips a partial word without clearing the preceding phrase and produces a false
match, failing the independent expected-empty result. Both runtime files were
restored and verified against the passing run's hashes.

Focused integration passes 10 service tests, 11 CLI tests and 23 project/source
core tests, plus workspace type checks and dependency builds. Independent public
routing review found no defect; its socket/native checks encountered sandbox
limits, separately from the passing unrestricted root checks.
