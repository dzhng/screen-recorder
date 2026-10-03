# Standalone native audio FILE evidence

The native AAC FILE sink is verified in an isolated worker. Public `export.create`
acceptance belongs to the [audio export slice](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/09c-audio-only-export.md)
and its integrating service journey; this packet does not claim installed release
or personal speech quality.

The completed project Float32 WAV feeds the existing finite conversion owner.
The writer consumes bounded blocks and the shared timestamped PCM lowering used
by movie assembly. Output uses the ISO MPEG-4 audio-only container at an M4A path;
its edit list compensates AAC priming. Apple's M4A writer instead leaves timing
in Apple-specific metadata, so it is unsuitable for the required zero-origin file.
No video input, picture renderer, video encoder or extra mixing engine is involved.

`contentFrames` comes from the presented audio track clock. `encodedFrames` is
AVAudioFile's decoder-visible capacity and can include trailing AAC packet padding.
The authored `durationUs` remains the floor of original project PCM duration.
Finite rate conversion retains its existing floored output quota; container duration
may therefore differ from original duration by less than one target sample.
Decoded AAC samples are lossy. Endpoint and channel checks have their own error
bounds, and this verdict does not replace exact Float32 WAV parity.

The [verification record](verification.json) points to complete native requests,
replies, container/packet inspections and decoded samples. It covers the rendition
and rate-control matrix, whole-file input exceeding the inspection-byte allowance,
refusal before encoding, cancellation, existing conversion defaults and actual
movie mux preservation without playback. Functional checks establish no latency
or memory SLA under host contention.

The reference source archive plus final delta reconstruct every member in
[source-final-pins.json](source-final-pins.json). The reference belongs to the
first successful frozen worker; reviewed source corrects the mistaken equation of
AAC decoder capacity with presented content. Two reproducible failed mutants
remove positional WAV inspection or whole-file streaming admission, respectively.
Their source deltas and workers are preserved separately. The rejected packet-count
candidate and its source overlay are also retained.

Early scratch probes retain their outputs but are diagnostic: their intermediate
workers were not all frozen, and one attempted source archive raced later source
edits. That failed archive is not authoritative and is excluded. A later reader
mutant repeats the failure with a fully preserved source overlay and runtime.

[Runtime identities](runtime-pins.json), [external CODE identities](external-code-pins.json)
and [linked CODE identities](linked-code-pins.json) keep worker provenance distinct
from model readiness. Cached RNNoise generated C and FluidAudio code are included;
no inference, model preparation or device operation was performed. Evidence uses
standard tar/xz compression to keep the complete retained files below the Git
single-file size limit. The [member inventory](members.json) pins this packet.
