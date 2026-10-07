Found one actionable issue:

- **P1** — [caption-timed-motion.mjs:387](/Users/server/dev/yap-caption-motion/packages/test-harness/editing/caption-timed-motion.mjs:387): the numeric movie oracle doubles the local phase for the second, unre-timed caption occurrence. At 2.0625s, the candidate evaluates at 62.5ms while the reference uses 125ms; by 2.625s, it also drops the still-active “New” highlight. This can fail the checkpoint or make its repeated-occurrence proof incorrect. The reference should use `atUs - 2000000` for that occurrence.

The remaining compiler, schema, proposal, and rendering consumers were consistent. No files were modified. Prior focused/package checks were not repeated; the native timed-motion checkpoint was not rerun.

**Final verdict: not clean; fix the P1 test oracle.**