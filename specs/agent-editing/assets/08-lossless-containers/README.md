# Mixed lossless containers

The existing native production-entry mixer probe now substitutes mono AIFF and
stereo ALAC for its independently authored WAV sources. It verifies every mixed
sample against the original WAV reference, including endpoints, fractional range
selection and a pure split of both overlapping clips. All sixteen checks pass with
the frozen combined worker; no tolerance or runtime implementation changed.

The negative control forces the stereo source to mono before import. The same
reference comparison fails at sample 24002, proving that channel loss is observable.
An initial large-array diff was stopped while formatting its failure; a scalar
first-mismatch assertion records the identical fault compactly. This changed only
the scratch negative control, not the committed checker or expected samples.

Independent review found no actionable defect. Its runtime attempt failed in an
unchanged native-reader assertion before reaching the new cases; the root run
supplies actual execution evidence. Raw report and failure log are retained.

This covers 48 kHz lossless container equivalence in actual overlapping composition.
Mixed sample rates, lossy composition endpoints, physical segment origins and
real-narration listening remain separate open checks. It does not promote
source-only extraction evidence into composition acceptance.
