# Learned denoise channel relations

Independent frozen RNNoise processing preserves identical and polarity-inverted
channel relations exactly on this five-second mono-derived input. A channel at
half the input level differs slightly from half the processed full-level channel:
aggregate relative balance changes by −0.02655 dB, with maximum absolute sample
error 0.00051149 and RMS error 0.00005833. This is measured nonlinearity, not an
audible failure verdict or approval of independent stereo processing.

The [predeclared plan](plan.json) holds the original matched-noise mixture,
processor, delay compensation and output gain fixed. [Report](report.json) records
all three relations, counts, clipping and exact hashes. Each output has 240,000
finite samples and no clipping. The existing full-level output is the baseline;
the identity relation reproduces it exactly. A confirmation after adding explicit
baseline identity assertions reproduces all case values and hashes.

These correlated channels are a controlled mechanism check, not a real stereo
recording or a channel policy. Different speech/noise in each channel, perceived
stereo position, combined sources and post-retime material remain open. Do not
silently downmix or claim transparent stereo from this result. A linked-channel
alternative would change the processor recipe and requires separate evidence.

Raw float inputs, delayed outputs and compensated outputs remain compressed
without normalization. [Frozen script](run.py) records the exact local scratch
invocation. This adds no production dependency, model, option or channel default.

Independent review recomputed retained audio/report identities and found no
actionable defect. The integrated stretch reports were checked in the same review.
