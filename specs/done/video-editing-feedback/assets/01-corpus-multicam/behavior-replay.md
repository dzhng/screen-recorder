# Multicam source-choice behavior receipt

`packages/test-harness/editing/multicam-behavior.mjs` replays the caller-authored
nine-selection recipe against the retained physical windows and decoded picture
samples. Every source contributes its three retained windows exactly once, and
the selected audio window and picture sample share the same source and source
clock. The receipt binds each selection to the original recording hash, exact
PCM hash, and decoded RGB sample hash.

This is source-selection and evidence-preservation behavior. The verifier reports
`cameraChoice: caller-authored` and `synchronization: not-established`; it does
not infer a shared clock, audible speaker, or automatic editorial camera choice.

Replay:

```sh
node packages/test-harness/editing/multicam-behavior.mjs verify \
  --fixtures fixtures/video-editing-feedback/synchronization \
  --recipe specs/done/video-editing-feedback/assets/01-corpus-multicam/behavior-recipe.json \
  --identity specs/done/video-editing-feedback/assets/01-corpus-multicam/behavior-recipe.identity.json
```

The immutable [receipt](behavior-receipt.json) and recipe identity keep this
checkpoint independent from the historical synchronization manifest identity.
