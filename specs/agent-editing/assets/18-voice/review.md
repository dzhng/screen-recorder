# Reproduction review

The runner owns only an experiment: explicit local input, bounded generation,
frozen output and provenance. It introduces no production queue, database,
protocol operation, model-download-on-read path or voice enrollment. Runtime and
weights remain in isolated `/tmp` directories. The requirements lock is scoped
to this reproduction, not the application's dependencies.

Shape review retained a Node entry point for the spec's command and one Python
worker for the actual MLX call. The separate verifier reads saved WAVs and does
not call synthesis. Origin simulation is explicit; identical reference copies
cannot stand in for production asset retention. No model candidate is accepted
merely because it is installed or passes numeric checks.

Diff review checked the narration's acquisition offset against the inherited
corpus label and FFmpeg behavior: FFmpeg's decoded first frame has PTS zero, so
source ranges subtract the 48,675 µs source origin before trimming. Fractional
sample boundaries are rounded once for this experimental splice, with exact
resulting frame positions saved. This is not a production edit-time policy.
The generation recipe preserves the pinned runtime's ICL minimum repetition
penalty and avoids its inverse-RTF reporting convention.

Verification completed: six offline generations, fourteen downloaded model files
verified against their pinned repository revision, network denial canary, six
PCM/hash checks, mutation rejection, Node syntax/lint, Python syntax, source and
runner identity checks, documentation links and whitespace. Existing production
code was untouched, so no preservation behavior is claimed from unrelated test
reruns. The first observed cold run and all warm runs remain in the manifest.

The join images are review aids, not a visual pass. The entry window visibly
contains a change in amplitude/spectral texture; that cannot establish whether
it is audible, acceptable or speaker-consistent. Calibrated original-boundary
comparison, independent visual review and listening remain open. No speakers were
used, no new recording was made, and no personal-disk scan was performed.

Documentation review connects the slice to this evidence and the runnable probe,
without changing the parent's README or choices ledger. Remaining scope is named
in the evidence README and slice status. The checkpoint is clean as a bounded
reproduction; **slice acceptance remains incomplete**.
