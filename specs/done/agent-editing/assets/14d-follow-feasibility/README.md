# Fractional-rate conversion feasibility

The existing AVAudioConverter can express explicit pitch-follow using a fractional
output rate, while the prepared samples are played on the compiler's 48 kHz project
clock. The [scratch probe](probe.swift), [raw observations](report.json), and
[platform](platform.txt) preserve the measured experiment. The probe intentionally
uses complete arrays for analysis; it is not a production memory design. Its fixed
scratch output path identifies this historical run; adjust that path when repeating.

At 0.9×, 600,000 source frames produce 666,666 frames using 53,333.333… Hz, versus
666,662 with the rounded integer rate. Thus rounding the converter parameter to an
integer is not a valid representation of authored playback speed.

Natural end-of-stream counts do not own the project clock. For 60,474 frames at
1.25×, the converter naturally emits 48,380 frames while the compiler may owe
48,379. Preparation must consume the exact absolute-boundary count, discard excess,
and permit a shortage only under explicitly derived boundary-quantization allowance.
Keep authored ratio/debt arithmetic rational; convert only the format parameter to
Double. These observations do not prove exact rational internal phase.

Changing conversion block partition changes some Float32 values by a few units
of precision; repeated equal partitions match. Prepare the whole retained run with
fixed bounded blocks and read subranges from its result. Identity bit preservation
in the raw converter does not strengthen the composition graph's existing signed-zero
mixing behavior. Mono/stereo channels remain unchanged until the existing explicit
output map.

The report's `leading`/`trailing` primeInfo values were unreliable in this probe and
must not be interpreted as measured latency. Small and converted-rate cases do not
establish universal rate support, long-run drift or perceptual quality. No public
capability or new algorithm was selected from this feasibility result;14d owns
production verification.

[Frequency observations](frequency.json) use steady synthetic tones, excluding the
first/last200 frames. For each channel, positive zero crossings are interpolated
linearly between adjacent samples; frequency is crossing intervals divided by
elapsed samples on the48kHz playback clock. Expected channel frequencies are
(997 +412×channel) multiplied by speed. This is a feasibility diagnostic, not a
replacement for the established pitch-quality evaluator.

API priming and callback behavior was checked against the local AVAudioConverter.h
header in the Xcode macOS SDK. The Swift probe used the CommandLineTools SDK; the
header is API documentation, not a claim about which SDK compiled the experiment.
