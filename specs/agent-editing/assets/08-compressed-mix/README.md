# AAC and MP3 composition

A mono AAC clip and stereo MP3 clip now overlap through the actual composition
mixer. Separately selected native source decoding supplies the reference PCM;
every mixed output sample equals its float32 sum with mono duplicated into both
channels. The tested fractional preview equals the full mix's sample slice
exactly. The complete mixer probe passes eighteen checks.

This reference isolates mixing and clock agreement from lossy encoding changes.
It is not an independent proof of decoder fidelity or speech quality. Both test
sources are 48 kHz and cover the first second of two-second encoded media; physical
segment changes, full encoded endpoints and other rates remain separate gates.
No generalized exact-AAC seek claim supersedes the existing AAC-specific bound.

A scratch control removes the MP3 clip and fails at sample 0, proving the result
requires both inputs. Independent review found no actionable defect; its native
reader failed in an unchanged test before this case. Root supplied the actual
passing execution. Reports, failure and frozen worker/runner identities are kept
here; no production processing, normalization or tolerance changed.
