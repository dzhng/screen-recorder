# Native media metadata checkpoint

The worker probe is implemented; asset admission and the full format/visual matrix
are not complete. Seven public-worker tests pass after rebuilding. They cover the
frozen H.264/PCM/still fixtures, variable sample durations, source orientation
metadata, alpha, independent stream offsets, strict requests, and B-frame edit
lists with stream-copy preroll. No full-import or visual acceptance is claimed.

Independent Codex review found that compressed-reader timestamps were being
reported before edit-list mapping. The regression fails on that implementation
(`83333` instead of `0`). The fix walks sample cursors through the existing
`SourceSegment` mapping, intersects presented edits, and excludes preroll. The
full seven-test file then passes. Cursor iteration retains no array of samples;
each iteration advances or reports an error. Codec decodability is the platform's
metadata claim, not proof that every frame of the file can decode.

Shape review keeps probe metadata in the existing media target and request parsing
in the existing wire boundary. There is no new renderer, timing owner, runtime
dependency or storage path. Actual asset decode, source mutation/publication,
format admission and visual orientation remain owned by slice 02.
