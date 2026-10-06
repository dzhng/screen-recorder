This receipt records findings from the initial audio-corpus review. The current
branch resolves both findings; the receipt remains as historical review evidence.

Full review comments from that earlier review:

- [P2 (resolved)] Preserve fractional probe origins when deriving — /Users/server/dev/yap-video-editing/packages/test-harness/editing/video-corpus.mjs:77-83
  When a source has a non-integral `originUs`, the native exact-time contract returns an object such as `{numerator, denominator}`. Applying JavaScript unary `-` converts that object to `NaN`, which is serialized as `null` and rejected by `media.sourceAudio`, so valid fractional-timestamp inputs cannot be derived.

- [P2 (resolved)] Store corpus audio through Git LFS — /Users/server/dev/yap-video-editing/.gitattributes:3-4
  The new WAV files were staged as full Git blobs despite this `filter=lfs` rule. The tracked files now use LFS pointers; a working tree may contain smudged media bytes when LFS is available. This restores the fixture contract requiring larger retained inputs to use Git LFS (`specs/video-editing-feedback/fixtures.md:7-11`).

Current proof: `node --test packages/test-harness/editing/video-corpus.test.mjs`
passes all 15 focused checks, including the fractional-origin control, and
`git cat-file -s HEAD:fixtures/video-editing-feedback/false-start.wav` reports the
small LFS pointer rather than the media blob.
