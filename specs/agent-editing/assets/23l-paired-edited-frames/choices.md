# 23l planning choices

These decisions constrain the
[paired-frame gate](../../slices/23l-paired-edited-frames.md). Planning choices
remain givens; implementation choices are recorded below. Parent-requested zero-editorial,
copied-authority, public-entry-point and conditional-tail boundaries are givens.

## Sound — medium confidence

### Use one explicit 60 fps project for joins and the candidate final sample

When: 23l planning, 2026-10-01.

The choice: the saved edit removes two one-second ranges. At the old state's
30 fps project clock, its last displayed cell points to source 134000000µs,
before the final physical sample begins. The planned caller explicitly sets
60 fps so a final cell can reach inside that sample's possible support. The
same project also supplies the two join neighborhoods. This changes sampling,
not source bytes or retained intervals. The unbuilt alternative would keep
30 fps and add a second project solely for the tail, doubling fixture owners.
The gap: the parent requested the smallest bounded case but did not fix the
project's output frame rate. The reach: this gate preserves source membership
under a declared clock; it does not claim the 23j 30 fps recipe acquired an
unobserved final picture. Verdict: sound because the choice is explicit and
qualification can still refuse the tail. Confidence: medium.

### Separate exact membership success from unresolved color differences

When: 23l planning, 2026-10-01.

The choice: if both public APIs select their documented source samples but a
new composition picture has unexplained pixel differences, the report retains
membership success and leaves presentation correspondence unresolved. The
three earlier images' one-code difference cannot become a general tolerance
for new images. An alternative would let that historical maximum automatically
approve this packet. The gap: matched source PTS and declared profiles constrain
the comparison, but no new general photographic threshold was authorized.
The reach: future implementation must record every pixel and actual profiles;
it cannot make a stronger release claim from timing alone. Verdict: sound
because it advances independently proved facts without fitting a quality rule
to measured output. Confidence: medium.

## Sound — high confidence

### Make the final sample an independently qualified branch

When: 23l planning, 2026-10-01.

The choice: inspect the actual native sample duration and occupied track mapping
before requesting the proposed last picture. A segment ending after a sample's
PTS does not establish that the picture lasted until that end. If the native
duration does not contain the candidate instant, preserve the qualification
result and finish the joins without a tail claim. The alternative would extend
the picture or add an authored freeze to create the hoped-for result.
The gap: saved metadata has aggregate durations and final PTS, but the exact
final support has not been independently qualified. The reach: a small test
probe may read timing separately from the picture renderer in a future scope;
the frozen worker and product selection rules remain unchanged. Verdict: sound
because absence of evidence never becomes fabricated support. Confidence: high.

### Use one bounded MCP delivery comparison per producer

When: 23l planning, 2026-10-01.

The choice: get all planned pictures through the real CLI, then request one
first-join picture through each real MCP adapter and compare its complete
receipt and delivered bytes. The adapter can transform a file result into an
inline image or a leased artifact; a service-only check would miss that seam.
The alternative would repeat every picture and the already-owned capacity and
lifetime matrices through both transports. The gap: the parent required actual
delivery where adapters add behavior but did not prescribe a full repeated
cohort. The reach: the new packet proves this delivery correspondence and actual
child termination only; broader delivery capacity retains its existing owner.
Verdict: sound because one pinned derivative exercises each real result
conversion without repeating unrelated accepted work. Confidence: high.

### Resolve integer reference requests from independently proven sample support

When: 23l planning review, 2026-10-01.

The choice: legacy pictures report whole-microsecond sample timestamps, while
current pictures also report the exact native clock. Map a legacy rounded
timestamp to one unique sample in the independently read timing table. If that
rounded timestamp lies just before the sample starts, ask the current direct
source API at an integer instant inside its proven support instead. Keep the
edited requests unchanged and record the reference adjustment. The alternative
would either demand an exact field the legacy receipt does not expose or compare
the preceding current picture by accident. The gap: matching a reported PTS does
not automatically make integer and exact support clocks interchangeable.
The reach: references identify the same physical sample without changing public
APIs or introducing a tolerance; absence of a unique representable reference
remains explicit. Verdict: sound because qualification supplies the actual
identity rather than a fabricated receipt field. Confidence: high.

### Give both edited selectors their own complete raw-picture reference

When: 23l independent planning review, 2026-10-01.

The choice: collect the union of physical samples chosen by both edited
producers, and obtain matched original `r0` and current direct-source references
for each unique exact sample. A recording's nearest picture can differ from a
project's containing picture at a join. Check every recording edited image
against its own clean `r0` image, and every project picture against its own
containing-sample reference with the declared color path. The gap: the initial
plan collected references only for samples selected by the project, leaving a
different recording-selected picture with a metadata check but no pixel oracle.
The reach: each delivered image now has an independent reference; correct timing
cannot hide unrelated or corrupted image bytes. Verdict: sound because it closes
the complete-output contract without forcing the selectors to agree or adding
another media case. Confidence: high.

### Add complete saved receipt checks without repeating successful media work

When: 23l implementation, 2026-10-01.

The choice: the executed case proves sample selection, pixel comparisons and
adapter delivery. Review adds exact frame index/cell, complete video-layer binding
and clean-image field checks through a saved-only harness entry point. The same
untouched actual report passes those checks; an uncut first-join oracle fails in
its own process. The unbuilt alternative would render every accepted picture
again solely to evaluate additional assertions. The gap: the first executing
harness did not assert every receipt field required by the plan. The reach: the
original executing source and the final saved checker are separately pinned;
neither is falsely presented as the other producer. Verdict: sound because it
closes the exact missing value checks through genuine captured outputs while
preserving the user's prohibition on repeated accepted cohorts. Confidence: high.

### Deduplicate full decoded pixel payloads only by their byte identity

When: 23l evidence banking, 2026-10-01.

The choice: every full decoded image remains recoverable, but identical RGBA
outputs occupy one hash-named payload with a mapping for every execution. The
original individual PNGs, profile receipts and diagnostic results stay separate.
The alternative would store dozens of duplicate full image buffers, increasing
archive cost without adding evidence. The gap: the plan required complete pixels
but did not prescribe their storage representation. The reach: reconstruction
uses actual byte hashes, never visually similar images or rounded timestamps.
Verdict: sound because the complete output remains independently verifiable
while banking avoids redundant bytes. Confidence: high.

## Unsound choice corrected — high confidence

### Preserve the configured receiver run and correct it through cached default reads

When: 23l implementation review, 2026-10-01.

The choice: the first media harness set the SDK receiver to 64MiB even though
the intended caller uses its 10MiB default. Successful delivery then proved
only the configured receiver. The corrected decision is to omit that option
and actually consume the same saved derivatives through the default client.
The parent explicitly required a two-read cache-only correction: no frame
render is permitted, and a missing cache is evidence of refusal rather than
permission to replace it. The gap: the original harness added a capacity choice
that the plan never requested. The reach: raw configured evidence remains
immutable; the separate default-read report owns the corrected delivery claim.
Verdict: the original choice was unsound because capacity must match the declared
consumer, not merely exceed the observed image size; the bounded correction
passed for both producers. Confidence: high.

## Storage correction — parent-directed

The parent required a compact supplementary packet and
unchanged durable full archives. Every unique raw array was proved exactly
recoverable from a retained normalized PNG by direct RGBA decoding, so the
compact packet uses that reference while the full archive keeps the original
bytes. Existing fixtures and frozen workers retain their own exact authorities.
This changes storage ownership, not the pixel reader, proof or acceptance rule.
