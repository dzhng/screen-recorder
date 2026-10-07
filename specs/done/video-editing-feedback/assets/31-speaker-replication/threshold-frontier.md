# Global threshold frontier

This receipt tests one narrowly scoped hypothesis against the retained
`four-speaker600` native score tensor: changing the global score threshold might
recover the missing simultaneous speech without violating the fixed DER gate.
The probe is decoder-only. It performs no model loading, inference, acquisition,
or label fitting.

The sweep applies each threshold from `0.01` through `0.50` in `0.01` steps to
each slot independently, then recomputes the existing scoring function and
overlap-recall calculation. The retained tensor and compressed observation are
identified by the hashes in `threshold-frontier.json`.

The Pareto result is decisive for this hypothesis:

- At the best threshold whose DER is at most `0.20` (`0.28`), overlap recall is
  `0.3242152466367678`.
- At the best threshold whose overlap recall is at least `0.80` (`0.08`), DER is
  `0.3269563711911385`.

No threshold in the frozen sweep satisfies both gates. The four-speaker
continuity gate remains red, and this evidence does not promote a model,
runtime, threshold or long-form support envelope. Hysteresis and alternate
providers remain separate hypotheses with their own admission receipts.
