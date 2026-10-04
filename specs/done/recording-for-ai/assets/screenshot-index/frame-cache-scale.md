# Long-source frame cache companion

The [optional native fixture](../../../../../apps/macos/tests/frame-cache-scale.mjs)
checks cache reuse and eviction against a scratch copy of the preserved generated
30-minute video. The [receipt](frame-cache-scale.json) identifies that input by hash.
It complements the index scale measurement; it does not repeat full indexing or
close real capture, screenshot-density quality, or installed-workflow requirements.

Source and scene jobs are deliberately canceled through their existing owners
before launch. Clean frames do not depend on those jobs, so the actual packaged
service and native decoder can exercise inspection without quietly starting a
second long index run. No ready evidence is fabricated.

A repeated CLI frame request must retain its cache identity, generation, inode,
modification time and image bytes. With the scratch service stopped, the ordinary
cache owner enforces a smaller LRU budget. The cached file must disappear. After
restart, explicit retry must produce a new cache identity and generation with
identical bytes. Streamed hashes verify both the scratch source and original input
remain unchanged; all owned processes are reaped before scratch cleanup.

Run the fixture after building, with `SCREENREC_FRAME_CACHE_VIDEO` set to an
absolute generated-video path:
`node --test apps/macos/tests/frame-cache-scale.mjs`.
`SCREENREC_FRAME_CACHE_EVIDENCE` optionally names a new JSON receipt file.
The test is excluded from the default native test glob because it requires an
explicit preserved input. Bypassing LRU eviction reproduced a failure: the old
cache entry remained readable. Restoring eviction passes.
