# Read-only audit choices

- **Reconstruct only the retained PNG sample bytes — sound, high confidence.**
  Both paths already publish PNGs and have saved color-managed RGBA. A profile-aware
  image reader could itself introduce the rounding under investigation. The audit
  therefore uses existing Node zlib and the five standard PNG scanline predictors
  to recover the pinned, non-interlaced 8-bit RGB/RGBA sample values without color
  conversion. It checks complete values against the independently saved 21e output.
  Pillow was unavailable in the existing Python; adding an image dependency or
  compiling a new reader would expand the authorized task. This method fills the
  inspection-mechanism gap only. The fixed-fixture script is not a production codec,
  new rendering owner or generalized image parser.

- **Keep stage localization separate from a correction — sound, high confidence.**
  The original PNG sample values already differ, while normalization contributes
  no difference. This rules out the proposed normalization-only explanation for
  these inputs, despite their RGB/RGBA representation difference. The extra
  half-float graph and Rec.709 buffer are real source stages, but their intermediate
  values were not saved. Selecting one as the cause, fitting a ±1 tolerance or
  changing PNG profile labels would convert a plausible explanation into invented
  evidence. The audit therefore names a small future stage comparison and its
  limits, with no production fix or acceptance relaxation.

Local review checked one bounded byte-inspection owner, exact input/sample/source
pins and full channel/interior facts. It removed an unused pair key, retained all
complete byte comparisons and used the actual FrameImage PNG owner name. No
renderer, native binary, source media, model/runtime setup, service or GUI work ran.
The display oracle remains unchanged. There is no user-only decision or unresolved
unsound choice in this pass.
