# Public capture-gap and bounded-query acceptance

The [combined live report](report.json) preserves the earlier paging/phrase gates
and adds explicit acquisition support, empty search continuations and bounded late
reads. All recorded runtime and harness hashes match the integrated tree.
Only ASR responses are frozen; actual native probing and acquisition normalization,
public imports, source ingestion, CLI/MCP and query owners execute normally.

An adopted synthetic capture journal masks the same media used by the physical
source case. The donor is deleted after import. A phrase present in the unmasked
file cannot cross the captured hole; a phrase wholly inside acquired support
remains searchable. Project rows retain the explicit acquisition identity and
the exact source/project hole. Frozen ASR selection keys include support intervals,
so the fixture cannot substitute physical-source words for the captured recipe.

A track with repeated speech produces an actual empty no-match page carrying a
continuation, and following it terminates. A late one-word query reads exactly
one source word and no unrelated transcript. [Read telemetry](late-source-reads.json)
observes real TranscriptStore calls and returns their results unchanged; it does
not replace storage or projection. Its gate allows a small bounded neighborhood,
rather than pinning one internal query. The [eager-read mutation](eager-read-mutation.json)
adds an unnecessary full-source read without changing returned words and fails
after expanding 26 rows.

[Independent review](review.txt) found no actionable defects; it was static and did
not itself rerun the native fixture. Changed-file lint/format and diff checks pass.
This pass adds test coverage and observation only, not a product telemetry API.

Generation invalidation and actual cache-owner eviction retain their real-store
core gates; deleting a public checkpoint file remains explicitly a file-loss test.
Capture event/cursor domains are still required before 10c can close.
