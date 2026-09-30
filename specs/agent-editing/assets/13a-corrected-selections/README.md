# Speech edits using the accepted boundary placement

These candidates use the user's accepted paused-reference boundaries, rather than
the earlier selection that split “Okay.” They contain no inserted pauses. The
original background remains; no denoising, room-tone fill, gain adjustment or
fade has been applied. The frozen stretch recipe is unchanged.

Compare the [original](original.wav), “Okay, so this is the recorder workbench,”
with only the new selections below. Pass a candidate if every word remains complete
and clear and the transition into untouched speech sounds natural. Name any clipped,
repeated, echoey or abrupt word/transition. Prior naturalness passes belong to their
old files and are not silently transferred to these new selections.

- [Middle phrase at 0.8×](internal-slower-0.8x.wav).
- [Middle phrase at 0.9×](internal-slower-0.9x.wav).
- [Middle phrase at 1.25×](internal-faster-1.25x.wav).
- [Opening “Okay” at 0.8×](opening-slower-0.8x.wav).

[The report](report.json) pins the source, worker, accepted reference and output
identities. Counts come from the composition sample-clock owner; fractional final
samples follow its floor rule, not a new rounding policy. Exact-count, finite,
unit-identity, excluded-source poison, selected-only and unchanged-neighbor checks
pass. Matched-length tones pass the existing pitch estimator and unchanged 1%
limit. These numerical checks do not supply a listening verdict.

Run the repository [reproducer](render.py) with a new scratch directory argument.
It refuses an existing destination and verifies the frozen worker/source before
executing. It retains the actual invocations and uses the existing sample-clock
and pitch-measurement owners. No model, build or public retiming adoption occurs.

The accepted boundary reference establishes conservative word-group placement,
not sample-exact phonetic edges. The short-word case is one useful explicit
selection; it does not establish arbitrary tiny selections or automatic expansion.

Independent read-only verification rehashed retained files and owners, checked
the original/selected/poison PCM and all unchanged spans, and remeasured tone
pitch through the existing estimator. All checks pass; listening stays pending
for each of the four changed files.

The user replied **all pass** to the corrected A–D word-completeness and natural-join
rubric. [The listening record](listening.json) pins all four verdicts to exact file
hashes. This supersedes pending listening status in the historical numerical
report; it does not accept untested settings or public integration.
