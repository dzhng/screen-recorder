# Denoise state and endpoint failures

This [probe](reproduce.py) runs the unchanged conventional recipe from the
[baseline](../12c-denoise-baseline/README.md), with real narration and synthetic
impulses. The [report](report.json) freezes original commands and observations;
[hashes](hashes.json) identify retained inputs, outputs, script and report. Run the
script to reproduce into a scratch directory. No model or speaker playback is used.

Fresh filter instances do not preserve the original result at cuts/windows:
independently processed halves differ from whole-output processing at 3,842 of
120,000 samples (maximum absolute error 0.0128543). Direct processing of the final
second differs at 3,192 of 24,000 samples (maximum 0.0305391). Equal sample counts
do not establish equivalence. Tiny differences beyond 100 ms do not prove any
universal context bound.

At 24 kHz, impulses at samples 0 and 2,400 peak 600 samples later: a 25 ms delay in
this recipe. An impulse at the final sample has no output above 1e-6. Its numerical
residue has no meaningful peak timestamp. Unchanged output length masks an
uncompensated endpoint loss.

This rejects naive reset/per-window execution and sample-count-only acceptance.
It does not reject a prepared-result design: pure splits and range reads can
reuse explicitly retained processing, but compensation/tail handling, edited-input
isolation and actual speech/listening quality must still be demonstrated. The
candidate is not adopted and slice 12c remains open.
