# Capture time contract audit — decision only

**Recommendation:** revise the requirement before more representation research.
The product needs trustworthy admitted sample placement and gaps, not lossless
embedding of every raw host nanosecond in MOV. A single declared capture-admission
quantization is a legitimate candidate. It is not yet proven equivalent, and must
not be silently substituted for the current contract. No code or plan was changed.

## What is required, and what we added

**Sound, explicit product invariants (high confidence).** Recording contracts name
safe integer microsecond public times, half-open support, retained native CMTime
provenance and rounding at an agreed boundary. CaptureClock owns first usable
video origin and pause removal. Editing contracts preserve source offsets, gaps,
absolute output sample phase, sample identities, and full-versus-window behavior.
Canonical media plus the ordinary acquisition binding must expose the same admitted
source to every consumer. Lost buffers must not pull later speech earlier. Accepted
samples, committed bytes and recoverable evidence remain distinct.

**Overconstrained implementation choice (high confidence).** The 20b/c proposal made
exact raw-host rational preservation through canonical MOV an end in itself. That
was not implied by integer-microsecond admission, original CMTime provenance, or
native sample execution. Provenance can remain exact without making the playable
container an exact raw clock archive. Combining an arbitrary nanosecond phase with
1/48000 requires a denominator of 3000000000 in some scalar positions, beyond
CMTimeScale. Requiring every such scalar to remain exact in that representation is
impossible; it does not establish that trustworthy recording is impossible.

**Unsound inference (high confidence).** Strict equality between successive raw PTS
and prior PTS+frameCount/rate is not a necessary condition for continuous admitted
PCM. Controlled timestamp rounding alone split every buffer in the feasibility
probe. Conversely, values fitting a proposed quantizer do not prove the source
used it. Source provenance is genuinely missing if we claim to reconstruct the
unrounded physical clock. It is not a prerequisite for defining our own explicit
admitted-time policy; that policy must be judged by its observable results.

## A bounded candidate, not an adopted relaxation

Keep one CaptureClock admission decision. It may establish a declared per-role
PCM phase in its common source clock, anchored once from the first admitted buffer
with a documented microsecond rounding rule. Retain raw PTS/epoch and controls as
provenance. Locate subsequent buffers with exact arithmetic and one deterministic
native-sample position quantizer relative to that declared phase; frameCount then
advances sample positions exactly. Coalesce when those **admitted addresses** are
adjacent and format/control epoch agrees. This is a stated resolution rule, not a
fitted offset or an epsilon test, provided the anchor never follows later residuals
and no reader recomputes its own map.

This candidate does change how sub-sample timestamp differences are interpreted.
Nearest-frame classification is only a candidate; its tie, overlap and support
rules need approval from measured contracts. It must not silently force a backward
buffer forward, drop/duplicate its samples, or stretch time to make a run continuous.
A real pause or known dropped buffer is never erased merely because a position
rounds next to another. Reanchoring on each discrepancy would become hidden drift
fitting and is excluded.

A microsecond phase plus exact frame/rate duration has a representable common scale
for ordinary 44.1/48k, unlike arbitrary nanosecond phases. This is a useful bounded
implementation direction, not proof for all currently accepted capture formats.
The supported recorder must still pass; a refusal policy cannot discard ordinary
inputs to make the arithmetic green.

## Required observable property

Define the admission result independently of the container: immutable ordered
sample identities, one declared source address P(k) for each sample, and acquired
support S after origin/pause/omission rules. For a run, P(k)=a+k/r, with declared
phase a and native rate r. Persist enough evidence to reproduce this result without
reinterpreting raw timestamps in readers.

Canonicalization must preserve every admitted sample value/count/order and P(k)
under the declared source/read rounding rules, plus S. For every supported request
window and output context, canonical playback must select the same sample identities
and report the same acquired/unavailable support as that admission result. Full,
late, split/rejoined and recovered-prefix reads must agree. Output resampling and
project retiming consume this same timeline; they cannot restart its phase. This
property is relative to the **declared admitted source**, not a claim of equality
to every physically possible unrounded host instant.

Prove that property before adopting a quantization. In particular, preserving only
native sample indices is insufficient if integer-microsecond availability or a
supported resampling/retime query changes. If sub-sample residues are classified as
measurement resolution rather than acquisition gaps, state that product decision;
do not simply delete existing explicit support exclusions.

## Required discriminating checks — no new variants run in this audit

- Keep the banked omitted-buffer case: the later sample at 1.2s is original 52800,
  not 52801. Independent per-buffer microsecond rounding already fails it.
- Put anchors on both sides of native sample boundaries and exact half ties; include
  nonzero rational video origins and pause endpoints. Compare rounding the relative
  source time once with the current separately rounded host/origin semantics.
- Change callback grouping for the same PCM: admitted addresses, sample values,
  duration and support must remain unchanged. Quantized contiguous buffers must not
  produce one run per callback or accumulated phase drift.
- Preserve explicit microsecond acquisition gaps, missing whole buffers, pause-crossing
  omission, rejected append and actual committed-tail loss. Test a backward/overlapping
  timestamp and sustained residual drift: no silent fitting, masking or sample loss.
- Compare all supported capture formats and public native/resampled output paths,
  acquired-window intersections, fractional editorial boundaries, range/full and
  restart recovery. A native 48k-only sample check cannot prove general equivalence.

## Grounding and decision boundary

Read recording contracts' Timeline section; editing contracts' time, audio-output
and acquisition rules; current CaptureClock/CaptureWriter; and the separate reader
fix in acquisition-picture-journey. The reader now preserves exact physical support
through sample selection. That fix prevents an accidental intermediate projection;
it does not mandate raw-host nanoseconds as the capture admission contract.

Apple's CMTime/CMSampleTimingInfo SDK contracts establish finite scalar precision
and per-buffer anchor+sample duration, not cross-buffer hardware quantizer provenance.
The previous probe's synthetic nearest-nanosecond controls remain synthetic.

Revise 20b/c around the admission property, then test one declared candidate at the
existing owner. Keep raw provenance exact, keep canonical publication/committed-prefix
safety unchanged, and leave actual physical sync measurement separate. Do not call
quantization equivalent or enable it until these observable gates pass. This is a
bounded engineering decision to validate, not an obligation to infer an unknowable
source quantizer before work can continue.
