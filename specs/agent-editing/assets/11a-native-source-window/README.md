# Native selected-source WAV windows

The selected-source path uses the same PCM producer, decoder and float-WAVE sink as retained recording audio. Its output clock is the composition clock: absolute floor sample boundaries, with nearest native source start and ceil source end. A narrower window seeks within the full effective support run, so moving a query boundary does not reset its phase. Existing concatenated `spans` retain their original clock, ramps and conversion recipe.

Source support is explicit acquisition support intersected with occupied container segments. The new window entry point preserves a supported integral native rate and conventional mono/stereo layout; explicit discrete stereo, wider layouts and fractional rates refuse. Missing channel layout uses the platform's conventional mono/stereo description. No role, synthetic composition, hidden attenuation, normalization or resampling is introduced.

`media.sourceAudio` accepts one source selection, requested range and output. The result states original requested range, absolute sample bounds, actual frames/rate/channels/layout and source-time unavailable intervals. `decodedFrames` counts native PCM frames fetched from AVAssetReader sample buffers, not codec-internal compressed I/O.

The shared WAV writer refuses float payloads exceeding UInt32.max minus 4096 bytes before opening output staging. This conservative RIFF capacity leaves room for platform headers; large-format audio beyond it is not implemented. This limit belongs in the later scale/format acceptance rather than silently wrapping or truncating output.

Verification uses the production producer and wire operation with generated independent channel values. The fixture creates two-stream MOVs with a nonzero origin and physical empty edit, then selects narrower capture support. Full/range PCM matches at fractional endpoints for 44.1 and 48 kHz; excluded-source poison does not change retained output. Selected-stream mono/stereo identity, unchanged original bytes, unsupported rate/layout refusal, pre-publication cancellation cleanup and RIFF capacity refusal are asserted.

A late 20ms read at 59 seconds in a 60-second source fetches 8192 native PCM frames and equals the full source's PCM slice. The gate permits at most one second of input PCM, detecting support-prefix replay. A separate native worker memory measurement exercises full 60-second WAV output; it is a point measurement, not full slice-24 scale acceptance.

Routing the new entry point through the old relative spans clock falsifies the independent sample/channel oracle. Restoring the source-window path passes. Recording `media.audio` multi-span output is byte-identical to the frozen pre-change native worker at both native rates. Existing native audio/speech wire tests and composition mixing preservation run unchanged. Actual speech inference and subjective listening are not claimed.

Fixture development uncovered a transient AVURLAsset lifetime failure and incomplete single-call AVAudioFile fixture reads. The fixture retains its asset through composition insertion and reads output WAVE chunks independently; source media extends past the selected interval. Asserted selection boundaries were retained. No decoder behavior or comparison tolerance changed to accommodate those fixture failures.

Independent Codex review found no actionable regression. Its attempted native execution was restricted by its environment and failed to start an audio reader; native pass claims come from the unsandboxed isolated-worktree checks recorded here, not that review.
