# Retained recording preservation checkpoint

One real narrated-workbench recording is read through the installed format-1
recording service and an isolated acquisition/identity project. The original
library and installed app remain untouched. This checkpoint supplies media and
word-projection evidence for [23a](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/23a-recording-project-preservation.md);
it does not switch the installed application or close the full cutover matrix.

## Isolation and reproducibility

The checked-in `fixtures/narrated-workbench` media/journal are byte-identical to
the selected retained recording. The baseline uses the installed bundled service,
CLI and native executable with its configured Node 24 runtime and an explicit
isolated home. A read-only online catalog backup is projected to the selected
recording's actual rows; unrelated owners, orphan observations and all original
export intents/jobs are removed before startup. No lifecycle rows are invented.
A macOS sandbox denies writes to the original library and installed application.
The selected pre-edit catalog is retained; no unrelated recording metadata or
model files enter the archive.

The [harness](../../../../../packages/test-harness/editing/cutover.mjs) owns the
public journey and independent saved-artifact checks. Its `--inspect` checkpoint
stops after old source/transcript readiness; `--resume` retains existing homes;
`--full` selects full recorded support; `--verify-only` rechecks saved media and,
if needed, finishes public transcript pagination. Supply `--out`, `--legacy-home`,
`--legacy-app` and `SCREENREC_NATIVE`; the installed Node runtime is required.
Scratch paths in receipts are historical, not a promise that those paths survive.
The archive inventory maps retained files independently of those paths.

## Measured acceptance and permitted differences

The full source interval is 134,025,574µs. Complete project PCM is exactly the
original 48 kHz mono narration duplicated at unity to both channels, placed at
floor(48,675µs×48 kHz)=2,336 frames, with zeros outside acquired support. There are
6,433,227 project frames; a one-frame placement mutation fails. Opening 12 s also
matched after explicit unity duplication; FFmpeg's default mono-to-stereo
attenuation was an invalid comparison oracle.

Historical nonzero-start excerpts and full project audio are not interchangeable:
old 30 s chunk reads exhibit a one-sample earlier source phase and nearest-duration
rounding adds one zero terminal sample. Complete source PCM, not stitched old
excerpts, is the independent oracle. Current absolute floor endpoints and
containing picture selection are preexisting policies in
[contracts](../../contracts.md), not allowances fitted to this run.

At the same requested 67 s and 134 s, the old selector chooses later source samples
than the current containing-interval selector. These public differences remain in
the retained same-request packet. At matched actual source PTS, all three complete
old clean images equal current direct-source pixels exactly. Composition differs
by at most one channel code in the measured images; that observation is not a new
pixel tolerance or broad color-fidelity guarantee. Final visual judgment is
recorded separately and does not erase time-selection differences.

The old 306-word historical transcript was ready without inference. One explicitly
prepared existing Parakeet run supplied new source evidence; complete raw text,
token timings and sample counts match. Every public word, including all
continuation pages, preserves lexical identity and maps the new source word
bounds exactly. Changes to spoken word boundaries are intentional from commits
247adb4f/02191f76. Historical processing-time measurements are not identities.
Outer gap rows differ because project evidence covers authored clip support:
no source-gap row is invented before or after the narration clip. Exact old/new
gap rows remain in the report; this is not blanket transcript-row equality.

Both full H.264/AAC exports committed with receipt byte/hash verification. All
4,021 current video timestamps follow the declared 30 fps floor clock; both video
tracks retain full support. Complete decoded exported audio uses the unchanged
first-preview recovered-audio RMS<0.002 policy, without fitted shifts: legacy
RMS 0.000328162, project 0.000118946. AAC decoded tails contain 500/501 padding frames,
each below the existing one-packet bound. Silence and half-gain negative controls
fail the same bound. Audio duration differs by one sample under the explicit
old nearest/new floor policies; encoded bytes and mono/stereo layouts differ.
This is sample/content verification, not a listening verdict.

## Explicit pointer and color presentation

The first independent visual critique found the expected captured cursor in old
exports and no cursor in the clean project export. The same project's video clip
now has an explicit pointer processor with zero trail, matching the installed
movie owner's recorded zero-trail policy. The
[presentation continuation](../../../../../packages/test-harness/editing/cutover-presentation.mjs)
retains the clean revision and exports the new pinned revision. No ASR or clean
media render was repeated. Pre-encode changes at the sampled visible-pointer
instants occupy only the measured cursor rectangles; the end frame remains
unchanged. Complete pointer-export audio passes the same existing bound.

The old movie is tagged sRGB transfer and the new movie Rec.709, as declared by
its output settings. Unmanaged FFmpeg PNG extraction is retained as diagnostic,
not the final color comparison. Both saved movies were imported publicly and
read through the same source-frame color owner. Those native PNGs declare sRGB;
review crops preserve/normalize profiles explicitly. The full image diagnostics
show smaller differences on this route, without introducing a color threshold.
This pass adds no broad color or continuous-playback claim. Existing 09b
acceptance of reversible balanced-detail loss remains intact; outstanding
playback/animation judgments stay with slice 16 and full-editor acceptance.

## Failure history and remaining scope

Retained failures include unavailable forced clone support; current-format
service refusal of the format-1 snapshot; a harness stream-duration lookup bug;
waiting for `ready` instead of export `committed`; invalid implicit mono mapping;
legacy terminal-count and stitched-excerpt PCM mismatch; incomplete transcript
pagination; two asset-import result-field lookup mistakes in the presentation
continuation; and out-of-bounds crops on the initial small opening images. The final
packet scales crop rectangles to actual dimensions and asserts in-bounds areas.
No product tolerance or worker recipe changed to make these checks pass.

This checkpoint does not establish physical capture,
interrupted capture/recovery, old export-recovery parity, installed discovery,
all concurrency/lifecycle cases, relocated old-format migration, speech cleanup,
retiming, broad source color, or human listening. Those remain with their existing
owners and the unchecked parent 23 cutover gate.

The compact gate reports and archive inventory accompany this document. Their
`fullCapture` references locate complete request/response logs and public pages
inside the archive; compact reports are summaries, not replacement evidence.
Archive members retain their original names and hashes; duplicate contents use
standard tar hard links. Restore by concatenating the numbered archive parts and
extracting the resulting xz-compressed tar into a fresh directory. Rehash every
member against the inventory before relying on relocated evidence. No scratch
home cleanup is part of this checkpoint.

## Review and acceptance

The [final independent visual critique](visual-review.md) inspected all 39 full
images and 156 crops, including the original clean controls and the explicit
pointer version. It accepts sampled geometry, content and readability; visible
same-request scroll differences and mild encoded tones remain recorded. This is
not exact pixel/color identity or playback/listening acceptance. The first
critique and failed crop packet remain in the archive.

The [independent code review](code-review.md) found no actionable defects after
shape, diff and documentation review. Syntax, formatting and focused lint pass;
the actual public journeys and saved-media gates are the behavior tests. No
production implementation changed. [Verification](verification.json) records
archive/member hashes, executable identities, checks and remaining ownership.

[Integrated root verification](root-verification.json) rehashed all archive parts
and members, reran saved-output checks, independently decoded the three matched
source image pairs, and found complete decoded audio identical between the clean
and pointer-enabled project exports. No service, native render or inference rerun
was required. Optional Preview review closed without a user response; acceptance
rests on the scoped evidence, not inferred human approval.
