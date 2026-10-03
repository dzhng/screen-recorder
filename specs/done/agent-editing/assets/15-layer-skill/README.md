# Fresh visual editing skill use

A fresh Luna agent received only the product skill, CLI/socket, a scratch project
and the edit request: portrait 96×160, a specified source crop, cover fitting, a
bottom-right presenter rectangle and unchanged one-second narration. It used real
public operations without implementation/spec access. The unedited [report](report.md),
[skill input](skill-input.md) and public receipts preserve what it saw and did.

[Independent checks](independent.json) confirm the final crop/layout pixels against
the existing source-decode/geometry oracle with zero interior error, the unchanged
original audio clip, byte-identical source/project WAVs, and a 96×160 ten-frame
one-second export. Listening and general codec quality are not established.

The process exposed a public-receipt clarity defect. After authoring the correct
bottom-right rectangle, the agent compared private lower-left execution coverage
with top-left raster coordinates, moved the presenter upward, then restored the
requested placement independently. The [intermediate audit](intermediate-audit.json)
passes the initial image and refuses the wrong top placement. Final pixels are
correct, but this is not a friction-free agent workflow. The author's public
coordinates were consistent; native execution primitives should not be presented
as competing authoring coordinates. The current receipt validator checks the full
native graph and then exposes only public timing, layers and source provenance.

A second fresh agent inspected the same final revision through the corrected CLI
receipt, using only the skill and public help. Its unedited
[report](reinspection/report.md) correctly describes the crop, portrait canvas,
lower-right presenter and separate audio binding without the earlier coordinate
confusion. Its [picture](reinspection/picture.png) is byte-identical to the first
run's final image; the [manifest](reinspection/manifest.json) retains the inputs and
receipts. This is read-only inspection, not a second authoring or listening pass.

Fresh unprimed review inspected the final frame, exact 4× enlargement and source
presenter. It found no concrete geometry/orientation defect; lower-right placement
and source landmark orientation were clear. Black source margins prevent visually
proving the exact rectangle edges, so the independent numerical oracle owns those
checks. The same opacity/fit policies and fixed thresholds were retained.

The agent preserved existing step IDs on corrections and recovered from an
intermediate destination collision by exporting the final revision to a new leaf.
Its first authored draft supplied invented step IDs; the successful request omits
new IDs. No repository, original media, installed app or user library was changed.
The scratch service was stopped after verification. Retained receipts include the
old internal graph for diagnosis; they are historical evidence, not a recommended
agent-facing shape.
