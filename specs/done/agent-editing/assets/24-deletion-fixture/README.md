# Bounded deletion fixture

The large-history test targets bounded, restartable retirement. Its full corpus
still comes from 1,500 real ProjectStore edits. Setup creates those edits in memory,
then SQLite backup and a disk reopen put every revision, undo row and request
receipt on ordinary durable storage before deletion begins. A further reopen after
the first partial page verifies recovery. Production catalog durability and
transaction boundaries remain unchanged.

The phase audit distinguished setup from the operation under test: disk-backed
fixture construction took 9.18–17.38 seconds while deletion took 172–444
milliseconds across 11 progressing pages. The memory-build/backup/disk-reopen
control took 2.79 seconds before initial setup. These observations reflect shared
host load, not a stable benchmark or general scale claim. SQL plans use the existing
project/undo indexes; the production coordinator yields between retirement pages.

The [original timeout](baseline-red.log.gz) remains evidence. The revised test
passes at its unchanged five-second deadline, retaining the corpus and per-page
change bound. Removing the undo page limit produces the expected
[bound failure](unbounded-red.log.gz): 1,756 changes against the original maximum
of 1,024. This confirms the setup correction did not weaken the deletion gate.

No production optimization follows from charging a test for 1,500 individual disk
commits. Broader large-project and media scale acceptance remains open.

The final focused suite passes 39 tests with the default worker count and deadlines;
core types pass. Independent review found no actionable defects and separately
passed all 10 project-store tests.

Combined-root confirmation passes49 owner/service checks at the unchanged default
deadlines, including text-aware prepared receipts and historical package semantics.
The [root suite](root-suite-green.log.gz) closes the previously reported fixture
timeout within this scope; broader scale acceptance remains separate.
