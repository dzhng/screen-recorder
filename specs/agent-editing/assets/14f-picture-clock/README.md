# Exact picture sampling correction

A public frame.get query at999999us selects project frame29. At30fps its exact
execution instant is2900000/3us. The old compiler sends966666us, which belongs to
physical frame28. [The actual image](red-frame28.png), [native exchange](red-native-exchange.json)
and [root replay](root-red-replay.json) retain that failure; the unchanged worker
identity is in [verification](red-verification.json).

This is a clock-contract defect, not decoder nonconformance: the old contract
explicitly requested the floored instant, and native faithfully selected its
containing interval. [Measured source timestamps and exact membership](clock-membership.json)
show the consequence over the120-picture source: floored requests select only80
unique pictures, while exact project instants select all120 in order. This latter
record is interval arithmetic over physical metadata, not a claimed120-frame native
render. The small [fixture archive](red-fixture.zip) preserves the original media
with a hash manifest; request paths are historical and should be rebound after
extracting to a fresh directory.

The correction keeps integer frame-cell labels for queries and encoded intervals,
while all content decisions use one exact compiler-owned instant. Source mapping,
clip/processor membership, pointer dependencies and physical selection must agree.
No epsilon, nearest-picture rule, or quantization of physical PTS is introduced.
[14f](../../slices/14f-exact-picture-sampling.md) owns the implementation and gates.

A second early harness expectation atquery1750000us was wrong: frame52 samples at
1733333⅓us, which maps to source1586666⅔us under the authored retime. Physical frame47
is correct there. Comparing to the query instant rather than the selected frame
instant had incorrectly expected48. This oracle correction is separate from the
real29→28 failure and is not counted as a production fix.

The [native prerequisite](native/verification.json) now selects all30 matching-CFR
pictures, exact rational boundaries, large-denominator queries and pointer support.
The existing native frame/movie/pointer suites also pass. Its [frame29](native/frame29.png)
retains the corrected direct native result. [Core verification](core/verification.json)
records the integrated default-timeout gates and discriminating clock mutations.
[Complete public acceptance](../14e-public-retiming/root-review.md) now verifies
compiler-to-movie delivery and final visual review. The archives retain raw results.
