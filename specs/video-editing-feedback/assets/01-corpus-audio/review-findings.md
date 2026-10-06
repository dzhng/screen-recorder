The corpus verification command passes for the committed fixtures, but derivation fails for valid fractional source origins and the retained WAVs bypass the newly declared Git LFS storage contract.

Full review comments:

- [P2] Preserve fractional probe origins when deriving — /Users/server/dev/yap-video-editing/packages/test-harness/editing/video-corpus.mjs:77-83
  When a source has a non-integral `originUs`, the native exact-time contract returns an object such as `{numerator, denominator}`. Applying JavaScript unary `-` converts that object to `NaN`, which is serialized as `null` and rejected by `media.sourceAudio`, so valid fractional-timestamp inputs cannot be derived.

- [P2] Store corpus audio through Git LFS — /Users/server/dev/yap-video-editing/.gitattributes:3-4
  The new WAV files are staged as full Git blobs despite this `filter=lfs` rule (for example, the indexed `false-start.wav` is 639136 bytes rather than an LFS pointer). This makes every clone carry the media and violates the fixture contract requiring larger retained inputs to use Git LFS (`specs/video-editing-feedback/fixtures.md:7-11`).