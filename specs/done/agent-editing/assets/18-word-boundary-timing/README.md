# Frozen word timing evidence

These figures compare the original context with the current frozen room-tone word
candidate on calibrated, matched axes. They describe splice timing and preserved
samples; they do not label phonemes or judge pronunciation, identity, intelligibility,
click audibility or naturalness. No audio was generated, changed or played.

[Measurements](measurements.json) authenticate both WAVs against retained evidence
and derive boundaries from the existing room-tone assembly metadata. The original
context begins at source 71.5 s. Its extraction already accounts for the 48675 µs source
origin; subtracting that origin again would mislabel the plots. Titles show local
context/output frames and seconds, plus the corresponding original source clock.
The declared cut times round down by 0.2 sample (8⅓ µs) on the 24 kHz grid; displayed
source times follow those actual sample positions, not a fitted signal alignment.

The [entrance overview](entrance.png) and [detail](entrance-detail.png) align at the
start of the entrance crossfade, 5 ms before the original cut. The original and current
prefix is sample-exact through 63928 frames. The [exit overview](exit.png) and
[detail](exit-detail.png) align the original retained-context boundary with the
current exit crossfade. After its 5 ms transition, the complete 43352-frame suffix
is sample-exact. The current output adds 1680 frames (70ms); the different exit
output clocks are therefore intentional. These are edit-coordinate comparisons,
not claims that different words should have matching waveforms.

Within each figure, rows share time and amplitude limits. Detail figures deliberately
use a tighter amplitude scale and state both their scale and the overview scale.
Spectra share the same Hann 512/hop 64 one-sided power-density recipe and −110..−35 dB
full-scale²/Hz display used by the frozen phrase evidence. Black denotes the display
floor, not silence. White margins have no complete centered spectral window.
A 21⅓ ms window mixes neighboring samples and cannot resolve the 5 ms fade precisely;
near-boundary spectral differences can extend into an otherwise exact waveform
region. The waveform detail owns that fine timing view.

Green solid and dashed markers identify 0 ms and 5 ms on both rows; only the current
row shades its actual crossfade. The original row marks corresponding source
positions without claiming an original fade. [Magnified crops](crop-manifest.json)
are data-only review supplements; their full figures own axes and clocks.

The [plot script](plot.py) uses the existing phrase calibration recipe without
running or modifying the frozen phrase script or figures. It verifies source
hashes, exact context, matching row limits/ticks/widths, and title/axis-label bounds
before saving. It runs with already cached NumPy 2.3.5, SciPy 1.18.1 and
Matplotlib 3.10.8; no installation or product dependency was added.

The [initial](initial-visual-review.json) and [second](second-visual-review.json)
image-only reviews prompted cleaner, consistently framed supplemental crops.
The [final unprimed review](final-visual-review.json) inspected all four full figures
and all four final crops and found no blocking visual defect. The narrow fade
remains intentionally narrow in the overview; the detail figures show it clearly.
No listening or whole-slice acceptance follows from this visual checkpoint.
