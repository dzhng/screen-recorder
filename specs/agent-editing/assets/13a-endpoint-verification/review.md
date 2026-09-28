# Review verdict

Shape, code and documentation review are complete for this research pass. No
production owner, runtime dependency, API or capability was added. The unchanged
C++ recipe and existing support/pitch measurements remain the only algorithm and
measurement owners; new harnesses recover evidence and prepare bounded auditions.
Independent `codex review --uncommitted` found no actionable correctness defect
and reproduced recovery, the speech cohort and measurement tests. Its plot launch
was blocked by sandbox cache access; the primary run rendered every plot normally.

The complete 13-image set received an independent image-only review and a revision
review. Initial scaling hid weak clean-boundary detail and clipped a tone overshoot;
final shared scales use all displayed samples, with headroom and source-specific
labels. The final reviewer reported no obvious plot-edge clipping or cut-off labels.
The final images support qualitative numerical comparisons only. They do **not**
close the full endpoint-quality gate: overlapping diagnostic/exact traces and
compressed full-file overviews limit visual discrimination; zooms sometimes end
before threshold support ends. Complete sample scans and hashes own those facts.

In the charts, “exact support” means the exact-series samples above the stated
1e−7 threshold, not mathematical nonzero support. Guard placement is authored in
sample ranges in the cohort report, not independently proven by unmarked waveform
plots. The whole clean clip is a whole-file boundary control with no outer
neighbors. Tone center spectra show neither full-band nor endpoint quality.
These limits are retained in the independent final review, not converted into
acceptance. Extra separated trace/guard/tone-edge views are available next if a
listener or numerical discrepancy requires them; no evidence is hidden or censored.

A deliberate contradictory PCM identity initially exposed dictionary overwrite
in the new plot admission code. The plotter now refuses conflicting repeated
identities before reading samples; the retained red result fails for that reason.
All loaded PCM checks and complete plots then passed. The existing five measurement
tests also pass, including octave and unavailable-estimate refusal.

Choices examined: use all paired manual phrase marks rather than cherry-pick a
favorable phrase; make the 25 ms guard explicit authored selection rather than hidden
context; retain one whole clean utterance without pretending file boundaries are
word boundaries; keep request admission, pitch evidence and listening as separate
claims. The most uncertain parts are actual protected-word completeness and
small-window speech naturalness. Both stay open for independent evidence.
