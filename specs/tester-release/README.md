# Small tester release

Status: future-work placeholder. The first release targets David's own Mac.

## Next Agent Prompt

When the user activates this work, inspect the personal release and its completed
unknowns map first. Turn this placeholder into a researched, sliced implementation
spec before building. Update this handoff with the resulting decisions.

## Outcome

A small group can install the app and independently complete the recording to AI
inspection workflow on their Macs. This tests whether the personal workflow
transfers to other users before a public release.

## Scope to investigate

- Installation and signing/distribution appropriate for invited testers.
- Screen and microphone permission setup and recovery.
- Local transcription model download, readiness, and failure recovery.
- CLI and MCP setup for the selected AI clients.
- Supported hardware/macOS versions and an end-to-end compatibility check.
- Feedback and opt-in diagnostic collection without collecting recordings by default.

## Inherited product boundaries

Keep recordings local, transcribe locally, and retain data until manually deleted.
Offer exactly two exports: video only for humans, and a complete processed package
for AI containing source media, transcript, selected screenshots, index, and timed
cursor data. A tester release does not imply hosted storage or remote MCP access.

## Open before implementation

Tester group, supported clients/platform versions, distribution method, support
workflow, update delivery, and any compatibility or data migration requirements.
These are candidates for planning, not approved implementation decisions.

## Proposed acceptance evidence

A tester installs on a fresh supported Mac, grants permissions, prepares the local
model, records a narrated demonstration, asks their AI for the latest recording,
retrieves additional frames, and exports both supported formats without developer
intervention.
