No findings in the scoped correction.

The recursive `treat`/`finish` flow now retains the best admissible candidate, keeps its artifact open through downstream consumption, and records the complete attempt list with the correct `selectedAttempt` (audio-processing.ts:328-499). Core validation cross-checks the selected measurement and mode-specific offsets (audio-inspection.ts:934-944; audio-measurement.ts:42-59). Matching regression tests cover stalled correction and interior-candidate regression.

The narrow core test could not start because Vitest was blocked by an `EPERM` while creating its temporary SSR directory; no native media or full-suite runs were performed.
