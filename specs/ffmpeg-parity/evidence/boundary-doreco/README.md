# Primary word-boundary reference candidate

The [manifest](manifest.json) retains primary DoReCo methods, the English dataset's
actual license declaration and complete original master annotations. The methods
explicitly describe manual correction of word starts, ends and transcription
mismatches, followed by automatic phone alignment inside the corrected words.
Word boundaries have human correction authority; phone boundaries do not inherit it.

The original archive's dataset-info file declares CC BY 4.0 for both annotations
and audio and supplies the individual dataset citation. Its master EAF files retain
the complete word sequence, pauses and tagged uncertain/disfluent material.
The lossless archive keeps those master files and their documentation rather than
duplicate generated CSV, TextGrid and XML representations. Member hashes bind the
retained bytes to the acquired primary archive; the complete primary pages and
audio index are also retained.

This is reference-authority evidence, not an alignment quality result. The initial
inspection acquired no original audio. The later [source admission](source-admission/README.md)
binds a selection frozen before audio acquisition to original complete-stream
hashes, selected PCM, physical clocks/channels and unchanged neighboring labels.
The later [candidate and scoring freeze](alignment-protocol/README.md) retains
primary provider/license operands and independent row eligibility. The full cohort
cannot pass while stereo source/channel support remains unknown; no provider ran
and no listening occurred.
Preserve ambiguous labels explicitly rather than manufacturing clean words or
certifying annotator precision we have not measured.
