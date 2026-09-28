# Audio tap and capture-evidence skill use

A fresh `gpt-6-luna` agent received only the amended Screenrec skill, CLI launcher,
explicit isolated-service socket/project and a read-only inspection task. It had
no fixture source, spec or grading oracle. [Provenance](./validation.json) records
the boundary and cleanup. One completed blind run passed; an earlier disconnected
setup produced a correct refusal and is not counted as product acceptance.

[Independent grading](./grade.json) compares all four delivered [WAVs](./audio/)
with the deterministic stereo source, not merely with each other or JSON receipts.
Their complete float32 samples, format, exact sample bounds and selected taps match.
The agent correctly distinguished own-stack bypass from ancestor processing and
identified above-unity float peaks without normalizing or claiming listening quality.

[Saved receipts](./receipts.json) preserve source and projected cursor pagination,
geometry events and first-page coverage. Nine observations in each coordinate
space match the authored repeated occurrence; both five-page reads exhaust their
continuations. Project expectations were independently mapped from the captured
source rows and authored placement, with geometry read from the retained original
journal. The agent distinguished unavailable capture authority from no movement,
and kept unsupported event categories unknown. Its [analysis](./agent-analysis.txt)
and the unchanged [final project](./final-project.json) retain the actual outcome.

This establishes usable guidance for the exercised PCM taps and capture reads.
It does not establish AAC extraction, denoising, perceptual joins or a broad model
success rate. No product code, source media, installed app or user library changed.
