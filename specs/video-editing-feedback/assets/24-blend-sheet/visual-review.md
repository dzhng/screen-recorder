# Visual comparison and adjudication

The matched sheet keeps normal-before, independent W3C reference, delivered PNG
and decoded movie side by side. [Before/after telemetry](before-after.json)
records changed pixels against ordinary alpha-over; both decoded samples are
identical. [Public parity](public/parity.json) proves public delivery matches the
native images already reviewed. The retained landmarks cover all patch boundaries,
neutral colors, alpha bands, reversed source/backdrop, nested groups, and the
vignette center/corners/full falloff. The sheet was shown in Preview; no human
response is an acceptance gate.

Two fresh image-only reviews disagree about movie edges. The
[Codex critique](visual-critique-codex.md) found one-pixel codec mixing at hard
patch boundaries and small interior drift; it failed the full-reference movie
comparison. The [fresh agent critique](visual-critique-fresh-agent.md) found no
visible differences at 4×. Retain both. Numerical still error is at most one
RGBA level, within the original two-level gate. Movie patch-interior error and
unmasked vignette error are at most four levels, within the original eight-level
gate. The normal control shows the same codec boundary limitation.

Verdict: independent still arithmetic and the declared movie arithmetic scope
pass; exact spatial support and full vignette falloff pass. Full-raster movie
hard-edge fidelity remains unresolved. A clean subjective review cannot override
the conflicting defect report or extend the existing numerical mask. No gate or
threshold was weakened, and the slice remains partial for this visible-output
limitation rather than calling the full movie reference comparison clean.
