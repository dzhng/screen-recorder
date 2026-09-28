# Examined choices

- Keep physical support in the existing presentation owner. A second nearest-frame
  or continuity heuristic would lose sub-microsecond gaps and held samples.
- Use the acquisition mapping owner for the explicit clock offset. Native only
  adds/subtracts it; selected-track identity is never inferred from the first track.
- Keep immutable source spans separate from revision identity. Pure edit seams
  must not erase source history; legacy schedules still own their revision ID.
- Preserve exact rational empty ends across skipped records. Returning only the
  current picture loses the reset floor when output sampling jumps over a gap.
- Preserve zero-offset timestamp representation as well as value. This keeps
  existing evidence byte-identical without a parallel selection path.
- Bound decoding separately from record output: discarded source prefixes consume
  decode work even when few evidence rows are emitted. Admission limits do not
  establish measured peak memory or large-project performance acceptance.
- Leave pointer execution unavailable until the preparation/job owner and native
  replay exist. An empty prepared overlay would hide missing evidence.

- Refuse lossy CoreMedia clock subtraction. An independent review reproduced
  silent rounding for a 3003-timescale sample shifted one microsecond. The
  physical-support contract requires exactness, so widening the wire clock or
  accepting approximation is outside this prerequisite. A real-media regression
  rejects that request and proves cleanup.
