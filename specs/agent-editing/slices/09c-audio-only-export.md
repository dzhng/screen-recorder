# 09c — Audio-only export

Status: implemented and verified in the isolated native/service scope. Float32
WAV and AAC/M4A have separate passing public verdicts, including the merged tree.
Two existing large-fixture deadline checks remain red in root verification.
Installed release acceptance, performance and personal speech quality are not
claimed by this slice.
Dependencies: [09](09-first-preview.md), [09b](09b-output-settings.md),
[11a](11a-audio-delivery.md) and [14a](14a-prepared-audio.md).

## Contract

An external caller can import a video, select/extract its audio, author audio
processing and split/trim/remove operations, then export the final project mix as
an audio file through `export.create`. Audio is a first-class export kind, using
the same durable export controls as video. Existing `audio.get` WAV delivery
remains usable, but is not a substitute for this export contract.

The caller explicitly chooses audio output and its supported format. Export
does not modify the project, remove its video, choose edits or apply treatments.
It works both while video remains in the project and after the caller removes
video tracks or selected video clips through existing undoable edits. Such removal
must preserve separately retained audio and immutable source media. Do not add an
automatic extract/clean/delete pipeline or an editorial interpretation of speech.

## Seam and ownership

Extend the project `export.create` request with `kind: "audio"` and typed audio
output settings. Keep validation, defaults, capability discovery, canonical
identity and native lowering in the existing output-settings owner. Audio settings
must not require dummy video settings; video-only fields are invalid for this kind.
Use the same schema and receipts for CLI and MCP. Report the resolved container,
codec, sample rate, channel layout and applicable encoding controls.

The existing export-intent owner pins revision, resolved settings, dependencies
and destination. Its queue, retry/recover/cancel/abandon operations, export listing
and atomic destination publication remain authoritative. Make audio an explicit
snapshot/execution variant; replace assumptions that every non-package export is
video. Preserve frozen intent on lost-response replay and after preset changes.
Do not create another export endpoint, queue, publication state machine or cache.

Use the existing project audio compiler, prepared-audio producer and bounded PCM
stream with the appropriate file sink. Share existing preparation/cache owners
when identities match; do not duplicate mixing, resampling, retiming or DSP.
Audio export must not call video-preview preparation, render pictures or initialize
a video encoder. Existing project canvas metadata may remain, but no visual output
or video-encoder capability is a prerequisite for an audio file.

Readiness concerns only dependencies needed for the selected audio output and
authored processors. Do not inherit editable-package requirements for transcripts
or unrelated evidence. Unavailable explicitly requested processing fails truthfully;
export neither prepares models implicitly nor substitutes dry audio.

## Useful checkpoints

1. Deliver full-project lossless Float32 WAV through public `export.create`,
   including revision pinning, actual destination publication and the existing
   lifecycle. Reuse the verified project PCM rendition and WAV sink. Expose the
   effective rendition and file-size limits; no silent clipping, normalization,
   fades, downmixing or truncation.
2. Inventory standalone audio containers/codecs supported by the current native
   backend, starting with its existing AAC encoder and an M4A container. Add only
   combinations verified by actual audio-only encoding and decoding. Import support
   for MP3 or another format does not establish encoding support. Record unavailable
   combinations explicitly; do not introduce a codec dependency merely to fill an
   advertised list. WAV readiness and each additional format have separate verdicts.

Both checkpoints use one typed output-settings owner and one export lifecycle.
Unsupported settings fail before expensive work, without format substitution.
Equivalent resolved settings share work; changed format or rendition cannot reuse
an incompatible artifact. Retain the verified video and package export behavior.

## Public verification

Add a bounded public CLI/MCP journey at the existing editing harness seam:

```sh
node packages/test-harness/editing/audio-export.mjs --out /tmp/audio-export-evidence
```

The harness exercises the public CLI and MCP against a pinned native worker.
The [public evidence packet](../assets/09c-audio-export/README.md) retains requests,
replies, source/runtime pins, decoded fixtures and lifecycle observations.
The [native FILE packet](../assets/09c-native-audio-file/README.md) proves the AAC
sink, rendition matrix, finite conversion, refusal and movie-mux preservation.
The [merged checkpoint](../assets/09c-23i-merged/README.md) retains actual public
delivery after service-process integration and the unresolved deadline failures.
Use deterministic video/audio fixtures with asymmetric stereo channels, known
sample boundaries and explicit edit requests. Reuse retained processing fixtures
and accepted evidence where applicable; no new personal recording or editorial
audition is required.

