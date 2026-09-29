# 24e — Keep execution recipes inside the job owner

Dependencies: [24d](24d-edit-receipts.md).

Status: actual large-job public get/retry/cancel and restart verified.
[Evidence](../assets/24e-job-status/README.md).

Public job status identifies its frozen recipe with `inputSha256`. The queue and
executor retain the complete input; clients receive current attempt, target, state,
failure diagnostics and published result through the existing response owner.
Internal diagnostic tests may inspect the recipe, but that is not a public escape
hatch or an alternate execution schema.

This checkpoint proves delivery only. [24h](24h-job-inspection.md) separately owns
recipe-independent inspection and compact identity indexes. General scale and
retained history growth remain open. The [two-hour learned preparation](24f-successful-learned-scale.md) and complete
independent PCM gate now pass at unchanged recipes and limits.
