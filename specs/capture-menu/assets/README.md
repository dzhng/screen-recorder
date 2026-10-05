# Reference authority

[reference-manifest.json](reference-manifest.json) pins the selected concept,
its six reviewed states, the user's inspiration and the exploration artifacts.
Keep these inputs unchanged. New captures belong in a separate candidate/evidence
directory with their source revision, fixture, appearance and backing scale.

The selected HTML concept defines intended geometry and hierarchy. The supplied
image is inspiration; it does not override the user's later choice of Design A.
The sharp screenshots are concept renders, not native implementation proof.
Their board text, fake names, thumbnails, times and status values are illustrative.

The historical quadrant map and prototype reply chip are superseded by the
spec README's Next Agent Prompt. Their OPEN items are assigned to slices in
that README. Do not resume the interview or start a build from their old prompts.

## Reference landmarks

Measurements below come from the frozen concept's CSS and sharp idle screenshot,
before native code exists. CSS pixels are the concept grid; native points and
backing pixels must be recorded independently. Do not scale native evidence to
make it agree. Native arrow/shadow and font rasterization are platform differences;
card relationships and control density remain requirements.

| Feature | Reference relationship | Native candidate / delta | Verdict |
| --- | --- | --- | --- |
| Capture silhouette | 352 grid units wide; rounded 19-unit corners | Not produced | OPEN: slice 01 |
| Panel interior | 17-unit side inset; header has its own 18-unit inset | Not produced | OPEN: slice 01 |
| Source grid | Two equal columns; 9-unit gaps; 81-unit tile height; 12-unit corners | Not produced | OPEN: slice 01 |
| Device rows | Minimum 55-unit height; 9-unit inter-row gap; 11-unit corners | Not produced | OPEN: slice 01 |
| Switch | 42 × 25; position communicates on/off | Not produced | OPEN: slices 01, 12 |
| Primary action | 44-unit height, spans panel interior; source controls precede it | Not produced | OPEN: slices 01, 12 |
| Library structure | Sidebar 146 units; titlebar, sidebar and content are visibly separate | Not produced | OPEN: slice 03 |
| Library rows | Thumbnail slot 88 × 56; 12-unit content gap; 13-unit vertical row padding | Not produced | OPEN: slice 03 |
| Selected state | Blue border/icon with pale blue interior; also checkmark | Not produced | OPEN: slice 12 |
| Surface / text | Warm neutral capture surface; clear primary/secondary hierarchy in both appearances | Not produced | OPEN: slice 12 |

For geometry, include every outer edge and a small band of surrounding context;
then compare tile/device-row crops at actual scale. Do not crop away the footer or
scroll limits. For appearance, compare card interiors, text and adjacent surfaces
separately from the shadow fringe. The full native composition check is last.

The 1280-wide sharp board and 352-wide panel imply a one-to-one grid mapping in
the retained idle capture. Do not apply that assumption to the user's inspiration
image or a future Retina capture. Record dimensions/DPR or report uncertainty.

The screenshot review from exploration accepted visible mockup layout and contrast.
It did not prove native focus, permissions, capture exclusion, query breadth,
clock mapping or publication. No historical screenshot is an actual native before
baseline; obtain that baseline from the current app before replacing presentation.
