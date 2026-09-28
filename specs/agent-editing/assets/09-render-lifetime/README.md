# Shared render attempt lifetime

The [service render owner](../../../../apps/service/src/render.ts) separates media
execution from its existing locked workspace lifetime. Recording rendering remains
its real consumer; compiled project rendering can supply its own action without
reinterpreting edits as recording spans. Each action must await its native calls.
The same owner rejects late results, waits for closed workers, protects staging
with the inherited directory lock and cleans it after consumption or failure.

The existing lifecycle suite passes all 13 checks [before](before.txt) and
[after](after.txt), including abort during staging, late publication, consumer
failure, busy workspace, changed directory and consumer-owned effects. Service
typecheck passes. Independent read-only Codex review found no actionable
regressions; root executed the tests. No schemas, queues, dependencies or public
operations are added. Native media semantics stay in the render action; public
project preview remains the next integration pass.
