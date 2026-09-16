# Before-event selected frames

The selector requests one microsecond before a transition to preserve its earlier
side. Nearest-frame decoding could nevertheless choose the first frame after that
transition, producing two images of the new state. The generated navigation and
rapid-scene cases exposed seventeen such before-side failures.

Shared materialization now accepts an exclusive source-time selection ceiling.
Index production derives that ceiling from before-event reasons. Both native image
selection and annotation analysis use it, while revision membership stays unchanged
in `kept`; `selectionEndUs` explains the additional restriction in delivered metadata.
Invalid ceilings and native receipts beyond the ceiling are rejected. The frame
policy identity changes so new index requests do not reuse the earlier rendering.

## Verification

The focused regression first selected 500 instead of 400 for request 499 with ceiling 500;
it now selects 400 and rejects a decoder ignoring the ceiling. All 208 core tests,
workspace build/types and independent Codex review pass. Review found no actionable
regression. Eight bundled public trail tests pass; their eight delivered PNGs are
byte-identical to the prior artifacts after requested-time cache integration.

The generated quality run now has only the separate stillness-collapse failure.
Every before/after transition matches its independent actual-time side: navigation's
first pair is 2.75s/3s, then 5.75s/6s. The [pixel manifest](pixel-manifest.json) records
seventeen changed selected PNGs, exactly the before-side images; the other 46 remain
byte-identical. [Previous](previous.png) and [current](current.png) show one such pair.

A fresh reviewer inspected all 13 current contact sheets and both gesture crops.
It found no reversed transition, cross-cut trail, blank capture or missing A/B state;
pointing remained recognizable. It also reported dense rapid transitions, clicks
visible mainly through event captions, weak periodic-motion context and dark fixture
text. These limitations remain in the generated review; this pass fixes earlier-side
selection, not every index-quality concern.

Pointing, transitions and stillness were opened together in one verified Preview
window for non-blocking review, then closed after proceeding without a written
response. No human approval is inferred from that viewing window.
