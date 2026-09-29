# Probability-filter repair experiment

Status: **numeric candidate verified, not integrated**. The pinned Qwen helper can
mask every token even when its input contains valid finite logits. The existing
ascending low-precision cumulative probability calculation then fails its strict
`> 1 - top_p` comparison. Small positive binary64 values can also make that scalar
threshold round to one. The original failures remain in
[inherited-reds.tar.xz](inherited-reds.tar.xz); no minimum was fitted to avoid them.

[The candidate](candidate.py) keeps the original default bypass and filtering
calculation. For an empty result only, it restores the first maximum-logit token
if the input row contains finite support and no NaN or positive infinity. Existing
negative-infinity masks stay masked. The first-index tie choice is deterministic
and applies only where the old result was empty; already-valid ties retain the
old kernel behavior. This is a nonempty-support repair, not a claim of ideal
nucleus probability mass after low-precision normalization.

Invalid input is **not runtime-refused** by this candidate. NaN, positive infinity
and all-masked rows receive no fabricated rescue and retain the existing backend
result. Arbitrary invalid model logits remain outside the guarantee. The worker's
existing generated-output validation is unchanged. A discarded prototype used a
Python `.item()` validation on every filtered call; it is retained in the archive
but is not the proposal. The candidate performs tensor operations without a new
host synchronization and keeps `top_p=1`'s exact early return.

[Verification](verify.py) substitutes the candidate at the existing pinned
`Model._sample_token` call in one isolated process, then restores the original.
It never loads model weights or edits the installed helper. Both upstream source
files are hash-checked. [The report](report.json) retains every request, original
and candidate result, exact logits/RNG identities and timings.

All279 inherited cases reproduce their original validity and selected token.
The62 empty-distribution failures become finite positive normalized distributions;
all217 previously valid cases keep exact logits, tokens, dtype, shape and RNG
state. Nine invalid-input controls remain invalid and unchanged. Forty-five
additional direct controls cover masks, ties, extreme finite values, the smallest
positive binary64 top-p and its near-one boundary across float32, float16 and
bfloat16. Both3072 and2048 vocabularies are exercised through the actual sampler.
Batched helper shapes are covered; this does not enable batched voice generation.
Float32 diagnostic probability sums use the inherited1e-5 normalization tolerance;
logit and token preservation has zero tolerance. Default identity bypass and an
explicit empty tied row are asserted independently.

Three interleaved repetitions of100 existing sampler calls per arm give these
median milliseconds per call (ten warmup calls per repetition):

| top_p | Original | Candidate |
| --- | ---: | ---: |
| 1 | 0.2432 | 0.2370 |
| 0.8 | 0.3025 | 0.3349 |

These are tiny sampler timings, not model generation latency, cold-cache behavior
or a speedup claim. Filtered calls add tensor work; default timing variation is
noise around the unchanged bypass. No playback, network access, model copy or
inference occurred. OS network denial and existing offline flags were set.

Reproduce with the frozen19b runtime, or the same fully verified runtime bytes:

```sh
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 /usr/bin/sandbox-exec -p '(version 1)(allow default)(deny network*)' /absolute/runtime/python/bin/python3.12 -I -B specs/agent-editing/assets/19d1-probability-filter/verify.py --model-config /absolute/model/config.json --out /absolute/new-output
```

Next: review the single-helper source patch, register a new immutable runtime/entry
identity, then prove exact default word/phrase WAV and PCM plus preserved valid
filtered audio/replay through the managed worker. The existing19d artifact and
all frozen originals remain untouched. Parent settings acceptance remains open.

Archive SHA256: `04ea0d051bd561dcd7353ea0e8d42386e52fcbc4f413c886cf354bc3aa2c45e8`.

[Root verification](root-verification.json) independently reran the same numerical
controls through the frozen runtime with network access denied. All classifications
and preservation checks reproduced; this still does not claim synthesis parity.
