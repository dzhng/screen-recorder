# Capture observations in source and project time

[CaptureSourceRead](../../../../../packages/core/src/capture-source-read.ts) resolves
only explicitly selected acquisition bindings. Capture provenance is not authority
to recover a journal implicitly. Raw observations retain their capture timestamp,
sequence, coordinates and eligibility; a separate asset timestamp applies the
binding's clock offset. Project traversal uses composition's exact point mapping,
including ancestor support, without a renderer schedule or spatial pointer transform.

Cursor observations and timed geometry apply to captured video streams. Pause
markers apply to explicitly bound timed media. Missing context is unavailable;
retained evidence with no observations is ready empty. Untimed geometry has no
invented project timestamp. The raw source receipt preserves integrity markers,
and category coverage explicitly names untimed geometry and unsupported scene,
cut and interruption inspection. A missing implementation is not advertised as
preparation or retry work.

[The shared query owner](../../../../../packages/core/src/project-evidence.ts) pins
capture dependencies in the same disposable manifest/checkpoint lifecycle as
transcripts. Domain readers own row traversal; the shared exact heap owns ordering
and bounded initialization. Existing transcript and phrase semantics remain separate
from capture applicability. Capture timestamps use half-open source/query windows;
recording/package timeline marker semantics remain with their existing reader.

Metadata capability and acquired continuity are different. The first ready project
page includes exact per-occurrence available/unavailable ranges from composition.
Continuations reference that immutable coverage by manifest ID, avoiding its repeated
transmission. Source reads similarly expose selected acquired intervals on their
first page. Mixed projects retain useful observations and explicit unavailable
source coverage rather than reporting a fabricated complete empty result.

## Bounds and evidence

Capture inspection follows the named operation's row limits: events 500, cursor
5000. Source scans and project clip advances are bounded per request and may produce
empty continuation pages. The existing manifest/checkpoint size and occurrence
bounds still apply. Capture response data has a provisional 4 MiB ceiling, leaving
transport-envelope headroom beneath the public 8 MiB response frame. Oversized
responses explicitly refuse before publishing a continuation and can be narrowed by
range, tracks or page limit. There is no extra duration cap for the new source/project
cursor branches; the existing recording cursor's duration rule is unchanged.

The native exporter produced `native-source-excerpt.jsonl` from the existing narrated
recording, with full normalization hashes/receipt in `native-source-origin.json`.
The retained excerpt is exact normalized data; the integration test's acquisition
metadata and media probe are controlled fixtures, not a new live capture claim.
Other real-store cases cover offset/rational timing, raw-coordinate preservation,
visual applicability, masks, ready-empty/missing context, historical revisions,
query/domain/cache invalidation, late indexed seeks, tied-track initialization,
near-linear source reads and response-size refusal. Mutation logs demonstrate that
clock, seek, support and response guards affect observable behavior.

Public CLI/MCP event/cursor journeys remain open, as do scene/project-cut/interruption
categories. This pass does not claim full recording-event parity or close slice 10c.

The focused preservation suite passes 101 tests, including 25 project cases;
119 composition tests also pass. Build/type/format/lint checks pass. Independent
Codex review re-ran the project suite and type check with no actionable defects.
The current public transcript/phrase journey from committed harness `65fc2c6`
also passes against this isolated core, including acquired gaps, bounded empty
search continuations, historical reads and the one-row late-window oracle. The
preserved report records runtime hashes and agreement with the integrated baseline;
ASR alone uses frozen output, while admission/probing/acquisition and transports
remain real. Copied route adapters allowed this core-only worktree to exercise
that newer committed harness without adding service or harness edits to this pass.
