# Bounded spectral reduction

The [spectral reducer](../../../../packages/core/src/audio-spectrum.ts) consumes
validated PCM through the same retained reader as waveform analysis. It owns an
isolated radix-two transform, not a decoder or a mixer. Matrix-cell admission
bounds both output memory and positioned sample reads before any file access.
No new dependency or native operation is introduced.

Each global time cell carries its displayed sample range, analysis center, full
FFT window and available PCM support. A narrowed query over the same published
PCM retains identical overlapping columns. A clipped PCM file instead supplies
zeros outside its support and marks the affected windows partial. The eventual
public operation must request bounded surrounding PCM context when it promises
full/excerpt parity at query edges. Acquisition unavailability remains separate
provenance; zero samples alone never prove silence.

The estimator returns one-sided linear power spectral density in full-scale²/Hz,
not amplitude. It divides squared transform magnitude by sample rate and summed
squared window weights, doubles interior positive-frequency bins, and leaves DC
and Nyquist undoubled. This follows the [density scaling convention](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.periodogram.html).
The default [Hann window is periodic](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.windows.hann.html),
with rectangular windowing also available. There is no mean subtraction,
detrending, channel mixing or logarithmic display floor. Raster presentation can
apply a labeled decibel floor later without discarding raw analysis energy.

[Tests](native-tests.txt) compare every bin against independent direct DFT across
multiple times and channels, check tone/DC/Nyquist energy, locate a known impulse,
and preserve exact global-cell query alignment. They also reduce real native
project-tap PCM under cache leases. The sparse large-file check reads only its late
window; it is an I/O proof, not another native large-file extraction. The same
frozen native worker identity is retained by the earlier waveform-core evidence.

[Normalization](normalization-mutation.txt) and [clock](clock-mutation.txt)
mutations fail their respective oracles. Public spectral delivery, acoustic PNGs,
visual critique and agent usability remain unverified by this mechanism pass.
No listening claim is made.
