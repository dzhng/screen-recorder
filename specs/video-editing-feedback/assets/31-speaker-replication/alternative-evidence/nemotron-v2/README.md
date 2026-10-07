# Nemotron v2 short-quality refusal

This bundle records a distinct NVIDIA checkpoint admission after the v2.1
production checkpoint and the Nemotron-3 attempt. The v2 archive restored in the
sealed NeMo 2.7.3 / Torch 2.8.0 / NumPy 2.3.5 runtime, so this is a quality
result rather than a pre-inference runtime refusal.

The official very-high-latency model-card recipe is frozen at
`chunk_len=340`, `chunk_right_context=40`, `fifo_len=40`,
`spkcache_update_period=300` and `spkcache_len=188`. The two calibration controls
pass, but the held-out `aiqwk30` control fails every quality dimension that
matters: DER is 34.38%, identity confusion is 13.99%, and overlap recall is
10.76% against the unchanged 20% / 5% / 80% gates. The observed speaker count
still matches, so this is not a count-only refusal. The long-form controls were
not run after the preregistered short gate failed.

All three observations were regenerated through the same retained worker; it accepts complete mono16k windows on the 80ms score grid and checks the physical byte extent before inference.

The checkpoint and runtime stay outside Git. Compressed JSON and complete native
Float32 operands are retained here with their hashes in `protocol.json` and can
be replayed without acquisition, model loading or inference:

```sh
node packages/test-harness/editing/nemotron-v2-replay.mjs \
  specs/video-editing-feedback/assets/31-speaker-replication/alternative-evidence/nemotron-v2/protocol.json
```

The replay recomputes the existing diarization score and overlap oracle, checks
the native tensor bytes and exact model recipe, and rejects any attempt to turn
the refusal into a promotion. Production speaker defaults and the public
contract remain unchanged.
