# Conventional denoise baseline — mechanism only

The [report](report.json) freezes one explicit afftdn recipe on existing narration
and room-tone extracts. All three outputs retain their input sample counts and
have no clipped samples. Room-tone RMS falls by about 1.51 dB; speech-extract
aggregate levels change by less than 0.15 dB. These measurements are not speech
quality, latency compensation, continuity or intelligibility proof.

Run `python3 specs/agent-editing/assets/12c-denoise-baseline/reproduce.py` from
this checkout to reproduce into a scratch directory. The original report retains
the exact original invocation paths; input/output hashes identify the frozen
bytes. The installed comparator's [version](version.txt), [license](license.txt)
and [filter capabilities](capabilities.txt) are retained. It is a research tool,
not a new product dependency. No model was downloaded and no audio was played.

The inputs are already-retained real narration from the voice experiments.
Outputs are raw float WAVs, without audition level matching or inferred latency
correction. Listening, clean/noisy controls, protected phonemes, split/context
isolation, repeatability, stereo, retimed/combined input and range/full behavior
remain open in slice 12c. No backend is selected by this baseline.

A second run through the retained script reproduced all three WAV hashes exactly
on this host. This checks this recipe's repeatability on these inputs only; it
does not establish general deterministic behavior or any audible-quality gate.
