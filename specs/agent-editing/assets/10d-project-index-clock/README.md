# Project index frame clock checkpoint

`createCompiler().frameBoundary(at)` locates the preceding picture and first
picture sampled at or after an exact edit boundary. Both descriptors use the
same timing builder as ordinary compiled frames. At 30000/1001 fps, the existing
compiler samples at 33,366 integer microseconds; a boundary at 33,366.5 therefore
selects the next picture at 66,733. Rational edit times remain unchanged.

The method returns full visibility within the existing integer render duration,
not encoded presentation timestamps. Opening/terminal neighbors are nullable;
an empty project's boundary has neither. Invalid or out-of-project boundaries
refuse instead of selecting unrelated pictures. Repeated boundaries are left to
the future candidate selector to deduplicate.

[Composition tests](tests.txt) and the composition typecheck pass. The focused
tests pin authored fractional and aligned results, terminal clipping, empty
projects, short clips between samples, and parity with movie/video-window plans.
The [negative control](mutant.txt) rounds a boundary down and fails the authored
fractional test; the correct implementation was restored before the green run.
No native worker or public product journey was run for this pure compiler seam.

This does not enable project indexes or choose sampling density, tap scope,
coverage extension, or processing-aware candidate selection. Those remain open.

Independent review found no actionable issues and reran all compiler tests
successfully. The choice ledger records the approved bounds and policy separation.
