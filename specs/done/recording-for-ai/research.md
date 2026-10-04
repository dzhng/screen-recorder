# Research, evidence, and architecture synthesis

Historical recording-design record. The [recording guide](README.md) owns its
scope and points to current implementation; this document does not reopen old work.

## What was actually checked

The initial planning research checked reference repository files, installed SDK
headers, host/toolchain versions, official model/runtime documentation and MCP
specifications. Subsequent bootstrap and real-client image probes have retained
evidence in [bootstrap verification](assets/bootstrap/verification.md) and
[client image review](assets/client-image/review.md). The latter proves both MCP
image content and CLI-file ingestion with generated fixtures.

Native capture and speech preparation have additional work in progress; consult
the [current handoff](README.md) before treating those as integrated
results. Synthetic speech establishes runtime plumbing only. Human filler fidelity,
word-boundary accuracy, crash recovery and complete native audio behavior remain
acceptance gates. Numeric targets in uncompleted slices are requirements, not
measured capabilities or published vendor claims.

### Native capture and recovery

Installed evidence is under
`/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/System/Library/Frameworks/`:

- `ScreenCaptureKit.framework/Headers/SCStream.h:254` exposes cursor inclusion;
  line 269 exposes sourceRect; lines 295–310 audio/sample rate/process exclusion;
  lines 360–365 microphone capture/device; lines 390–437 frame status, display time,
  scale, content and screen rectangles. These are distinct fields; don't assume
  coordinates equal screen points multiplied by two.
- `AVFoundation.framework/Headers/AVAssetWriter.h:412` documents movie fragments
  allowing partial playback after interruption, disabled by default. Its segmented
  delegate mode has additional restrictions and is not interchangeable with the
  ordinary file writer. Try the documented file-fragment feature before building
  a second segmented-container layer.
- `Speech.framework/Modules/Speech.swiftmodule/arm64e-apple-macos.swiftinterface:354`
  exposes SpeechTranscriber options; `:385` exposes audioTimeRange. These symbols
  establish availability, not verbatim accuracy.

