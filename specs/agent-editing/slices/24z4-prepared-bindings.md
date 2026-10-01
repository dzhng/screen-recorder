# 24z4 — Prepared window resource bindings

Status: repeated path resolution is removed at the existing window binding owner.
The [evidence packet](../assets/24z4-prepared-bindings/README.md) retains the
consumer proof, unchanged large-recipe check, source pins and limits.

## Occurrences and bindings have different identities

A recipe describes every authored clip occurrence. A renderer resource binding
describes the file and stream needed to execute those occurrences. Repeating a
clip must retain its complete recipe entry while resolving its existing
asset/stream binding once per window. Two streams of the same asset remain two
bindings.

[Project window construction](../../../packages/core/src/project-window.ts)
uses its existing binding map before asking the asset catalog for a path. The
map belongs to each window construction, so later execution resolves current
catalog paths independently of earlier admission. No persistent cache, resource
identity type, reference behavior or public interface is added.

## Consumer proof and acceptance

The [prepared consumer regression](../../../packages/core/src/prepared-audio.test.ts)
uses five clip occurrences, two assets and three asset/stream bindings. Real
catalog reads establish bounded path resolution; complete queued and published
manifests plus exact renderer bindings establish preserved clip and stream
values. Moving one scratch file and updating its catalog filename before opening
the existing execution barrier proves that execution retains fresh path authority.

The original 4,001-clip, greater-than-2-MiB recipe check was run once after the
material fix and passed with its original five-second deadline and unchanged
test body. This single result does not identify the cause of earlier timeouts or
establish general latency. The separate service diagnostics fixture and its
segment hydration owner remain outside this pass. Root owns shared handoff and
integration.

[Root integration](../assets/24z4-prepared-bindings/merged-verification.json)
adds the full prepared suite and actual public full-sample WAV/lifecycle proof.
