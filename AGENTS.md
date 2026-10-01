# Project instructions

## Product boundary — zero editorial decisions

This project is a local recording, inspection and media-editing toolkit for
external agents. It makes **zero editorial decisions**. Read the
[product boundary](README.md#product-boundary) before planning implementation.

The product exposes evidence and executes explicitly requested operations.
The external agent using the project chooses what to keep/remove, whether
repetition is intentional, wording, pacing, layouts, references and treatments.
Detection/classification supplies evidence or candidates, never permission to
edit. Do not add automatic cuts, fades, denoising, room tone, replacement speech
or other treatments based on an engine's taste or semantic judgment.

When developing the toolkit, test primitive correctness and evidence quality
with explicit fixture inputs and expected operations. Do not turn development
into an editorial project on the user's recording. Do not require the user to
decide which personal utterances should be removed to unblock implementation.
Human checks must have a bounded technical purpose; editorial work requires a
separate user request. Missing technical evidence stays unverified. An unanswered
editorial question is neither a project prerequisite nor approval to edit.

Use the repository-local skills in [.agents/skills](.agents/skills) for implementation,
review and verification. Read the relevant SKILL.md before applying it. The Claude
skill links point to those same copies.

The active editing plan and implementation handoff are in
[specs/agent-editing/README.md](specs/agent-editing/README.md).
[specs/recording-for-ai/README.md](specs/recording-for-ai/README.md) retains recording
release evidence and acceptance. Keep both current as implementation progresses.
If a spec or handoff assigns editorial judgment to the product or makes a
personal keep/remove choice a development prerequisite, correct that drift
before proceeding; do not use it as authority to expand the product.
