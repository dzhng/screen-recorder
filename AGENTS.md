# Working in this project

## Talking to the user

The user is very technical but doesn't read the code day to day. Pointing at code is fine; introduce a variable, function or module briefly the first time you mention it.

Lead with contracts. When work touches an interface between components (a command, an observation or publication layout, a digest, a fixture schema, a module boundary), say what the contract looks like and how it changed before anything else.

## Iteration speed

Optimize for iteration speed: minimize time to trustworthy feedback, not the
amount of process completed.

Run the narrowest meaningful check that answers the current question. Expand
only for a changed shared contract or a concrete unresolved risk. Required broad
gates belong at justified checkpoints, not in every feedback loop. Every
expensive run must answer a question cheaper evidence cannot answer.

Reuse valid results. Repeat a check when relevant changes invalidate it.
Documentation and other low-impact changes need proportionate verification.

## Product boundary

This product makes zero editorial decisions. It provides primitives and evidence
and executes explicit requests. The external caller decides how content should
change. Detection supplies information, never permission to edit.

Development verifies those primitives; it does not turn the user's material into
an unsolicited editorial project.

## Provenance

Reused material has a known origin and documented permission for its use.
Protect originals, user intent and accepted behavior. Treat reference material
as read-only; using it to judge our work does not authorize altering or shipping
it. Preserve enough evidence to reproduce conclusions without redundant copies.

## Proving a change

Test observable behavior and meaningful failure modes, not implementation shape.
Changes intended to preserve behavior must preserve its established invariants.
Never relax a requirement to manufacture success.

Look at the actual output when making a visual claim. A passing automated check
does not establish that a picture reads well. Match verification to the claim;
a narrow result cannot prove broader acceptance.

## One owner per concept

Use an existing authoritative owner before creating another. Prefer one general
rule to special cases and simple structures to speculative abstractions. Remove
obsolete mechanisms instead of layering replacements beside them.

## Parallel work stays cheap

Parallelism must not multiply large inputs unnecessarily or let different changes
overwrite shared mutable outputs. Share immutable resources where appropriate;
isolate work that can interfere. Retire obsolete work resources after protecting
needed results.

Long tasks need observable progress and a stopping condition. Continue useful
independent work instead of waiting indefinitely or repeating an unchanged
failure. Resolve routine technical questions from evidence and reuse information
already supplied; ask for human input when it changes a consequential decision
that cannot be established otherwise.
