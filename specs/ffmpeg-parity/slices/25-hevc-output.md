# 25 — Everyday typed HEVC delivery

Status: implemented and focused checks passed; Preview showing and end-of-spec full run remain with the coordinating agent. Question: **Can HEVC extend delivery without changing established H264/WAV/M4A behavior?**

Dependencies: existing contracts only.

## Contract and owner

Composition output-settings/compiled records; native AVAssetWriter and core rendered receipts/publication.

Add discriminated HEVC settings rather than reusing H264-only profile/entropy/level controls. Prefer native encoder through existing renderer if verified; use pinned FFmpeg only for a demonstrated gap and freeze that recipe. MP4 SDR opaque output; actual capability readiness distinguishes schema support. WAV/M4A stay native.

If the frozen recipe selects FFmpeg rather than the native default, slices 01–05 become mandatory dependencies before production integration. Reference-binary success cannot bypass bundled readiness, input authority or publication.

## Focused proof and review

One tiny imported-footage HEVC export with independent decode/probe.

Delayed audio/B frames/edit lists/rotation/VFR and fractional cuts with landmarks. Verify actual support, A/V alignment, exact authored duration, AAC priming/tail separately, decoded pixels/tags and no blind -shortest. Existing H264 and audio-output preservation gates stay green. Judge matched output frame against native control.

Retain source/control and candidate shots. Use compare-screenshots to judge the named variable/crop; show useful shots with preview-shots. As the last visual acceptance check, run unprimed screenshot-critique. Human response is a non-blocking chance to redirect reversible choices: allow about five minutes while doing other work, then decide from evidence, record the verdict and close opened shots. Never claim unseen or unheard quality.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.

## Shipped contract and evidence

HEVC is an explicit native encoder choice: MP4, Main 8-bit, opaque Rec.709 SDR.
H264 remains the default with its existing serialized settings and presets.
HEVC uses the requested preset's common bitrate, keyframe and AAC settings;
H264-only entropy and level controls are rejected rather than ignored. Native
VideoToolbox preflight checks the actual requested combination; no codec or
backend substitute is allowed. Delivery verifies the actual HEVC configuration
header's Main profile and 8-bit depths before returning the receipt. Core checks
that receipt's codec against the pinned request.

Discovery adds a separate HEVC inventory alongside the existing H264 inventory.
`ready` means the native compression session can be created for inventory; it
is not a promise that every canvas or encoder-property combination will work.
Requested combinations still undergo output preflight. An unavailable native
HEVC encoder is reported directly. FFmpeg remains an independent decoder/probe
and fixture generator in this proof, with no production dependency or fallback.

The reproducible proof is [the NativeWire test](../../../helpers/mac/Tests/hevc-output.test.mjs).
It invokes the production native dispatcher and composition compiler on four tiny
imported sources, with H264 control and HEVC candidate. The [retained reports](../evidence/hevc-output)
include immutable source/native hashes, requests, receipts, independent ffprobe
metadata and independently decoded stereo audio landmarks.

The project window is 160001–610007 microseconds. Both codecs produce 450006
microseconds, frame timestamps 0/89999/214999/339999 microseconds, Main HEVC or
High H264 as requested, and Rec.709 tags. Portrait, timestamp-gap and B-frame
sources preserve source hashes and frame identities. Both delayed audio channels
peak at output sample 9120. AAC authors 21600 samples; independent decode returns
22464 samples, and the 864-sample packet tail is reported separately from authored
duration. There is no shortest-stream truncation.

### Verification

Red checks first exposed missing HEVC schema support, hardcoded H264 receipt
admission and native decoding that required H264-only settings. Green checks:

- `bun run --cwd packages/composition test src/output-settings.test.ts`: 10 passed.
- `bun run --cwd packages/core test src/project-preview.test.ts src/project-audio.test.ts`:
  28 passed, one existing optional native case skipped.
- `node --test helpers/mac/Tests/hevc-output.test.mjs`: four native control/candidate
  cases passed; evidence retained under `SCREENREC_HEVC_EVIDENCE`.
- `node --test helpers/mac/Tests/retained-audio.test.mjs`: exact retained PCM samples
  and refusal paths passed.
- `node helpers/mac/Tests/audio-file.mjs helpers/mac/.build/debug/screenrec-native <empty-evidence-dir>`:
  32 M4A cases and 12 invalid combinations passed.
- Composition, core, protocol and service type checks, plus changed-file lint and
  formatting checks, passed. Native compilation used at most two jobs.
- Service's existing test file had 17 passing cases and one timeout from its
  absent built service fixture; after building that owner, the single failed
  process-death case passed without changing code or timeouts.
- Independent `codex review --uncommitted` found no actionable defect. Its native
  attempt could not create the H264 encoder in the restricted review environment;
  this does not replace the retained successful unrestricted native proof.

[Complete control/candidate shots, full-frame pairs, 4x supplements, metrics and
fresh critique](../evidence/hevc-output/visual-comparison) preserve all four states.
Every decoded pair differs in RGB bytes, grayscale MAE is 0.00804–0.01293/255,
edge-energy ratios are 1.00018–1.00047, and no grayscale pixel delta exceeds 16.
Full frame including all borders is the crop; enlargement is a supplement.
The fresh unprimed critic found no concrete visible defect: geometry, text,
orientation and SDR appearance match; slight B-frame ringing is consistent with
compression. Root independently viewed all four enlarged pairs. This accepts
only the tested fixture appearance, not arbitrary user-footage quality.

### Remaining scope

No user-media edit, capture or demonstration was performed. This is a narrow
NativeWire output proof plus core preview/publication-contract coverage; a full
CLI/service HEVC export journey and the end-of-spec full run are not claimed.
Showing retained images through native Preview remains pending with the
coordinator. The internal output-settings owner and renderer remain native;
this slice introduces no persisted-state migration or compatibility shim.
