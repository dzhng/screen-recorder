# 10 — Occurrence-aware inspection

Status: not started. Dependencies: [04](./04-projects.md), [05](./05-compiler.md), [09](./09-first-preview.md).

## Contract

Agents can inspect source evidence and every project occurrence without losing words/events when media is repeated, reordered or retimed.

## Seam and ownership

Asset-scoped source processing/readers feed one composition projection owner. Project transcript/search/events/cursor/index queries carry clip identity, revision and all relevant generation pins; project frame requests use the shared render compiler.

## Work and review surface

Refactor source acquisition metadata away from one-recording presentation assumptions without rewriting raw evidence. Add explicit source/project scopes to the shared inspection schemas. Page in the stable ordering in contracts.md, including simultaneous tracks and repeated sources. Preserve acquisition gaps, partial words and traceable source IDs.

Create this planned probe in this slice:

```sh
node packages/test-harness/editing/evidence.mjs --fixture repeated-speech
```

## Acceptance

No lost/duplicated pagination rows over repeated and reordered takes, tied timestamps, empty pages with continuation and changing generations. Search distinguishes source text from assembled playback text. An overlapping-speech fixture cannot form a phrase from words on different tracks; test contiguous cross-clip phrases, explicit gaps and partial-word interruption. Return all occurrences with distinct clip IDs; retimed words use the compiler's mapping. Single-source preservation cases keep their meaning. Rendered frame delivery stays owned by slice 09; this slice supplies projected evidence and its context.

Keep the relevant [preservation gates](../verification.md#preservation-matrix) green. The [contracts](../contracts.md) and [single-owner rules](../architecture.md) are binding. Record evidence and remaining limitations in this Status line and the [README handoff](../README.md) before ending the pass.

## Failure boundary and discretion

Do not graft a clipId field onto a source-ordered cursor. If generation pinning or projection requires a full-project expansion, split the index/projection seam before acceptance.

Delegated: Index representation and bounded page storage. Ordering, pins, partial-word semantics and source versus project distinction are fixed.

User feedback changing the named contract or judged variable requires updating this slice and its dependent contracts before expanding implementation. Reversible presentation feedback does not block independent work.
