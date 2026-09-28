# Project still-image composition and retained inspection

The [public journey](../../../../packages/test-harness/editing/project-image-evidence.mjs)
uses the actual CLI/MCP, service, native compositor and delivery owners in a scratch
library. It imports asymmetric oriented PNG/JPEG fixtures, inserts and overlaps
images, repeats a placement, changes ordered crop/placement/opacity, inspects dry
and processed taps, retains indexes and delivers preview/export. A second project
places a partially transparent image over actual video. Images carry explicit
image identity, without a fabricated source clock or physical sample.

[Verification](verification.json) records 29 direct pictures and 40 retained PNG
captures. The ten retained image-only index pictures equal their direct pictures
byte-for-byte. Image-only indexes have no source-scene dependency; the mixed
project has exactly the advancing video's scene dependency. Opaque landmarks and
1,440 fully transparent pixels match their independent source/video references
exactly; 256 partially transparent pixels retain both contributors. Reordered
processing changes output while dry pixels remain unchanged.

The journey checks movie membership against matching direct frames and verifies
preview/export byte equality. Six decoded movie-frame mean RGB differences range
from 1.4 to 3.2 code values under the fixture's membership/layout bound of 12.
This is not broad color, codec or photographic-fidelity acceptance. Separate
encoding/color gates stay open. Cache regeneration, historical reads, retained
index restart, delivery revocation, external export preservation and raw-source
independence after project deletion are exercised through public operations.
The complete receipt/transport trace is [compressed JSON](report.json.gz).

## Review and scope

[Fresh visual critique](visual-review.md) inspected all forty captures and the
[4× contact sheet](contact.png). The critic suspected index/direct differences
for indices 3 and 7. Both pairs are byte-identical, and both pairs also share SHA
`836f9b2a19958325b839af90aa1300e07f88c60cc44f919a05192fe195790093`;
that visual suspicion is disproved. Author inspection agrees that the abrupt
layer changes follow authored boundaries, and the cropped/fringed processed
states follow the deliberately different crop/placement order. No definite
orientation or alpha-edge defect remains in these fixtures. All forty PNGs remain
byte-identical after the aggregate-admission repair below.

[Timed preservation](pixel-preservation.json) compares the prior integrated
worker's 23 pointer captures and 118 rendered geometry PNGs (plus four fixture
references) with the aggregate-admission worker. The later shared-image-only
budget correction is covered by the native regression and final public image/video
journey; integrated pointer/geometry verification remains the root merge gate. Existing pointer-color
acceptance remains red: preserving its pixels is not fixing its encoding gate.
The composition suite passes 141 tests; core passes 627 with one preexisting skip.
The retained logs distinguish those unit checks from actual public native media.

Independent review logs are retained for the [first](review-first.log.gz),
[second](review-second.log.gz) and [final clean](review-final.log.gz) passes.
The first review found that a new image could be opened before
checking the aggregate source-pixel bound. Admission now reserves all video
metadata and retained image pixels before calling the existing still decoder with
its remaining allowance. The [native budget regression](../../../../packages/test-harness/editing/project-image-budget.mjs)
is red on the earlier worker and green on the repaired worker: two individually
legal images exceed the shared allowance; the second is now refused at its header
with the remaining limit before image creation. [Before](budget-red.json) and
[after](budget-green.json) preserve the exact errors and measured worker residency.
These compressible fixtures do **not** show a meaningful RSS improvement, and this
check does not establish release-scale memory acceptance. A second independent
review found that overlapping occurrences still charged a shared image repeatedly.
[That red reproduction](budget-repeat-red.json) now passes in the
[combined budget gate](budget-final.json): three occurrences share one image open
and one decoded-image identity. Source pixels are charged per distinct image
binding. The successful large-image probe peaks around 540 MiB resident, so the
pixel allowance must not be presented as a matching byte-memory limit.

This checkpoint uses the existing static authoring hold at zero and existing
index selection/materialization. It adds no image editing command, source scene
clock, queue, deletion owner or image-specific transform interpreter. Catalog 13
refuses earlier development retained receipts instead of guessing their provenance.
The isolated journey still names movie-v4/picture-v5: the service's next combined
image/pointer recipes are owned by the parallel pointer integration pass. Root must
rerun integrated checks with that binding before closing this checkpoint's acceptance.
[Fresh product-skill use](skill/grade.md) independently passes the image workflow
using the supplied skill and public help only. Initial CLI syntax mistakes recover
without implementation access; the skill now states the successful stdin/stdout
pattern explicitly. Prevention of those first-attempt mistakes is not claimed tested. Real photographs, all image-profile variants,
animated processing, animated image containers and release-scale capacity are not
proved by these two small project fixtures; raw orientation coverage remains in
the separate native/source-image evidence.
