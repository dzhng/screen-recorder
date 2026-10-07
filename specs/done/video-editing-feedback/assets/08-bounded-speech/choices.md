# Slice08 choices for integration

These are decisions made in gaps in the original slice, approved by the integrator
while implementing. Recipe sizing was explicitly delegated and is recorded with
its measured evidence rather than treated as an invented decision.

## Sound — medium confidence

### Shared context establishes occurrence correspondence through mandatory word order

When two decodes report the same word on opposite 80ms frames, their estimated
intervals can touch without overlapping. Rejecting this pair solely on overlap
loses a valid preparation; accepting the nearest timestamp would invent a tolerance.
The work instead compares word sequences inside their exact shared decoded support.
A guarded word must pair with the same peer in every longest ordered matching
sequence. Missing or repeated ambiguous matches refuse; true points require equal
point estimates. Selected text, confidence and times remain the original observation.

The original slice required boundary agreement without specifying correspondence.
This decision constrains subsequent alignment reuse: the generic sequence certainty
can be shared, while source support, points and ownership remain speech policy.
It is sound because uncertainty stays explicit and no timestamp becomes a repair;
confidence is medium because this evidence establishes correspondence, not audible truth.

### Conflicting start ownership keeps one original observation deterministically

A seam at 20s can have a left word starting 19.95s and a right peer starting 20.03s,
so both decodes provisionally own it. The opposite shift can leave neither owning
it. Once ordered correspondence is uniquely established, the work retains the
original single owner if there is one; when both or neither own, it retains the
left observation once. It does not average, clamp or change estimates.

The plan required no duplicates or lost seam occurrences without selecting an
estimate on conflicting starts. This deterministic rule lets retained preparations
remain reproducible and keeps raw alternatives inspectable. It is sound for an
evidence primitive; confidence is medium because neither estimate is proved more
accurate and the policy deliberately makes no such claim.

## Sound — high confidence

### Phrase continuity follows connected primary observations

A phrase whose first word crosses 20s and whose second begins 20.2s should remain
searchable when inference merely used two windows. Words therefore share a phrase
run when transcribed primary ownership touches exactly. A skipped interval or real
unowned/missing support starts a new run. Each native window ordinal is also stored
privately, so portable receipts still count each window's words independently.

The old source search treated every inference segment as a phrase barrier; the
slice did not choose how bounded windows should affect it. This change prevents
window size from changing ordinary source phrase semantics. It is sound because
only continuous observed ownership joins, and original estimates remain unchanged.

### Native readable support is retained separately from ownership

For a request owning 18–22s with context 16–24s in a 25s source, the source outside
primary ownership was not transcribed, but it still physically exists. The receipt
retains actual readable 0–25s support separately from 18–22s primary ownership and
16–24s decoded support. Reads distinguish `not_observed` from `not_acquired` using
those retained facts; packages preserve them after the original runtime disappears.

The original slice distinguished gaps but did not name the native support echo
needed to preserve physically narrowed source facts. This adds one required retained
input, with strict execution/ownership receipts and a hard format cutover. It is
sound because masking bounded decode work cannot relabel existing media as missing.
