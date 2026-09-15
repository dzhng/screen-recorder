# Durable artifact jobs — verification evidence

Subpass: [06g](../../slices/06g-durable-jobs.md). Host: macOS 26.6.2 arm64,
Node 24.14.0, Bun 1.3.14, Vitest 5.0.0. Branch `codex/durable-jobs`.
Every catalog below is a real temporary SQLite database under `$TMPDIR`; every
executor is the test's own held function. No media, model or native worker took part.

## Commands

| Command | Result |
| --- | --- |
| `vitest run --root packages/core` | 38 passed (3 files), including the 9 job tests below |
| `tsc -p packages/core/tsconfig.check.json` | clean |
| `oxlint packages/core` | clean |
| `oxfmt --check` | clean for every file this pass touched |
| `bun run check-types` | 10/10 workspace tasks successful |
| `vitest run --root apps/service` | 44 passed — the same store through a real socket |
| `vitest run --root apps/cli` | 3 passed — CLI/MCP over the same store |

## Behaviors pinned

```
✓ identical work is admitted once while it runs, and again only after it published
✓ a restart fails the interrupted attempt, whose late answer cannot overwrite its retry
✓ an edit during processing does not move the revision the work was admitted for
✓ one heavy and two frame attempts run at once
✓ a new heavy job waits while a take is capturing; frame work does not
✓ canceling a running job frees its lane only once the work settles
✓ work that outlives a discarded take publishes nothing and does not revive it
✓ waiting work is bounded, while work already admitted still answers
✓ a validated absence is not retryable, while an ordinary failure is
```

Determinism comes from acknowledged events, never elapsed time: an attempt is observed
by the executor being called, and a settlement by the promise the test itself resolves.
There is no sleep, timer or retry budget in the module or its tests.

## Falsification ledger

Each guard was removed or inverted in turn, the suite re-run, and the failing tests
recorded. No guard is unproved, and no test is insensitive to the guard it names.

| Broken | Tests that went red |
| --- | --- |
| Stale-attempt guard on publication | restart/late answer; cancellation |
| Publication requires a present, non-discarded take | outlives a discarded take |
| Heavy lane limit 1 → 2 | heavy/frame concurrency; cancellation; bounded admission |
| Frame lane limit 2 → 3 | heavy/frame concurrency; outlives a discarded take |
| Capture pauses new heavy work | heavy waits while capturing |
| Queued admission bound | bounded admission |
| Restart turns a running row into a retryable failure | restart/late answer |
| Publication uses the pinned revision | edit during processing |
| Submit deduplicates queued/running work | dedup; bounded admission |
| Claim drops work whose take was discarded | outlives a discarded take |
| Publication increments the artifact generation | dedup/republication |

## What this does not show

No transcription, frame decode, export or native worker exists yet, so nothing here
says work of that kind succeeds, costs what it should, or reports honest reasons. Every
published result was a string supplied by the test. Deletion is not implemented in core:
the publication guard is proved through cancellation, and stopping a recording's work
before removing its media remains future integration. Export dependency scheduling
(waiting on evidence without holding a lane) and `ARTIFACT_CHANGED` pagination against a
pinned generation are not implemented here.
