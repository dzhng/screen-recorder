# 14d — Follow playback pitch over a retained run

Status: not started. Dependencies:14b request-local retained-run preparation.

## Contract and seam

Explicit pitch follow changes pitch with playback speed, through the existing
bounded rate-conversion owner. Preserve phase over the same full retained run and
pay exactly the compiler-declared output sample count. Do not approximate an
arbitrary rational playback rate by rounding an effective sample rate to an
integer. This policy does not change pitch-preserve's accepted recipe.

Inspect ConvertedAudioInterval's actual AVAudioConverter behavior before extending
its ratio interface. Keep finite selected-input support and exact output debt;
unsupported execution must fail explicitly. Reuse14b prepared readers so ordinary
and state-prerequisite graphs consume the same mapped PCM.

## Verification and review surface

Tone frequency follows authored speed; identity preserves source samples. Verify
mono/stereo channel placement, full/subrange and pure-split equality, poisoned
excluded samples, quantized fractional endpoints, long-run counts/memory and
cancellation. A native harness and retained numerical/PCM report own the proof.
New perceptual claims require listening; no new visual claim follows.

Delegated: converter ratio representation and internal bounded mechanics, selected
from measured behavior. Timing, explicit policy, source support and owners remain
fixed. Public capability binding belongs to14e.

Keep the existing preservation gates, exact source-selection contract and frozen
workers intact. Build only in isolated scratch paths. Update this Status and the
parent14 pickup with evidence before committing. Run the repository review and
audit-choices passes. Missing perceptual evidence stays explicit; accepted mono
listening must not be repeated as a substitute for a different policy.
