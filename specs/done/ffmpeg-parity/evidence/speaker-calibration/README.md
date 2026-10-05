# Documented speaker calibration

This research selects **no recipe or provider**. The [frozen protocol](frozen-protocol.json)
limits calibration to original development windows and documented Community1
parameters, preserving model bytes, independent labels, source clocks, overlap,
zero collar and every-case quality/cost gates. Confirmation remains untouched.

[Research map](research.json) owns exact outcomes and resource spend. Clustering
cut changes have no measured effect between the tested alternatives. The denser
window/minimum-duration bundle recovers missed speech but leaves failing speaker
confusion. Its two coupled knobs were not tested separately, so the measured effect
belongs to the recipe. A lower pooled DER cannot conceal a failed window.

[Runner source](runner.swift) accepts only explicit documented parameters. It
receives no reference speaker counts or identities. The same-default rebuilt
control produces exactly the original segment list; each calibration result
returns the requested configuration. [Private package](Package.swift) uses the
pinned, existing SDK source and separately compiled output with no optional traits,
model downloads or copied build output. Raw defaults and previous failures remain
intact in the [original cohort](../speaker-cohort/README.md).

The [controller](run.py) validates prepared source/model/recipe identities before
serial network-denied inference, records complete raw results and commands, and
reserves confirmation for a recipe passing every development case. The
[scorer](score.mjs) binds exact integer sample support and logged window dimensions
to the audited padding rule. [Replay](replay.mjs) verifies retained evidence without
model execution. A future invocation needs fresh output; this historical run is
not permission for unbounded parameter searches.

The upstream published recipe scores use a collar and ignore overlap. They do
not satisfy our gate. Host caches and out-of-process CoreML/ANE memory limit cold
startup/RSS claims. Passing bounded quality would still leave known-person
recognition, unknown confidence, provider lineage and product integration unproved.
