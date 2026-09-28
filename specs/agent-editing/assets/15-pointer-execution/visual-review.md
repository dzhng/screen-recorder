# Fresh final visual review

An unprimed reviewer inspected all 23 original PNGs retained in [images](./images)
and enlarged cursor/trail crops. It found no detached or duplicate cursor, stray
trail, clipping outside the source surface, or visible placement discrepancy.

It observed substantially dimmer cursor/trail in `after-opacity.png` than in
`before-opacity.png`. This is the authored ordered-opacity behavior and agrees
with the independent pixel assertion. It observed softer, slightly mottled magenta
trails and softer cursor outlines in all six decoded movie samples relative to
matched single-frame PNGs. That supports the retained open color/codec diagnostic;
it is not dismissed as a visual pass. It also saw minor brightness steps between
trail segments in both the new path and the frozen legacy PNG, so this pass does
not claim a smoother trail algorithm.

`disabled.png` is uniformly gray. `inactive.png` displays black in the viewer;
independent decoded RGBA confirms every channel is zero (transparent), rather than
an invented black source. Three samples per movie cannot prove temporal smoothness
or behavior at unsampled instants.

The final held-frame reuse fix changed no PNG bytes across this complete capture
set: [parity evidence](./render-reuse-parity.json). The fresh critique therefore
applies to the final raster outputs as well as the inspected set.
