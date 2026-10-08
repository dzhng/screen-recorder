# First-class recording feedback evidence

## Next Agent Prompt

Implement the agreed feedback-review API. Status: protocol, transcript convenience, project cursor path and adapter docs implemented; source cursor rendering and full integration verification remain. Update this handoff after each committed pass. Existing consumer-skill changes must be reconciled with shipped schemas.

## Contracts

The user wants agents to understand recordings without discovering model management or creating an editing project. `transcript.review` automatically acquires Yap's registered pinned speech model and prepares transcription; `transcript.get` remains offline and read-only. `cursor.render` and `cursor.render.retry` deliver up to eight requested frames with an explicit 0–10 second trail, using ephemeral composition and existing pointer evidence. Source media and project revisions remain unchanged. Raw cursor, ordinary frame, advanced inference and editing APIs retain their meanings.

Use existing source asset/stream/acquisition and pinned project/revision selectors, exact timing and transcript pagination. Review continuations read their pinned evidence without new inference. Repeated review requests join/reuse work; terminal failures require explicit retry. CLI and MCP use the same service handlers and frame delivery. Model download progress and actionable failures are visible. Missing pointer metadata, capture gaps and off-crop positions are evidence, never fabricated paths.

## Work graph

- [x] [01 Protocol and transcript](slices/01-transcript.md)
- [ ] [02 Cursor rendering](slices/02-cursor.md) — project path landed; source path remains
- [x] [03 Adapters and skill](slices/03-adapters-skill.md) — schemas/docs landed; full parity gate remains
- [ ] Final full checks, whole-change review, choices consolidation and archive

## Verification

Use red/green public contract tests with native/network seams isolated. Render cursor fixtures through real CLI/MCP without changing captured source or revision, compare with existing pointer output, inspect and get unprimed screenshot critique, and show review shots. Reuse existing speech model fixtures for acquisition/inference lifecycle; do not download a second full model for a test. Run all repository checks once when implementation finishes, following README build prerequisites.

## Decisions

No additional permission is needed for registered automatic model download. Lower-level explicit lifecycle APIs remain available. No editorial decisions, source mutation, persisted convenience projects, arbitrary external models, compatibility aliases or data migrations are introduced. Internal structure is delegated; record consequential choices in choices.md.
