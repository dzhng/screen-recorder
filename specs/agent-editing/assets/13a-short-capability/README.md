# Short stretch capability research

Protocol 1, unchanged acceptance: requested sample count, available tone estimate
below 1% error, selected-source isolation, complete endpoint evidence and independent
protected-word/listening acceptance. The [measured Signalsmith capability](../13a-endpoint-verification/README.md)
is the fixed parent. Exact admission and quality are separate. Equal-count identity
is allowed even at one sample; a nonidentity request uses the actual selected/output
counts and upstream seek requirement. Explicit unsupported refusal does not declare
the requested short-edit usability solved, and no global minimum or silent window
switch is accepted.

One alternative hypothesis: Rubber Band 4 offline R3, using its own two-pass study /
process completion, can provide exact selected-only output for a 100 ms short input
without the Signalsmith default seek requirement. First task is the same frozen
100 ms 120 Hz tone at 0.8×. Freeze source revision and options, return every output sample
(no wrapper cropping/padding), require exact count and unchanged pitch gate. If it
fails, inspect that failure before any wider cohort; if it passes, expand to the
existing rates, one shorter measurable case, and real speech. 10 ms 120 Hz remains an
unavailable pitch probe, not a quality pass for any engine.

Candidate: official Rubber Band v4.0.0 tag at
`1d95888bec3ae0a17c0c4af791810d5a63f6bc35`, R3 finer engine, offline, mono 48k,
pitch 1, no threading, standard window. Pin requested time ratio to integer M/N.
The compiled source is scratch-only; no production linking, system installation,
vendor import or licensing decision. Each process has a 60 s timeout and bounded
selected/output lengths. Source-only refinement to short window is a separate
one-factor trial if the first result warrants it, not an automatic fallback.

Primary sources: [integration](https://www.breakfastquay.com/rubberband/integration.html),
[API](https://www.breakfastquay.com/rubberband/code-doc/classRubberBand_1_1RubberBandStretcher.html),
[pinned source and license](https://github.com/breakfastquay/rubberband/tree/v4.0.0).
Offline mode owns delay handling internally; real-time truncation advice does not
license wrapper truncation for this experiment. Distribution under non-GPL terms
requires a commercial license according to the publisher; adoption remains open.

## Progressive findings

The initial R3 standard-window 100 ms 120 Hz task passed exact count and pitch at all
four rates (maximum 0.047394% error). A 50 ms 440 Hz slowdown also passed, enabling the
matched short/long regression cohort. Standard R3 rendered every request but
failed the 10 ms 1 kHz 0.8× tone at 1.076005% error; this is a failed gate, not rounding
noise or a threshold change.

The predeclared one-factor short-window option reduced that failed case to
0.086884%. The fixed cohort then passed every available tone estimate; worst was
0.795174% on 10 ms 1 kHz at 1.25×. All requested counts and poisoned-context comparisons
passed. 10 ms 120 Hz estimates remain unavailable for all algorithms (including the
unit-count copy), so this is not universal short-audio quality acceptance.

The matched isolated endpoint cohort is a regression: short-window R3 moves the
largest peak by up to 199.75 frames (4.16 ms), versus the incumbent maximum
32.67 frames. The weakest candidate peak is about 0.0739 from a 0.8 input impulse.
This is a support/peak diagnostic, not proof of lost words or a new acceptance
threshold. A fresh run reproduced all 32 endpoint PCM hashes exactly. Candidate
promotion is rejected pending endpoint and speech-quality evidence; Signalsmith
remains the numerical incumbent. The short-input tone improvement alone does not
resolve the local speech-editing gate.

The compressed reports preserve standard-window failures and unavailable estimates.
`verification.json` hashes the uncompressed reports, retained raw PCM, and auditions.
Historical reports retain their original runner identities; the endpoint confirmation
uses the retained runner. The source-only standard-to-short change keeps the same
C++ source and fixed selected inputs. No production dependency was added.

The `audition/` control selects source frames 24000–28800 from the frozen local
phrase: an arbitrary 100 ms excerpt, not an independently labeled word. Reference,
standard-window 0.8× and short-window 0.8× files include the same 250 ms neighbors
on each side. Float WAV preserves PCM without gain, crossfade, padding or limiter;
only the selected interval changes duration. These controls are prepared and
UNVERIFIED by listening. They must not replace the guarded whole-phrase auditions.

Next test: independently assess endpoint and consonant preservation on selected
whole words before considering this engine for adoption. Keep the short-window
option explicit and research-only; no automatic fallback, new window sweep or
weakened pitch limit follows from this pass.

Independent review found no actionable defects and independently reproduced all
176 cohort results, including the failed and unavailable pitch controls. The
retained runner additionally reproduced all 36 short-candidate PCM hashes and the
candidate executable identity. Measurement tests passed; no listening acceptance
is implied. This pass adds research harness/evidence only, with zero production
code or installed dependencies.
