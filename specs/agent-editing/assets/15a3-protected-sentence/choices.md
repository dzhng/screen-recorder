# Protected-sentence packet choices

## Sound — high confidence

**When:** protected-sentence audition packet, 2026-09-30.

**The choice:** Align presentation endpoints to the recording file's sample grid.
For this sentence, the source clock includes the recording's 48,675-microsecond
origin. Starting exactly at 72 seconds therefore lands between two audio samples
after subtracting that origin. Public source extraction rounds down while the
project's sample selection starts at the next sample, producing a one-sample shift.
The packet instead starts 8,675 microseconds later and moves the ending by the same
amount. Both routes then select the exact same samples for the same 2.7-second
sentence, while retaining the ASR-proposed beginning and ending with margins.

**The gap:** The requested complete sentence did not prescribe exact presentation
endpoints or which discrete sample should represent a fractional boundary.

**The reach:** This fixes only the listening packet's selection. It neither changes
production rounding nor supplies independent word boundaries. Future annotations
must retain the actual origin and the appropriate clock instead of copying these
presentation margins as word labels.

**Verdict:** Sound. Exact matched input makes the denoise comparison easier to
assess without silently shifting one reference. No added gain or waveform edit is
needed. The original remains available for the user to assess the proposed crop.

**Confidence:** High.
