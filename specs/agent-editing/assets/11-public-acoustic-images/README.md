# Public acoustic image journey

Run `node packages/test-harness/editing/audio-evidence.mjs --fixture tones-and-clicks` with an explicitly frozen `SCREENREC_NATIVE`. This journey uses the real service, CLI, MCP adapters, native audio decoding/mixing and image renderer. It uses scratch state and authored stereo tones/clicks. It does not play audio, capture the desktop, run speech models or launch the installed app.

The retained `report.json` and delivered artifacts come from the final passing run. CLI files and MCP media/text bytes agree. Independent sample bounds, complete global bucket coverage, edge partiality and authored min/max/RMS values prove full/ranged waveform agreement. The known right-channel click occupies the expected image position. Spectral tone pixels are checked against a separate direct Fourier calculation; tone levels intentionally stay below display saturation for every processing target and the changed revision.

Nested clip, track, inner/outer group and output stacks use distinct gains, an ignored bypassed step, and dry/after-step/processed taps. Public images are checked by their actual pixels as well as metadata. A changed project head produces new values; historical image bytes remain stable before and after restart. A barrier holds a real successful native image reply, cancellation drains that job, repeated ordinary reads preserve its canceled generation, and explicit retry recovers the same job. Render attempts and JSON sidecars are absent after cancellation, retry and restart.

The source-context case imports a synthetic capture journal around actual media, then deletes the donor. An unavailable interval just before the requested display remains outside displayed missing-support metadata but inside Fourier-window context. The public masked image marks its affected first column orange; the otherwise identical physical-source view does not. This is an acquisition import test, not physical-capture evidence.

## Red checks and review

The initial native request failed at 1,089,291 serialized bytes despite only 48,316 density cells. The production fix uses a bounded sidecar under the existing render-attempt lifetime, preserving the small command-frame limit and the original resolution. `transport-red.log` retains this failure. `range-mutation.log` proves the independent requested-range oracle rejects a response containing the entire source.

Independent reviews found weak returned-range-derived assertions, indistinguishable unity-net routing, metadata-only project images and failure-path cleanup. Those were corrected. A further review caught saturated spectral probes; quieter tones and an explicit unsaturated-oracle check now keep wrong targets and stale revisions distinguishable. Final review found no actionable defects; its own end-to-end attempt could not start the service, whereas the retained implementer run completed against the frozen production inputs.

An intermediate cancellation assertion confused job state with artifact readiness. The existing contract reports `job.get.state=canceled` and `waveform.get.state=not_requested, reason=canceled`; the final test checks both, unchanged generation across reads, and explicit retry. No production vocabulary changed to satisfy that assertion.

This complements the unchanged `audio-taps.mjs` preservation journey. It proves acoustic delivery and analytic signal interpretation, not voice naturalness, speech cleanup or listening acceptance.
