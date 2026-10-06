# Real editing regression inputs

These excerpts retain the original decoder’s Float32 samples without lossy audio compression. Source hashes and exact selections live in [recipes.json](recipes.json); the measured [manifest](manifest.json) binds retained bytes, original clocks and preservation checks.

The [corpus tool](../../packages/test-harness/editing/video-corpus.mjs) owns case selection, derivation and verification; use its help. Original locations are arguments, never build paths. Derivation reads external sources without modifying them and checks that re-decoding each retained input preserves every selected source-decoder sample. This numerical proof does not establish recognizer accuracy or whether an old defect reproduces. Baseline dispositions remain separate and unverified until measured under the pinned model/runtime.

Fetch only selected LFS inputs. A pointer alone is refused. Full-frame picture, multicamera and speaker controls remain to be added under the approved [fixture contract](../../specs/video-editing-feedback/fixtures.md).
