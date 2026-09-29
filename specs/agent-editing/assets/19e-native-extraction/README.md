# Native reference extraction boundary

The existing source-audio path preserves every PCM byte from the complete frozen
mono24kHz Float32 reference but writes a different WAV header. Copy/import of the
complete original preserves the full WAV. The composition path instead emits its
fixed48kHz stereo output; original narration extraction remains48kHz mono. Both
existing native operations reject requested sampleRate/channels fields.

Thus arbitrary canonical reference conversion is new19e work, not an already
supported native knob. Reuse existing source selection and resampling ownership
while adding an explicit conversion boundary. The frozen reference parity path
uses unchanged imported bytes. This experiment makes no inference or listening
claim and does not compare native conversion against ffmpeg when no such native
conversion operation yet exists.

The [verified archive](evidence.tar.xz) retains the actual script, requests,
receipts, complete outputs and source/worker hashes. Its [manifest](manifest.json)
checks every member. All original hashes remained unchanged.
