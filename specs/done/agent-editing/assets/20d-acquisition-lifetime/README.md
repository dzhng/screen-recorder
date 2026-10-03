# Acquisition recovery lifetime

A stopped service does not imply its native children have stopped. Source verification writes into acquisition staging, and metadata probes can still be reading its admitted files. Startup recovery used to purge those directories and pending package reservations without checking the surviving native work.

The acquisition owner now holds a shared lease on its existing root directory throughout import and portable verification, and lends that open descriptor to native work. Whole-owner recovery requires an exclusive nonblocking lease before changing files, evidence, asset references or pending rows. This deliberately delays unrelated acquisition cleanup too: startup returns actionable `ACQUISITION_BUSY` until the orphan exits. It adds no lockfile registry, polling loop or second cleanup owner. The admitted directory's inode is checked; canonicalized parent aliases remain supported without following a replacement leaf.

Package adoption also lends its existing workspace lifetime alongside the acquisition lease. A worker needs both: one protects immutable package input, the other protects verification staging. Normal completion, failure and cancellation close the caller's lease after its native operation drains.

## Verification

The focused test stops actual native source verification and metadata probing at the existing syscall barrier, kills the owner process and opens the same catalog in a fresh owner. Recovery refuses while preserving the exact rows and journal. After the orphan exits, recovery finishes and removes the pending portable reservation. A mutation removing exclusive recovery admission demonstrates the original failure: cleanup completes while the child is stopped, removing its journal and reservation.

[verification.json](verification.json) retains red/green receipts and logs. The ordinary acquisition regression and public canonical project relocation/adoption remain green. These checks establish lifetime and cleanup behavior, not an expanded media deadline. Source verification's separate large-work budget remains the next checkpoint.

[Combined-root verification](root-verification.json) repeats the actual orphan, core and public project gates with the integrated worker.
