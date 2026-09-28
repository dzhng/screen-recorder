# 10 — Occurrence-aware inspection

Status: accepted within occurrence-inspection scope. 10a–10d and the current named repeated-speech probe pass; [completion evidence](../assets/10d-joint-preservation/completion.md) reconciles the umbrella. Acoustic and speech-quality acceptance remain separate. Dependencies: [10a](./10a-source-range-projection.md), [10b](./10b-source-acquisition.md), [10c](./10c-occurrence-queries.md), [10d](./10d-frame-inspection.md).

## Contract

Agents can inspect source evidence and every project occurrence without losing words/events when media is repeated, reordered or retimed.

## Seam and ownership

Asset-scoped source processing/readers feed one composition projection owner. Project transcript/search/events/cursor/index queries carry clip identity, revision and all relevant generation pins; project frame requests use the shared render compiler.

## Work and review surface

Keep raw source evidence immutable and identify processed target/tap and processing dependencies on project artifacts. Parent processing is excluded from a child tap explicitly, never by an undocumented read path.

Refactor source acquisition metadata away from one-recording presentation assumptions without rewriting raw evidence. Add explicit source/project scopes to the shared inspection schemas. Page in the stable ordering in contracts.md, including simultaneous tracks and repeated sources. Preserve acquisition gaps, partial words and traceable source IDs.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/evidence.mjs --fixture repeated-speech
```

## Acceptance

No lost/duplicated pagination rows over repeated and reordered takes, tied timestamps, empty pages with continuation and changing generations. Search distinguishes source text from assembled playback text. An overlapping-speech fixture cannot form a phrase from words on different tracks; test contiguous cross-clip phrases, explicit gaps and partial-word interruption. Return all occurrences with distinct clip IDs; retimed words use the compiler's mapping. Single-source preservation cases keep their meaning. Project frame delivery uses the compiler/executors and shared artifact lifecycle established in slice 09. This slice owns its public frame requests alongside projected evidence and context; verify delivered frame membership/timing against the same project preview. Full audio and acoustic artifacts belong to slice 11.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Failure boundary and discretion

Do not graft a clipId field onto a source-ordered cursor. If generation pinning or projection requires a full-project expansion, split the index/projection seam before acceptance.

Delegated: Index representation and bounded page storage. Ordering, pins, partial-word semantics and source versus project distinction are fixed.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.
