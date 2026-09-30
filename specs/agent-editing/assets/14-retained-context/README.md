# Retained context for a split slowed passage

The existing compiler keeps the same complete source and project-sample run after
splitting the corrected 0.8× selection, including for a short query into the second
piece. Removing an interior range instead creates two separate contexts. This
supports reusing the existing audio-context owner for stretch preparation, rather
than introducing persistent clip lineage or restarting DSP at every pure split.

[The report](report.json) retains actual compiler outputs and assertions; the
[source identities](identities.json) pin the owners. [The scratch probe](probe.ts)
uses the pure composition API, without catalog changes or native execution. Its
fixed checkout/output paths identify the historical run; copy and adjust scratch
paths when reproducing, without replacing retained evidence.

The exact rational project endpoint produces75,592 output frames, matching the
corrected candidate. Public retime authoring uses integer microseconds and still
needs its own end-to-end mapping proof. This does not prove native prepared reads,
split audio equality, stereo/scale behavior, or listening acceptance. Those remain
slice14 work after the13a gate. No worker was built or changed.
