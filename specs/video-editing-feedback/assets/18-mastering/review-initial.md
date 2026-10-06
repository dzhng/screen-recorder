The bounded correction loop can discard a candidate that already satisfies the requested normalization contract, then fail after a worse correction attempt. Type checks passed; the focused test could not run because the sandbox denied Vitest temporary-directory creation.

Review comment:

- [P2] Preserve an already admissible normalization candidate — /Users/server/dev/yap-video-editing/apps/service/src/audio-processing.ts:419-430
  When a first candidate is within the existing ±0.2 LU admission gate but outside the 0.1 LU interior aim, this branch discards it and retries. If the correction overshoots or raises true peak/range beyond the gate, the later `admitNormalization` throws even though an earlier candidate was publishable, causing a feasible request to fail without output. Retain the best admitted candidate and fall back to it when later candidates fail.