Public references for implementers:
[ScreenCaptureKit frame metadata](https://developer.apple.com/documentation/screencapturekit/scstreamframeinfo),
[microphone output](https://developer.apple.com/documentation/screencapturekit/scstreamoutputtype/microphone),
[movieFragmentInterval](https://developer.apple.com/documentation/avfoundation/avassetwriter/moviefragmentinterval).
Use the installed non-beta SDK as authority when web documentation includes newer APIs.

### Transcription candidates

[Superwhisper's list](https://superwhisper.com/models) establishes local Whisper,
Parakeet, and Cohere choices. It does not establish filler preservation or precise
cut boundaries. [Willow's documentation](https://help.willowvoice.com/en/articles/12854269-how-willow-protects-your-data-and-privacy)
describes cloud transcription, so it is not the local runtime reference.

Initial bounded comparison:

1. **Parakeet TDT v2 through FluidAudio.** Its
   [batch guide](https://github.com/FluidInference/FluidAudio/blob/main/Documentation/ASR/GettingStarted.md)
   specifically distinguishes English v2 from multilingual v3. Reproduce its batch
   example on a fixed narration WAV before integrating.
2. **Whisper large-v3-turbo through WhisperKit.** The
   [upstream Swift repository](https://github.com/argmaxinc/argmax-oss-swift)
   includes local Whisper inference. Verify the pinned version's word-timestamp
   option and model identity; the repository formerly named WhisperKit redirects
   to argmax-oss-swift. Do not infer support from a third-party wrapper.

Both candidates must be evaluated through the exact intended local runtime.
Select one production engine; eliminate unused probe dependencies after selection.
Downloading models for future evaluation is explicit setup; inference must run
with network access disabled after assets are prepared.

Apple's [SpeechAnalyzer presentation](https://developer.apple.com/videos/play/wwdc2025/277/)
describes on-device transcription and attributed timing results. It is the first
bounded alternative if initial candidates fail or their packaging becomes burdensome.
Do not use cloud-fallback legacy speech recognition while calling it local.

[CrisperWhisper](https://github.com/nyrahealth/CrisperWhisper) explicitly targets
verbatim recognition and word timing. Its current README distinguishes permissive
inference code from separately licensed model weights; macOS uses its PyTorch path.
It is a research lead if ordinary dictation models fail, not an approved production
dependency. Evaluate model permission and local performance before adoption; don't
silently inherit a distribution obligation from an MIT code license.

The [CrisperWhisper paper](https://arxiv.org/abs/2408.16589) treats disfluency
preservation and word alignment as explicit problems. This supports a separate
filler/timing gate instead of choosing solely by word-error rate. Forced alignment
can align supplied text but cannot by itself recover words missing from that text.

### MCP and actual agent access

The [MCP tool specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
defines actual image content separately from resource links and structured results.
The [stdio transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
reserves stdout for protocol messages and uses stderr for diagnostics.

Use a pinned official TypeScript SDK release and its matching protocol version;
do not hand-roll the MCP transport or assume a draft protocol is required. Latest
SDK symbols/versions are a bootstrap check, not frozen by these documentation URLs.

Personal acceptance uses an available non-Claude agent: the user requested no
further Claude use, and the earlier Claude Code image evidence stays recorded in
[slice 00b](https://github.com/dzhng/screen-recorder/blob/2e1028cddc3f89d58018a4ebcbc8895b28a78ae1/specs/recording-for-ai/slices/00b-client-image-probe.md). Record the client version at
execution, supply isolated session MCP configuration, and never change the user's
global configuration for tests. A second client is optional future coverage, not
required for personal release.
Prove both MCP image blocks and CLI-file image ingestion. A protocol inspector alone
cannot prove the language model received or understood an image.

## Independent draft synthesis

Three blind drafts used the same map with different lenses:

| Lens | Contribution carried forward | Changes made during synthesis |
| --- | --- | --- |
| Fewest slices | One core, one native boundary, app-managed service; avoid packages per noun and independent daemons. | Its broad feasibility slice was split into separate capture, recovery, geometry, model, and client checks. |
| Risk first | Early native/model/image probes; preserve genuine failed requirements rather than silently downgrade them. | Keep complete capture→edit acceptance at the end, after edit implementation; image-only probe runs early in 00b, independently of native/model work. |
| Seam quality | One timeline owner; registry-backed CLI/MCP parity; re-open exports through the same inspector; unique undo revisions. | Keep timeline as a module within core until another package has a real independent need. |

The seam draft also consulted an independent Claude Opus/high draft. Claude's
external-repository reads were blocked by its restricted run; the orchestrator and
seam agent read the reference manifests directly. Accepted its parity/package
suggestions; rejected downgrading filler fidelity, restoring old revision IDs on
undo, and an edit acceptance dependency before the edit engine existed.

## Recursive fog audit

| Previously broad area | Resolved into | Failure rule |
| --- | --- | --- |
| Native recording | 01 capture, 02 interruption, 03 cursor coordinates, 07 UI controls | Don't combine an unproven container fix with unrelated UI work. |
| Evidence | 09 frame decoding, 10 trail appearance, 11 selection coverage | Judge one output variable per fixture/review. |
| Local speech | 04 evaluation, 08 production processing | No filler-edit release claim if gate fails. |
| Editing | 05 pure mapping, 12 API transactions, 13 actual media execution | One mapping owner; decode/audition the edited media. |
| Sharing | 14 pinned exports and relocated package inspection | Local absolute paths cannot masquerade as portability. |

Dependent slices may not proceed on a failed feasibility assumption. Reslice a
bounded alternative and update the handoff; independent work can continue. Only
changes to the user's product scope require returning to the user for a decision.
