# Demanded project picture lifecycle

The project frame owner pins a revision, one-microsecond query window, processing
tap and delivery bound. Its compiler-selected picture retains the global sample
time, which can precede that query. Native sampling evidence remains separate
from the compiled declaration.

Three core tests use real catalog/project/job/cache owners and a controlled
renderer. They cover historical revision pinning, cache regeneration, invalid
picture receipt refusal, cancellation and retry. They do not decode actual PNGs.
Removing the frame-identity comparison makes its negative-control test fail.

The focused core suite passed 16 tests with one optional native case skipped.
That native project-audio case was then run with the frozen worker and passed
all six tests, including its 15 nested-tap comparisons. Core types and build
passed. Independent review found no actionable defect and reran the three
picture tests and core types.

Native compiled stills, source stills, service/CLI delivery, retained indexes and
visual conformance remain unfinished. No public frame capability is claimed here.
