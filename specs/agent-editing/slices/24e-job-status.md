# 24e — Keep execution recipes inside the job owner

Dependencies: [24d](24d-edit-receipts.md).

Status: actual large-job public get/retry/cancel and restart verified.
[Evidence](../assets/24e-job-status/README.md).

Public job status identifies its frozen recipe with `inputSha256`. The queue and
executor retain the complete input; clients receive current attempt, target, state,
failure diagnostics and published result through the existing response owner.
Internal diagnostic tests may inspect the recipe, but that is not a public escape
hatch or an alternate execution schema.

This fixes delivery of large job status. It does not bound the queue's internal
full-input reads or identity queries independently of plan size. General scale
inspection and retained storage growth remain open. Next: the complete two-hour
learned preparation and independent PCM gate at unchanged recipes and limits.
