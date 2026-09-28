# Public waveform JSON

The [audio-tap journey](../../../../packages/test-harness/editing/audio-taps.mjs)
retains every existing WAV assertion and adds actual waveform delivery. Known
stereo samples provide an independent min/max/RMS oracle for raw source audio
and dry/after-step/processed clip, track, nested groups and output. Every bucket
uses the global sample grid; fractional query edges remain explicit partial
buckets. CLI JSON and MCP text agree byte for byte.

The passing report also covers automatic full-source overview, excessive detail
refusal, historical revisions after head edits/restart, and explicit waveform
retry after its real native audio dependency is canceled. The original source
hash stays unchanged. Existing audio cancellation, deletion and history checks
remain in the same default harness. The first public run refused waveform.get
before the service route existed; no implementation substitute passed that gate.

Focused adapter/service/audio checks and workspace types pass. The adapter's
first JSON-delivery test fails before transport support is added; it now preserves
bytes, bounds buffered JSON and releases leases on refusal. Independent review
found no actionable defect; its socket tests were sandbox-limited, separately
from these actual unrestricted service journeys. Runtime hashes and delivered
JSON are retained here.

This checkpoint accepts JSON measurements only. Waveform images, spectrograms,
acoustic image axes, a fresh agent locating a labeled interval and listening
acceptance remain open in slice 11. Missing capture support is not evidence of
silence, and no waveform operation edits the project.
