**The plots show useful comparisons, but do not establish artifact-free endpoints or preserved speech content.** All 13 images reviewed.

| Images | Visible findings |
|---|---|
| Four endpoint sheets: phases 0, 1, 17, 137 | **High confidence:** full-output panels compress the endpoint activity into narrow slivers; the ±100 ms panels are essential. Some responses extend beyond those zoom windows. Blue and orange traces overlap substantially, obscuring differences. Log amplitude omits zero and sign, so blank regions cannot establish zero-valued samples or waveform continuity. |
| Tone sheet | **High confidence:** the dominant spectral peaks remain visually near the 440 Hz guide, with similar heights on shared scales. Non-1× outputs show additional spectral peaks. The 0.9× and 1.25× waveforms have visible terminal amplitude excursions; 0.8× reaches the right plot edge, leaving little endpoint context. These are visible excursions, **not demonstrated clipping**. |
| Whole-utterance join sheet | **High confidence:** all traces are nearly flat at the displayed ±0.5 scale, making small boundary differences effectively invisible. Each boundary has data on only one side; this does not visually demonstrate a join between two populated audio regions. |
| Phrase 0 | Its comparatively broad amplitude range compresses boundary detail, especially at the trailing join. No obvious large spike or flat-topped clipping is visible. |
| Phrases 3, 6, 9, 12, 18, 21 | Both sides of each join are shown, with visibly altered waveforms inside the selection at non-1× rates. No obvious gross gap, large isolated boundary spike, or flat-topped clipping is apparent at this resolution. The vertical boundary lines can conceal a small discontinuity exactly at zero. |

**Presentation limits and potentially misleading readings**

- Shared amplitude scales support comparisons **within each speech sheet**, but differ between sheets. Apparent waveform size cannot be compared directly across phrases.
- Endpoint “exact support” bounds are reported under a **1e−7 threshold**. They should not be read as proof of mathematically exact nonzero support. File-boundary termination also prevents these plots from showing what might exist beyond the admitted output.
- The orange “tail” is explicitly a separate diagnostic recipe. Its substantial trailing response—including at 1×—cannot be attributed to omitted blue-output content from these pictures alone.
- Endpoint sheets have small, dense labels, though readable when enlarged. The speech-sheet subtitle repeats the whole-utterance timing caveat on individual phrase sheets, making its scope unnecessarily ambiguous.
- No clear hard clipping is demonstrated anywhere. Dense tone waveforms and peak-envelope plots are insufficient to exclude it conclusively.

**What the pictures establish:** visible duration changes, approximate tone-peak stability, additional spectral components, phase-dependent endpoint responses, and broad waveform behavior around the displayed joins.

**What they cannot establish:** sample-level continuity, complete support beyond file boundaries, absence of low-level artifacts, precise pitch error, listening quality, word preservation, or correctness of the underlying measurements.