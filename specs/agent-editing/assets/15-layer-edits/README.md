# Processed clip split journey

The existing [live layer journey](../../../../packages/test-harness/editing/layers.mjs)
now splits a placed presenter at 333333 microseconds through MCP. CLI and MCP
deliver identical PNGs before and after the edit at the boundary, its immediate
neighbors, and interior/end samples. The full preview retains the independently
expected geometry and ten-frame clock; the original stereo narration remains
byte-exact after WAV decoding.

Clearing processing on the right-hand piece is the negative control: its picture
must change to the independently computed unprocessed layout, while a picture
from the left-hand piece remains byte-identical. This proves the check detects
lost processing and that the two pieces can be treated independently. The
[before](before-600000.png) and [after](after-600000.png) captures preserve that
observable difference. This uses static source fixtures; it does not close moving
source boundary conformance, retiming, stateful processors or listening acceptance.

[Verification](verification.json) records the invocation, frozen worker, hashes
and scope. The [complete journey](journey.json) retains public command traces and
receipts, with JSON whitespace compacted. All 62 previously reviewed static tap
images retain their hashes on the combined pointer-contract runtime. No new
renderer behavior or visual-quality acceptance is claimed.

The [independent code review](review.txt) found no actionable defects. Review
used syntax/diff checks; the integrating agent ran the actual native journey.
The scratch service is stopped and its home removed on both success and failure.
Trim, move, duplicate and pointer rendering remain separate live acceptance work.
