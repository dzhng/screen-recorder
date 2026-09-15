# Editing UI

Status: future-work placeholder. The initial release provides complete editing
capabilities through MCP and CLI; the menu-bar recording controls remain in the
initial release. See the [main implementation spec](../recording-for-ai/README.md).

## Next Agent Prompt

When the user activates this work, inspect the shipped CLI editing contract and
the completed recording spec. Plan a thin UI over the existing CLI, then replace
this placeholder with independently reviewable UI slices. Resolve interaction
design with concrete examples before implementation. Update this handoff as the
plan develops.

## Outcome

A human can inspect a recording and perform the same non-destructive edits that
an AI can perform through the CLI and MCP. The UI invokes existing CLI capabilities;
it does not own another editing engine, storage model, or timeline interpretation.

## Inherited contracts

- Preserve original media; trimming and middle cuts form a non-destructive edit list.
- Support undo and stable revision IDs.
- Base edits on the revision inspected. Reject stale edits without changing state;
  return the current revision so the UI can refresh rather than silently reapply.
- Keep video, audio, transcript, images, cursor data, and pause markers aligned
  using the existing shared timeline mapping.
- Show artifact readiness and processing failures for the relevant revision.
- Expose exactly two exports: video only and the complete processed package.
- Any missing editing capability must first be implemented in the shared core and
  exposed through CLI and MCP. It must not be implemented only in UI code.

## Open before implementation

Timeline layout, range selection, transcript-based selection, keyboard interaction,
preview behavior, and CLI invocation/progress delivery. These are future design
questions, not approved implementation choices.

## Proposed acceptance evidence

Perform a trim, middle cut, undo, and both exports through the UI and through the
CLI on the same fixture. They must use the same editing contracts and produce
equivalent results. Exercise a stale revision and a processing failure visibly.
