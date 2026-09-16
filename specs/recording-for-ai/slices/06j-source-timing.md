# Source timing evidence for audio and trail boundaries

Status: integrated; [native evidence](../assets/source-timing/native-review.md) and
[root integration](../assets/source-timing/integration-review.md) pass.

Audio inspection must distinguish captured quiet from missing acquisition. Default
trails must reset at pauses. Both use capture timing already owned by the native
journal parser. Extend its normalized source evidence stream, rather than decoding
video again for timing or introducing a TypeScript journal parser.

Completed pauses carry their written source boundary and elapsed duration. Audio
acquisition intervals coalesce per role through the same native owner used by
recovery; only the current interval for each role is held during export. Completed
records may be emitted after later cursor records, so consumers index source time
instead of assuming cross-event chronological order. An unfinished pause remains
explicit in the receipt; no elapsed time is fabricated.

Core keeps cursor, geometry, pause and audio evidence in one published generation.
It validates counts and timing, supports bounded indexed reads, and retains native
prefix-integrity markers. Source time is shared by capture media and acquisition;
the native writer starts every file session at source zero, so current captures
need no invented per-track clock offset.

The source-only processor still pins the original revision. Public raw cursor reads
remain source-time queries; edits only affect later projections. This is a fresh
evidence format, following the existing no-migration development policy. Original
media/journals are never modified or deleted.

Acceptance: real native normalized timing exports, corrupt/truncated-prefix
honesty, bounded ingestion/query tests, no unrequested-role audio, merged-interval
query boundaries, and the own-window source-processing/frame integration gates.
Audio excerpt planning and the default scene/trail producer remain later work.
