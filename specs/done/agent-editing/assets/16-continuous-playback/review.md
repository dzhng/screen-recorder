# Review and decision handoff

Root independently reviewed the bounded probe. The review found that completion
and operating-system stall notifications alone could admit a pause followed by
resumption. Explicit startup and forward-progress bounds now reject that case;
the paused control exercises the failure. Root also required preserving the child
process error when no report exists; the runner rethrows that original error.
Final root review found no blocking issue. The configured Codex CLI model was
rejected by the account, so its attempted review supplied no verdict.

The shape pass keeps the independent player/decode comparison in one standalone
Swift probe and compilation/evidence persistence in one small Node runner. No
product dependency, hook, API, schema, or native build change is introduced. The
docs pass distinguishes delivery from perception and leaves parent status/link
updates to the integrating agent.

Choices for the parent ledger, all sound with high confidence:

- **Observe offscreen delivery.** When a movie is ready, the probe asks a muted
  player to run and acquires the frames due at the current host-clock time.
  Offline decoding alone could finish without the player ever advancing. This
  choice supplies actual timed output evidence while leaving physical display,
  human smoothness and sound outside the verdict. The task fixed the offscreen
  scope but left the concrete evidence boundary to the implementation.
- **Compare a small spatial grid at every exact timestamp.** For each player
  buffer, compare 256 interior pixels with the offline frame bearing that same
  presentation timestamp. Copying every image into retained memory would make
  the probe more expensive during playback. The grid keeps polling cheap and
  rejects the deliberately wrong-frame control, but does not prove every pixel
  equal. The task requested landmarks without prescribing their sampling density.
- **Bound progress using frame cadence and scheduler allowance.** After the first
  frame, stop if output fails to advance beyond the largest decoded frame interval
  (including the final tail) plus 250ms. Permit three seconds for first output.
  A paused player now fails even when the operating system reports no stall.
  These are explicit probe liveness tolerances, not product quality thresholds;
  future slower environments must explain any change rather than silently
  widening a passing verdict. The task required bounded work but left allowances
  unspecified.
