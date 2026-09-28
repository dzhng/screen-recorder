# Review outcome

Shape: still decode/orientation remains in the existing ImageIO owner; geometry,
alpha and layer mixing remain in the existing picture executor. The pass adds no
parallel render, queue, index, delivery or deletion owner. Image retention and
budget accounting use unique active bindings.

Diff: independent review found pre-decode aggregate admission and repeated-image
overcounting defects. Both have red/green native regressions and were repaired.
The final independent review found no actionable regressions; its 58 focused
checks/type checks complement the separately retained full core suite and actual
native public journeys. Self-review also removed an unused harness import and
corrected the image-only dependency assertion to inspect the real `scenes` field;
the final public journey passed with that strengthened assertion.

Docs: contracts and the product skill distinguish image identity from video
sample time; the current handoff retains combined service recipe binding as open;
fresh image skill use passes with documented recoverable CLI syntax errors. Changed documentation links resolve. Choices
are recorded in the spec ledger, including provisional scale limits. No broad
photo/color/listening/scale acceptance is inferred.
