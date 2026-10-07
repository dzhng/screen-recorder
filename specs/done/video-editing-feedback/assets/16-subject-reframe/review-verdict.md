# Slices 15/16 closeout review

The independent code review found two contract omissions. A retained source
frame schema did not carry the face-observation request, so a face-bearing source
index could not round-trip. The still-image renderer type also omitted the request
that its implementation already forwarded. Both are fixed at the owning schema
and renderer contracts; a focused regression parses a retained frame with the
request, and the scoped source-frame tests pass (19 tests). Repository type checks
pass across all packages.

The unprimed visual review inspected the complete framing sheets, references,
motion samples, controls and face crops. It found no visible stretching, lost
source corners or orientation error. The review could not certify unsampled
in-between motion, and enlarged detail crops are soft. Those limits remain
explicit. They do not change the full-raster numeric evidence or the detector
quality verdict.

Slice 16's geometric delivery is green: accepted proposals pass the unchanged
full-raster maximum-8/mean-2 comparison, refused source-bound caps return null
geometry and preserve the prior picture, and public split/repeat/retime samples
are byte-identical. Slice 15 remains partial: 27 Graham frames fail the frozen
full-face overlap gate during hand occlusion or turned-head poses. Native
observation delivery, provenance, association gaps and reset behavior remain
verified independently of that red localization gate.
