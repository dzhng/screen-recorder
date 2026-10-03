# Blind product skill journey

A fresh `gpt-6-luna` agent received only the product skill, built CLI location,
isolated socket and task fixture paths. It was forbidden to inspect code, specs,
tests, history or the database. It used CLI help and actual asset/job/project/edit/
preview operations to build a project with A narration, B picture and quarter-level
B music, then delivered project time 0.2–1.2 seconds. No implementation hints or
follow-up correction were supplied; it reported no skill/API confusion.

The agent pinned revision `d115dbef-bd5d-48e8-9482-50e6c12c7d72` of project
`8e3fce0f-c903-4a4e-becb-b9ee8c107929`, inspected settings and fully decoded the
[delivered preview](preview.mp4). Parent verification independently obtained the
[revision through CLI](revision.json) and measured the delivered left-channel mix:
[0.2499 music/narration](media-check.json), against the requested 0.25. The output
contains one second of H.264 video and stereo 48 kHz AAC. No playback or subjective
listening was performed; this synthetic corpus is not real-speech acceptance.

The local skill validator passes using `uv run --with pyyaml python` and the
system skill-creator validator. The system/bundled Python installations lacked
PyYAML; no global environment was changed. The scratch service was stopped and
its home removed after retaining these outputs. This validates the preview workflow,
not durable project export or the full tutorial acceptance in slice25.
