# 09c — Audio-only export

Status: planned; audio-only `export.create` is not implemented or verified.
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

This harness is planned, not an existing executable or evidence of readiness.
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
