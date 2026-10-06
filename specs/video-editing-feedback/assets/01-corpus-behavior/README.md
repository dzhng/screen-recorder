# Scoped real-media behavior ledger

`packages/test-harness/editing/corpus-behavior.mjs` is the aggregate checker for
the retained real-media manifest. It requires every physically certified case to
name an existing, hashed behavior receipt. The receipt is deliberately scoped:
audio cases retain recognition/timing evidence and the three picture cases reuse
the accepted sampled source/project picture replay. It does not promote global
multicamera synchronization, speaker continuity, or editorial quality.

Replay it with:

```sh
node packages/test-harness/editing/corpus-behavior.mjs \
  fixtures/video-editing-feedback/manifest.json
```

The [receipt](receipt.json) is a content-addressed ledger of all eight retained
cases. The physical corpus verifier, independent controls and multicamera
window verifier remain separate owners and must still pass.
