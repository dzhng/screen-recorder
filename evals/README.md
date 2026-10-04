# Agent evaluations

This harness evaluates the consumer skill through fresh Claude Code and Codex CLI
sessions inside Docker. Case inputs go to runners; acceptance bars go only to a
separate judge. Each run gets its own disposable home and workspace. The live
checkout, recording library and Docker socket are never exposed to an agent.

The native macOS app cannot execute in Linux. A verified release's JavaScript CLI
supplies real schemas and transport behavior; scripted Unix-socket peers supply
explicit readiness and failed-job evidence. Passing a portable trial does not
certify native capture or media quality.

Run `node evals/run.mjs --help` for options, then `node evals/run.mjs` for the
default repeated trials. The [root manifest](../package.json) also exposes
`eval:agents` and the fast, model-free `eval:test` checks. Docker must already be
running. The harness builds its pinned CLI image and resolves a checksum-verified
GitHub release once; a supplied standalone CLI bundle can test another build.

The [case inputs and bars](cases.json) own the suite. Extend that data for another
skill task, selecting an explicit fixture only when its observable evidence is
needed. Runners never receive bars or other cases. README entry trials retain the
repository's linked consumer folder without preinstalling the skill; direct skill
trials use the selected agent's discovery directory. The judge receives the input,
bar, response, observed command executions and actual CLI/service call receipts. Failed reads, failed jobs and
incomplete exchanges stay distinct; an infrastructure error stops the suite and
never counts as a pass. Repeats are fresh sessions, not retries of a conversation.

Model trials use existing Codex and Claude sign-ins, or the provider environment
variables named in runner help. On macOS, Claude's existing OAuth access token can
be read from its Keychain entry. No sign-in is repaired or changed. Only the
credentials needed by that CLI enter its container; they are never image layers,
source files or saved evidence. Known credentials are redacted from captured
output before writing reports. Model calls use the account's billing or limits.

Docker owns runner isolation: unprivileged user, read-only root, dropped
capabilities, temporary home/workspace, no host mounts and a per-run deadline.
Codex runner commands use the container boundary because nested bubblewrap
namespaces are unavailable under Docker's default restrictions. Model containers
have network access; fixture controls and release extraction have none. The
separate judge has no consumer skill and does not execute the user task.

Generated reports/transcripts live in ignored `results/`; cached verified CLI
bytes live in ignored `.cache/`. Reports bind the release, CLI bytes and image to
the recorded source and retain failed artifacts. Each output directory is new;
the harness refuses to overwrite previous evidence. Containers and scratch homes
are removed even after a timeout. Stochastic pass rates describe these trials,
not all recording/editing workflows or native media quality.