- Exercise video import, selected-stream extraction, caller-authored audio
  placement, ordered processing, split and trim, then audio export. Compare decoded
  WAV to the same revision's full processed `audio.get` PCM with exact samples,
  channels, duration and absolute-clock bounds. Check the requested fixture edits
  against known retained intervals, rather than only comparing two engine outputs.
- Export with video present, then explicitly remove only video and export again.
  Preserve audio samples and source hashes; verify removal undo. Export itself
  preserves revision/head/document. Prove no video rendering or encoding occurred,
  including a fixture whose visual preparation is unavailable but audio is ready.
- Exercise a pinned historical revision after a later edit, effective settings,
  equivalent request replay, changed-argument conflict, cancellation/retry,
  restart/recovery and occupied destinations through the existing lifecycle suite.
  A stale completion cannot publish; failed/canceled work leaves no partial final
  file. Status/list receipts identify audio exports truthfully.
- For every additional advertised format, inspect the actual container/codec and
  decode the file. Verify channel mapping, requested rendition, duration, encoder
  delay/padding and protected endpoints; record codec tolerance separately from
  exact lossless parity. Unsupported combinations must refuse through CLI and MCP.
- Preserve existing video/package export and full/range audio-delivery checks.
  Bounded streaming and shared worker admission must survive full output; reuse
  existing scale or lifecycle oracles rather than creating a parallel test system.

Update consumer help and the product skill only after the corresponding public
format works. Mark scoped implementation readiness separately from installed
cutover/release acceptance. Open camera, speech-quality or profiling claims do not
block this independent primitive.

## Implementation discretion

Choose the smallest typed extension and reuse native file sinks where verified.
No new project type, alternate audio engine, raw encoder-command interface or
development-only compatibility layer is required. Split further only if standalone
encoding reveals a distinct unresolved backend contract; keep the working WAV
checkpoint available and document the precise remaining format limitation.

## Verified implementation boundary

`kind: "audio"` uses the existing durable export intent, job queue, derived cache
and destination publication. WAV publishes the existing full processed project
PCM: 48000 Hz, stereo, Float32, with no sample changes. M4A adds an encoded
derivative of that same PCM, pins its encoding implementation independently, and
uses the existing AAC controls. Verified standalone rates are 44100 and 48000 Hz
with mono or stereo layout. Native preflight remains authoritative for each
rate-control combination. Unsupported formats and WAV rendition changes refuse;
no new codec dependency or format substitution is provided.

The standalone AAC sink writes an audio-only ISO MPEG-4 container at the M4A
path. Its standard edit list removes visible encoder priming. Presented
`contentFrames` and decoder-visible `encodedFrames` are distinct: the latter may
include trailing compressed-packet padding. Both survive in the public audio-file
job result. Presented content is checked against the finite resampling quota;
authored duration stays pinned to the original project PCM clock.

The exact WAV oracle checks every sample against independently authored gain,
split and trim results. Public checks also change the later revision's audio gain,
remove and undo video independently, replay across a changed AAC default, refuse
occupied destinations and unsupported settings, and cancel a held completed
encode before explicit retry. No visual preparation or encoder capability request
is observed. Export leaves the project document, revision head and original source
bytes unchanged.

The native consumer decodes audio status/list receipts and labels the existing
export menu truthfully; its WAV save default and existing video/package defaults
are verified headlessly. This slice introduces no audio picker or GUI workflow.
Catalog format 22 records the widened export-kind constraint; prior catalog
formats remain refused under the existing fresh-library policy.

The delegated prepared-audio, full/range delivery and project export checks passed
in their pinned scope. Root's affected suite and isolated retries retain two
unchanged five-second failures; see the merged checkpoint rather than transferring
the earlier verdict to those runs. The controlled public fixtures establish
primitive correctness and container behavior; they do not repeat accepted human auditions or establish speech quality
for every input. Full PCM still inherits the WAV file-size and cache-capacity
limits. No latency or memory SLA is inferred from functional runs on this host.
