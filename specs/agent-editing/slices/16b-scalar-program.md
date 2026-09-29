# 16b — Canonical numerical scalar program

Status: implemented and verified as a numerical prerequisite. [Public unit-rate gain](../assets/16-gain/README.md) is now verified; delivered retime+gain remains in16. Dependencies: [16a](./16a-curve-primitives.md).

## Contract

Lower the existing scalar curve into one compact numerical program. The in-process
TypeScript evaluator and native executor consume that same program. Author anchors,
normalized evaluation ranges, easing labels and control handles never reach native.
Program size follows keys and activation fragments, never project duration or PCM
sample count. This prerequisite does not advertise public animated gain.

## Seam and ownership

Composition resolves key positions to signed exact project time, including keys
before project zero when a trimmed fragment moves. BigInt arithmetic owns clock
lowering; native receives a global integer sample origin, a Float64 phase offset
and slope for each numerical piece. The origin is the nearest sample to that
piece's exact time origin, bounded only by the existing global sample domain,
never the requested window or clip activation. Compute offset by exact subtraction
before converting once to Float64; execute `offset + (frame-origin)*slope` in that
order. This keeps a tiny remainder at the closest sample and avoids subtracting
two large rounded project times elsewhere. Key/piece selection uses exact ceil
sample boundaries. Constant endpoint tails cover the global sample domain.

The existing native audio schedule already requires safe-integer-fraction parent
placement endpoints. Their positive separation is at least `1/MAX_SAFE_INTEGER²`;
normalized key separation has the same lower bound, and evaluationRange span is
at most one. Thus native-admitted normalized key spans are at least
`1/MAX_SAFE_INTEGER⁴`; content keys have integer separation and bounded source
span. Translations and trimming can change signed origins but do not invalidate
these finite phase bounds. Current playback ranges are ascending; reverse playback
is not an admitted model operation. Do not add an Int128 capacity refusal: an
admitted evaluationRange with nearly equal large denominators already exceeds
that intermediate capacity. The numerical owner lowers constant, linear-mix and
parametric-polynomial intervals; the anchor compiler retains availability and
restriction and delegates numerical evaluation to it.

Exact key comparison selects the outgoing interval; an exact key returns its
stored value, and samples before/after all keys clamp to the endpoint value.
For a linear mix, compute `(1-weight)*from + weight*to`. For parametric cubics,
invert the monotone time polynomial until the bracket endpoints are adjacent in
Float64 (or the target is reached exactly), then
execute the weight polynomial and the same mix. A cubic weight is not generally a
polynomial of elapsed time. Fix operation order explicitly in both executors; no
fused multiply-add or platform easing API substitutes for the numerical contract.
The loop has a binary64 exponent-derived ceiling of 1076 steps; ordinary inputs
stop much sooner. Dispatch exact key values directly, including interior keys.

Use shifted polynomial pieces around parameter zero, one-half and one to prevent
cancellation near flat endpoint/interior derivatives. Compute phase and its
difference from a piece's time origin as exact rationals before converting the
ratio to Float64. Rational-to-Float64 conversion rounds once, including large
intermediate integers and subnormal values. Keep coefficients and results finite; normalize polynomial
weights when needed to represent large finite coefficients. The numerical program
contains coefficients and bounds, not the original editorial handles.

Activation is separate from value phase. Existing visual sampling retains exact
half-open activation. The audio consumer floors activation spans through the
existing global PCM clock, uses dry gain one outside them, and evaluates the
original program at the absolute PCM sample instant. Restricting a window or
splitting at a fractional boundary must not reset phase or clamp to the new cut.
Final gain conversion uses existing Float32 multiplication order in slice16.

## Work and review surface

Retain numerical vectors and run the composition tests plus the isolated native
scalar executor over the same programs and timestamps. Include independent
analytic cubic controls, fractional and negative key origins, adjacent large legal
times, endpoint/hold selection, steep curves and stationary derivatives. Freeze
the current evaluator first; explain any changed numerical result against an
independent oracle, without weakening an existing default gate.

## Acceptance

Existing 16a tests remain green. Unit-scale analytic controls retain the established
1e-10 absolute tolerance; exact keys and pure restrictions remain exact. Native
and TypeScript must agree in Float32 values used by gain, with Float64 differences
reported separately. Include malformed/nonfinite program controls, legal rational
phases beyond Int128 intermediate capacity, bounded program size, and tests that fail under deliberately wrong phase
or polynomial execution. Preserve reviewed visual PNGs after TypeScript adopts
the new evaluator; any changed capture requires independent diagnosis and fresh
visual review rather than repinning it silently.

## Failure boundary and discretion

Do not retain the old evaluator as a fallback beside the new program. A numerical
failure leaves this prerequisite open and must be fixed at its single owner before
animated gain adoption. Native is a numeric executor, not a second anchor/keyframe
interpreter. Internal types and module boundaries are delegated within these rules.
Gain delivery, transitions and convenience commands remain in [16](16-keyframes.md).

If a visual capture changes, use compare-screenshots against independent geometry
controls and run an unprimed screenshot-critique as the last visual check. Optional
human review stays nonblocking and does not replace numerical or listening evidence.

## Verification evidence

The compiler and native numerical executor pass independent analytic controls and
cross-runtime conformance in debug and optimized Swift builds. Existing reviewed
geometry PNGs remain byte-identical. The counterexamples, mutation evidence and
receipts live in [the numerical evidence](../assets/16b-scalar-program/README.md).
The subsequent [public gain evidence](../assets/16-gain/README.md) verifies unit-rate
delivery; [16](16-keyframes.md) retains delivered retime+gain and full journeys.
