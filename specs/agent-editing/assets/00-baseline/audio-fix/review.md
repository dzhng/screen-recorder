# Audio decoder lifetime

Commit `0147c63` keeps a decoder across nearby ordered intervals, while each
selected interval gets a fresh converter and end-of-stream flush. Only selected
samples reach conversion. One pending decoded packet keeps memory bounded;
skipping over more than one second restarts decoding rather than reading an
arbitrarily long excluded interval.

Root shape/diff review and independent Codex review found no actionable regression.
The independent sandbox's runtime reader failures also reproduced on the previous
finite-range path, so they are not passing runtime evidence. Root integration
passes all six public audio tests plus the two movie cut-isolation/1001-span tests.
Original timeouts and sample assertions remain unchanged. Isolated native unit
checks and deliberate cursor-reset falsification are recorded alongside them.

The extra 300-second streaming check remains unresolved: its unchanged baseline
already exceeds its 60-second harness timeout. The changed diagnostic was
inconclusive under host contention. Slice 24 must measure and fix that scale
contract; this checkpoint does not declare it passed.
