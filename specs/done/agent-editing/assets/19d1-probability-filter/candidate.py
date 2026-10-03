"""Experimental replacement for the pinned Qwen probability-filter helper only."""
import mlx.core as mx
import mlx.nn as nn
from mlx_audio.lm.sample_utils import apply_min_p, apply_top_p


def probability_filters(logits, top_p, min_p):
    if not (0.0 < top_p < 1.0 or min_p > 0.0):
        return logits

    logprobs = nn.log_softmax(logits, axis=-1)
    if 0.0 < top_p < 1.0:
        logprobs = apply_top_p(logprobs, top_p)
    if min_p > 0.0:
        logprobs = apply_min_p(logprobs, min_p)

    filtered = mx.where(logprobs == -mx.inf, -float("inf"), logits)
    valid = mx.all(mx.isfinite(logits) | (logits == -mx.inf), axis=-1, keepdims=True) & mx.any(
        mx.isfinite(logits), axis=-1, keepdims=True
    )
    empty = ~mx.any(mx.isfinite(filtered), axis=-1, keepdims=True)
    winner = mx.arange(logits.shape[-1]) == mx.argmax(logits, axis=-1, keepdims=True)
    return mx.where(empty & valid & winner, logits, filtered)
