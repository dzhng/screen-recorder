# Reviewed choices

- Added one short deterministic accompaniment to the existing real-narration
  public journey. No music download, model, new service or duplicate project setup.
- Authored the triad and edge ramps into a known Float32 source, then used an
  explicit clip gain. The oracle accounts for both source sample rounding and
  mixer gain/sum rounding, without assuming a lossy codec is exact.
- Used public gain-zero and wrong-gain edits as negative controls, rather than
  corrupting the comparison buffer. Both outputs must match their separately
  known formulas, fail the desired mix, and survive undo back to intended audio.
- Preserved all nine original narration gates and their scope. The new lossless
  music result does not expand baseline encoded evidence or claim listening,
  natural joins, model processing, or whole-slice acceptance.
- Kept requests, immutable selection snapshots and delivered negative WAVs so
  another reviewer can distinguish actual public mutations from a self-contained
  arithmetic test. Full narration and source identities remain retained.
