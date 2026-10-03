# Fractional native clock diagnosis

A single sparse-impulse LPCM CAF establishes a concrete public late-window phase
failure at 44100.5 Hz, while full-render pulse spacing preserves declared time.
No production edits or policy changes were made. All original media, requests,
responses, inspection programs and delivered WAVs remain beside this file.

The authored mono source has 396904 frames, with 0.75 impulses at frames88201
and352804. At the declared rate88201/2, those positions are exactly2s and8s.
The independent prediction was recorded before rendering. An8.5s project is
long enough: interpreting the second impulse at44101 would move it4.35364
48kHz frames earlier, so a hours-long drift run is unnecessary.

Public import retains44100.5 metadata. Full project audio delivers408000 stereo
frames, with peaks96001 and384001: spacing288000 matches the exact6s separation.
Thus simple rate relabeling is not the full-render mechanism. A bounded public
range[7800011,8200037) delivers19201frames at absolute sample bounds[374400,393601),
but its peak is384005, four output frames later than full. Entire range PCM differs
from its full slice, with maximum absolute difference0.6638753097504377. These are
measurements, not a newly accepted tolerance or a listening verdict.

`SourceTrack.open` rounds the first ASBD sample rate to44101. `AudioSourceReader`
actually requests44101 from AVAssetReaderTrackOutput, and sample-buffer ASBDs
confirm44101. `ConvertedAudioInterval` then constructs44101->48000 conversion.
The first conversion is real; it is not simply a mislabeled unchanged array.

The independent reader-only inspection isolates the seek boundary. Full decoding
places the8s impulse at8.000022675222784s. The product late-window context begins
at7s and its reader seeks two native packet frames earlier,308705/44101.
The matching reader-only seek starts atPTS6.9999546495544323s and places the
impulse at8.000113376113921s, exactly four decoded44101Hz frames later than the
full reader. This mismatch therefore exists before the second converter. The
internal AVFoundation algorithm is unknown; the demonstrated boundary is its
fractional-native to requested-integral conversion under seeking. Do not infer
an offset correction from one probe.

The reader-only seek's2s peak entry is an unobserved zero placeholder because
2s precedes the requested range; it is not a silent2s event or an additional
measurement. `diagnosis.json` only compares the observed8s entry. Asset endUs
also differs from the mathematical authored-frame duration, retained as a
separate observation rather than blamed for the phase failure.

Smallest proposed disposition: reject a nonintegral actual ASBD rate in the
common SourceTrack opener before rounding; retain asset admission and existing
discrete-two-channel index mapping. Reuse the existing raw rate-validation owner,
but do not turn on all strict-window checks for composition. This explicitly
narrows executable readiness, so it requires a clear contract disposition before
implementation. Alternatively, supporting fractional rates requires a truthful
native clock and phase-stable bounded seeking/conversion design with independent
source-time proof; that is broader than a validation correction. No such decision
or implementation is included here.
