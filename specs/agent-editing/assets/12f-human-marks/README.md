# Independently captured workbench range

Status: actual human word edges are reconciled; scoped 12f is achieved. Parent 12
and 12b remain open for broader labels, inventory/intent and recipe acceptance.

The user confirmed both waveform selections with Next on the
[original-context page](../12f-workbench-marking/README.md), then explicitly
reported “captured”. [The raw record](human-marks.json) is retained byte-for-byte.
[Root verification](root-verification.json) checks original/source/packet hashes,
rebuilds the export through the existing annotation owner, and binds the range to
the original clock without adding the acquisition origin twice.

“Workbench” spans clip seconds 4.363–5.120, corresponding to source time
4,411,675–5,168,675µs. The old visual endpoint falls 475 ms after the newly marked
audible end. The unchanged baseline's end is 480 ms late; the frozen alignment and
verbatim end proposals are 80 ms and 60 ms early. These comparisons resolve this
word's independent reference; they do not select an engine. All historical marks,
proposals and scores remain unchanged.

The [human-edge baseline diagnostic](baseline-human-diagnostic.json) uses the
existing scorer on eight actual audible edges for four named words. Its median
is 100 ms and interpolated p95 is 371.5 ms, so the unchanged baseline still fails
the 100/250 ms timing targets on this scoped subset. Its different label set does
not establish improvement over the old partial baseline. The known opening “um”
has no matching baseline end proposal; its clip-edge onset remains censored and
sentence endpoints do not supply individual word edges. Full filler precision
and recall remain unscored without complete inventory and held-out coverage.

[Independent review](independent-review.md) confirms identity, clock and numerical
comparison. No new candidate cut, join audition, model, production change or
physical-capture pass follows. The [manifest](manifest.json) pins the actual
record, measured results and their source owners.
