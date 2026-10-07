# Delivered picture observations

[The public runner](../../../../../packages/test-harness/editing/picture-observations.mjs)
uses the existing CLI/MCP journey and native frame lane. Its help owns invocation
and case selection. An explicit certified media directory reuses the camera corpus
without another large fixture copy; authored tiny controls live here. No model,
physical input, installed app or user's library participates.

Measurements use profile-managed premultiplied sRGB RGBA8 from the very CGImage
encoded as the inspected PNG. The recipe declares encoded-sRGB Rec.709 weighted
luma, rounded to a byte, with RGB and luma histograms. Only alpha255 contributes
to color statistics; alpha0 and partial alpha remain distinct coverage. The
independent ImageIO observer decodes the delivered PNG with its actual profile
and reproduces its complete RGBA digest and every full/region histogram exactly.
The native input profile describes the rendered raster, not original media tags.
Named DeviceRGB without exportable ICC bytes keeps `sha256:null` and absent ICC
coverage; measured sRGB and delivered PNG profile evidence remain separate.

Masks are caller rectangles in delivered upright top-left pixels. Requested and
intersected extents stay separate; missing regions and regions without opaque
pixels are unavailable. The camera rectangles sample visible face areas, walls,
whiteboard, curtains and forehead highlight; their names do not establish native
segmentation or universal acceptable exposure. Thresholds define observation
bins, never a grade or an edit. A fully dark scene can produce whole-raster edge
candidates without a transition. The black-band control has measured bright
adjacent rows. Neither observation establishes unwanted borders or content loss.

The request bounds the aggregate area of named regions to one maximum raster, so
a valid request cannot multiply native work without limit. Each edge receipt
carries its luma histogram; admission recomputes opaque fraction, dark fraction
and mean from those bins before retaining the evidence.

[Accepted requests/results](accepted-report.json) retain source and compiled
revision/sample pins, processing recipes, masks, profiles, coverage and native
worker identity. The one-row source/project index continuations retain the same
measurement recipe and independently verified PNG deliveries. [Shots](shots.json)
pin native-size representative outputs; [control receipts](control-receipts.json)
provide real cross-language admission operands. No original recording changes.

[Matched comparisons](comparison.json) keep plain and measured PNG hashes equal;
observation is deliberately read-only. Explicit scratch -4/+4 EV controls change
the output bytes and measured brightness while preserving sample and geometry.
Those exaggerated controls prove the metric follows the delivered image, not
that the treatment is editorially desirable. Existing [player-oriented reference](../13-decoded-picture/README.md)
remains unchanged; this slice does not relabel absent ICC as profile equivalence,
replace its tolerance, or claim HDR/all-frame acceptance.

[Verification](verification.json) records scoped gates and red/green receipts.
Visual and code review verdicts are retained separately. These are sampled
primitive checks, not permission to crop, normalize or grade a user's project.
