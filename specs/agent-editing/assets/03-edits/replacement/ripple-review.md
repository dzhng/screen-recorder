# Ripple replacement

An explicit ripple fit adopts the supplied source range's natural duration. It
retimes only the addressed occurrence and its retained descendants, splitting
old synchronization membership when timing changes. Later roots move on named
tracks through the same retime/ripple owner used by ordinary retiming. Unselected
video can remain fixed while audio changes, with its fixed-anchor receipt intact.

All 63 composition tests, type checking and build pass. The [initial red case](ripple-red.txt)
precedes support. Growth and shrinkage checks preserve video, shift later audio,
report fixed roots, and reject missing or incorrect track scope. Independent
Codex review found no actionable defects; focused probes additionally verified
that holds without natural duration reject and failed operations leave inputs
unchanged. Existing no-duration-change retime scope behavior is preserved.

Hold-tail and silence-padding fits and the full linked-replacement harness remain
unfinished. Pitch metadata still awaits the separate native execution gate.
