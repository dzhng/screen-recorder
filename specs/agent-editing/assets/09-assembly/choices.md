# Assembly choices for integration

- One shared compiler request binds both planes. The frame JSONL reader and video
  renderer remain their existing owners; the audio source stays a finite stream.
  WAV export and AAC muxing choose sinks without reconstructing timing or roles.
- PCM block positions are relative to the requested window for muxing. Context
  origins and unavailable-range receipts retain absolute project sample clocks.
- A window with positive video time but zero compiler audio samples emits no audio
  track. It must contain no audio records. This preserves the one-microsecond case
  without inventing a PCM sample.
- Exact MP4 movie/header and track edit-list duration is the temporal authority.
  FFprobe rounds AAC reporting to discrete samples; the independent parser and
  report preserve both truths. Dropping a compiler-selected sample to make that
  rounded field equal the microsecond movie duration would violate sample ownership.

The existing bounded audio schedule/metadata admission limits remain provisional
scale work. The baseline recording two-cuts decoder red was independent at this checkpoint;
the [later endpoint correction](../09-audio-endpoint/README.md) resolves it without
relabeling missing decode as accepted silence.
