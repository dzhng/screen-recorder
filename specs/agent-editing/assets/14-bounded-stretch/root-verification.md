# Integrated verification

Root rebuilt StretchFileParity and StretchParity from the integrated sources
in a new isolated scratch directory, then reran the unchanged proof runner.
All34 checks and descriptor contracts pass. The ten source-manifest entries
match. Frozen production/candidate workers and the retained listening worker
remain unchanged.

The new raw report is `/tmp/screenrec-root-stretch-proof-0929/report.json`; the
checked-in report retains the same contract cases and expected output hashes.
No installed app, public capability or DSP policy changed in this checkpoint.
