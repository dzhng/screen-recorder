# 19e1 — Canonical conversion of finite selected PCM

Status: complete; native finite PCM conversion passes exact frame/count, channel, finite-context, isolation, lifecycle and fresh-process gates; existing source/mix/streaming/finite-reader gates remain green. [Evidence](../assets/19e1-finite-audio-conversion/README.md). Parent: [19e](19e-retained-audio-excerpts.md). Dependencies: [11](11-audio-inspection.md), [24q](24q-finite-decoder-demand.md).

## Contract and owner

Convert an already completed finite Float32 PCM selection to an explicit rate and
mono/stereo profile without admitting audio outside that selection. This native
prerequisite adds no public job or voice registry. Raw source selection remains
SourceAudio/SourceSelection; processed selection remains composition/ProcessingTap
in its existing48kHz stereo processing domain. A temporary selected WAV is the
finite boundary. Reuse the current rate converter and AudioWaveWriter rather than
adding a resampler, encoder or asynchronous bridge alongside them.

Take authoritative input frames N and rate R from validated selected PCM, not a
rounded durationUs. For requested output rate T, publish exactly floor(N*T/R)
frames with checked integer arithmetic. Refuse zero output rather than inventing
a sample. Report actual input/output format, frames and conversion identity.
Existing rate limits apply; only conventional mono/stereo layouts are admitted.

Converter phase starts at selected frame zero and survives ordinary delivery
blocks. All selected input [0,N) is permitted filter context; no sample outside it
may influence output. Published output quota is a separate bound. ConvertedAudioInterval
currently shortens input according to the owed output duration: separate those
concepts once so an odd final selected sample is not silently removed from allowed
context. Preserve existing composition and source-window caller semantics.

After channel-preserving rate conversion, mono remains unchanged; stereo-to-mono
is an explicitly declared equal-weight average. Mono-to-stereo duplicates the
sample and unchanged stereo retains both channels. No clipping, normalization,
implicit fades, trimming or room tone. Use one downmix owner with stated Float32
rounding/overflow behavior. Do not silently change ASR's frozen conditioning.

Do not use AudioPCMStream's recording spans overload as this contract: its
cumulative rounding, join ramps and unbounded interval end serve different meaning.
Do not reconstruct exact finite input support from whole-microsecond durations.
Independently converted excerpts need not equal crops of a separately converted
larger excerpt, because finite filter context differs. Repeating identical input
and profile must reproduce identical output.

Keep existing availability/provenance from the selection owner. Do not reapply a
per-clip gap mask to mixed output, which could erase another contributor or an
intentional processing tail. Filtering may spread adjacent selected samples into
already-rendered zero samples; that is distinct from admitting excluded donor
samples and must be documented in conversion provenance.

## Verification and review surface

Add a focused native PCM gate alongside existing source/audio tests. Cover exact
counts at24/44.1/48kHz, odd counts and durations not exactly representable in whole
microseconds; equal/left/right/opposite stereo channels; a last-permitted-frame
impulse; varied block partitions and fresh-process repetition. Poison excluded
source regions and acquisition gaps before selecting PCM; compare complete
converted results to establish isolation. A control that truncates allowed input
to ceil(outputFrames*R/T) must be detected by the last-frame case.

Test short/truncated inputs, cancellation, sink failure, bounded blocks and output
closure. Preserve source support/phase/late-window, composition mix, streaming and
finite decoder-demand gates. Complete already-canonical original WAVs use verified
copy/reuse in19e, preserving headers too; ordinary conversion promises declared PCM
and format, not ffmpeg-equivalent WAV bytes.

Record actual native requests, complete outputs and numerical comparisons. This
is neither listening acceptance nor public excerpt publication. No live capture,
model inference, installs or automatic playback is required.

Delegated: native operation/module names, bounded temporary-file plumbing and
internal converter API design. Finite-context, exact-count and phase semantics are
fixed above. User feedback changing sample/layout conversion policy updates this
leaf before public reference integration.
