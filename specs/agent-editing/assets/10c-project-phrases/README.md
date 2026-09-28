# Project phrase search

[Project evidence](../../../../packages/core/src/project-evidence.ts) searches each
selected audio track in playback order. A bounded suffix survives clean contiguous
cuts and page boundaries. Authored gaps, acquisition/native gaps and partial words
clear it; simultaneous tracks never contribute to the same phrase. Normalization
uses the source reader's literal search rules.

A match retains each contributing word's original source identity, generation and
full editorial fragments. Its exact project range spans the first word's start to
the last word's end. The heap merges per-track matches by their first word, rather
than the time the last word becomes available: a slower speaker's earlier phrase
must precede a faster speaker's later phrase.

Search shares the existing revision context, dependency manifest, disposable cache
checkpoints and generation fences with transcript paging. Query identity includes
raw search text and domain; normalization affects matching, not continuation
identity. Retry selects the search manifest when text is present and still leaves
source preparation failures to the source owner. Empty continuation pages represent
bounded scanning, including a track with no matching phrase. Checkpoints retain
suffixes and source positions, so following them does not reread the prefix.

The paging evidence's provisional limits and remaining checkpoint I/O cost also
apply here. Search additionally bounds emitted matches and counts scanned gap/word
rows against the work budget. A no-match track may require several bounded pages
before another track's match can be safely emitted; this preserves exact ordering
without speculative full-source expansion.

## Verification

Real catalog/project/source/cache integration tests cover first-word ordering,
contiguous cross-clip identities, authored/native/acquired gaps, partial-word and
cross-track refusal, rational timing, query/domain/cache/generation invalidation,
and bounded tied-track initialization with near-linear total source reads at
limit one. Three mutations prove ordering, gap and partial-word guards matter.
The linked logs preserve those failures and the focused recording/source/package
reader preservation run. Native speech in these tests is a boundary fixture;
public CLI/MCP phrase journeys and project event/cursor inspection remain open.

The focused preservation run passes 60 tests, including 18 project cases. Core
build/type checks, formatting, lint and diff checks pass. Independent Codex review
re-ran the project suite and reported no actionable regressions. The shape review
kept one traversal, heap and cache lifetime; search adds only per-track suffix and
match-head state. No persistent schema, cleanup owner or renderer path was added.
