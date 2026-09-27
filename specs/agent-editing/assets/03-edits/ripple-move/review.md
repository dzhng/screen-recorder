# Ripple move verification

A move closes the union of its old occupied intervals and inserts its whole
selection envelope at the final destination. Both shifts compose before checking
synchronization or overlap. Destination splitting uses the inverse boundary in
the original timeline, including fractional boundaries; the normal public model
validator remains unchanged.

[59 composition tests](tests.txt), type checking and build pass. The retained
[public-surface probe](probe.mjs), run after building composition, checks 650
integer and 250 fractional moves with 9,071 source-position comparisons and
caller immutability. [Results](probe.jsonl) record both grids.

The initial track-only move dropped its synchronization group; [red evidence](track-red.txt)
and its regression now distinguish spatial changes from timing changes. Independent
Codex review reproduced a temporary-overlap rejection; its [red case](overlap-red.txt)
and the related [temporary synchronization case](sync-red.txt) now pass, while
paired invalid final states still reject. The final independent review found no
remaining defects and additionally checked 900 bounded source-mapping cases.
Afterward, the identical insertion-boundary partition code was consolidated into
one owner and the suite, type checking, build and both retained grids passed again.

This proves pure reducer behavior. Public revision storage, rendering and the
full linked-replacement checkpoint remain separate unfinished work.
