# Durable scene chunk storage

The [store](../../../../../packages/core/src/scene-evidence.ts) retains analysis in the
existing catalog. Completion means source coverage is contiguous and complete;
the artifact queue still decides whether that generation is published. This is
only the storage portion of slice 10f, not acceptance of the bundled service or
real UI scene thresholds.

Each chunk preserves request-to-image coverage. Comparisons are deduplicated by
the monotone actual-image frontier while appending, so paging does not require
loading earlier chunks. A repeated pair must match exactly. Boundaries come from
those retained comparisons rather than the local report's clipped boundary list:
a sparse image at second 100 may first be selected around second 50.

One bounded JSON row per analysis chunk keeps coverage and comparisons together.
A separate generation row tracks completion and compact totals without rescanning
the recording. Reads fetch at most one page plus its next-row sentinel. Removal
first makes the generation unreadable, then deletes bounded batches with yields;
a deleting generation cannot be appended to or completed. A crash leaves enough
identity metadata for startup reclamation.

## Verification

The [tests](../../../../../packages/core/src/scene-evidence.test.ts) use the real
catalog and shared analyzer. They cover completed and incomplete restart state,
canonical coverage, exact sparse future comparisons, overlap deduplication,
source/policy/attempt isolation, bounded paging of a thirty-minute source, and
cleanup. The sparse-boundary assertion was falsified by clipping boundaries to
the current chunk: it failed with zero boundaries, then passed after restoration.

Core suite: 143 tests passed after building the fresh worktree. Core build,
TypeScript checking, formatting and lint passed. Independent `codex review`
reported no actionable defects on the production change. The subsequent test
addition extends restart and identity-isolation coverage without changing code.
The initial full-suite run failed because the fresh worktree lacked built core
files needed by an existing subprocess test; building and rerunning resolved it.

## Decision audit

Sound, high confidence: the internal row shape, cursor shape and transaction
layout are delegated by the slice. A caller pages in canonical chunk order;
actual-image boundary times may lie beyond a chunk's requested range. Keeping
that placement means a future screenshot index must consume the explicit actual
times instead of inferring them from chunk positions. It avoids a separate
per-comparison table and preserves bounded writes and reads.

Sound, high confidence: removal has a durable deleting state. If cleanup yields
or the process stops midway, readers cannot mistake the surviving chunks for a
complete scan, and the next cleanup resumes from the remaining rows. This is an
internal storage state, not an additional queue readiness state.
