# Reviewed choices

- Selected 8 kHz mono and 192 kHz stereo PCM rather than codec permutations. These
  exercise integral upsampling, downsampling and the upper admitted rate with
  independent channels. The prior 44.1 kHz case already exercises rational ratios.
- Extended the existing mixer-conformance owner with a named lossless cohort. The
  default compressed path and all its prior checks remain; no second decoder,
  resampler or mixer oracle was created.
- Compared mixer arithmetic to the actual isolated native converted component,
  while separately comparing raw-source PCM to authored values and channel identity
  to authored frequencies. No assumption of another resampler's sample equality,
  quality threshold or audible transparency was introduced.
- Reused the frozen combined worker. A current worktree build refreshed compiled
  modules, so the final lossless run uses that build; earlier captures remain
  identifiable rather than being overwritten as though they used the same modules.
- Kept the earlier AAC unresolved diagnostic and listening/negative-origin/admission
  scope separate. Passing this new lossless pair does not resolve those requirements.
