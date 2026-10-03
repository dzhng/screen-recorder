# Shared cache capacity evidence

The disposable cache owns one publication budget. It now accommodates the native
RIFF writer's full supported output rather than imposing an unrelated one-GiB
ceiling. `checkCapacity` is an intrinsic-size preflight, never a reservation:
publication still serializes admission, evicts eligible LRU entries and refuses
held-reader pressure. Temporary renders remain outside published-byte accounting.

Selected-source audio computes a minimum float-WAV size from absolute integer
sample boundaries and known probe dimensions. The 44-byte minimum is deliberately
not a promise about a producer's full header; actual bytes are checked at publication.
Missing or unsupported native format metadata remains the native producer's admission
responsibility. There is no fallback sample rate or private cache limit.

Evidence: [old-limit failure](red.txt), [focused suites](tests.txt),
[preflight removal mutation](mutation.txt), [floating-point clock mutation](mutation-clock.txt),
and [independent review](review.txt). The real sparse file exceeds one GiB and its
last four bytes are read through the retained cache descriptor without full buffering.
Existing suites cover held pressure, concurrent publication, eviction and recovery.
Core typecheck and focused lint/format checks also passed. Review found no actionable
issues; the high-clock test was strengthened afterwards and mutation-proven.

This does **not** prove native rendering above one GiB. That full native journey and
project-tap preflight remain open in [11a](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/11a-audio-delivery.md).

## Decision audit

- Sound, high confidence: one shared four-GiB default and intrinsic-size API, as
  authorized by the parent after inspecting cache/export contracts. Export currently
  depends on cached derivatives and is not an alternate large-file route.
- Sound, high confidence: exact BigInt arithmetic before Number conversion prevents
  high-clock rounding and rejects unsafe accounting explicitly.
- Sound, medium confidence: use the minimal RIFF header in preflight rather than copy
  the native sink's implementation-specific header reservation. This avoids false
  rejection but leaves actual publication size authoritative for custom tiny budgets.
- Sound, high confidence: keep capacity pressure and leases unchanged. Larger defaults
  permit more retained disk, not larger buffers; callers can still configure smaller budgets.

Shape review kept size policy in DerivedCache and media-size knowledge in the audio
owner. Diff review found no new parallel store or reader. Documentation links the
remaining acceptance gate rather than declaring full 11a complete.
