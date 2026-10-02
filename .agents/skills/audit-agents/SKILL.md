---
name: audit-agents
description: Audit AGENTS.md for durable principles and fast iteration. Use when writing or revising contributor guidance, removing stale instructions, or investigating guidance that creates unnecessary tests, process overhead or implementation coupling.
---

# Audit Agent Guidance

Judge instructions as principles that could serve a thousand future contributors
through a hundred years of implementation changes. Audit by default; edit only
when the user requests corrections. The report is the deliverable.

## Workflow

1. Read the requested guidance and any parent guidance that governs it. Read
   only enough product context to establish its purpose and explicit boundaries.
   When the user supplies a reference as the starting point, adapt its useful
   structure and principles; do not substitute an unrelated template or copy
   its implementation mechanics. Honor requested section order and verbatim
   passages. Do not run builds, application tests or broad repository audits
   to judge a document.
2. Account for every directive: **keep**, **rephrase**, **move** or **delete**.
   Keep durable decision rules. Rephrase a useful lesson tied to today's
   mechanics. Move needed operational information to its current owner. Delete
   repetition, stale instructions and rules without a concrete consequence.
   Group repeated findings; do not reproduce the whole file as a line ledger.
3. Apply the criteria below. Distinguish a lasting principle from a particular
   tool, owner, bug or technique that happens to implement it. A specific rule
   can be durable when it expresses the product's fundamental boundary.
4. Verify findings against the current file, not a previous draft or memory.
   Cite an exact passage for each finding. Before reporting an omission, quote
   the closest existing rule and explain what it fails to establish; never
   request a principle already stated. Report the highest-impact findings first,
   with their consequences and recommended actions, then a short overall verdict. When a rewrite is requested, write the corrected guidance, then
   reread it as a newcomer with no session history. Finish with the result and
   any unresolved choices. Do not manufacture findings to fill a quota.

## Criteria

- **Iteration speed is the core principle.** Optimize time to trustworthy
  feedback, not process volume. Start with the narrowest meaningful check of
  the changed behavior. Expand for changed shared contracts or a named risk;
  required release checks belong at justified checkpoints, not every iteration.
  Each expensive run must answer a question cheaper evidence cannot answer.
  Flag missing iteration-speed and proportionate-testing rules explicitly;
  generic advice about blockers or reuse does not substitute for them.
  Reuse valid results; rerun when relevant changes invalidate them. Blanket
  test-first rules, repeated full suites and unrelated tests for documentation
  or presentation changes need scrutiny. Do not weaken a real acceptance
  requirement to make the loop faster.
- **Ownership stays clear.** Prefer one authoritative owner, simple general
  rules and demonstrated needs. Flag duplicated policy, speculative machinery
  and instructions that preserve obsolete paths or demand particular internals.
- **Intent and evidence survive.** Preserve originals, provenance, accepted
  behavior and explicit product boundaries. Reused material needs a known origin
  and permission for its use; references do not grant authority to alter or ship
  them. Separate evidence or detection from authority to act. Keep conclusions reproducible and changes reversible where
  practical, without multiplying redundant copies or inventing new permissions.
- **Work and resource cost stay bounded.** Parallelism must not multiply large
  data or allow different changes to overwrite shared mutable outputs. Retire
  obsolete work resources after protecting needed work. Long tasks need progress
  and a stopping condition; do useful independent work instead of endless waits
  or retries.
- **User communication comes first.** Start the guidance with how to talk to
  the user. Lead with contracts and consequences, introducing technical concepts
  before using them. Resolve routine questions from evidence, reuse information
  already supplied, and ask only when human input changes a consequential
  decision. Do not start with a preamble about how to author AGENTS.md; that
  instruction belongs in this audit, not the document being audited.
- **Claims stay honest.** Distinguish verification, assumptions and unfinished
  work. A narrow pass cannot prove a broader claim. Missing evidence stays
  unknown; failures cannot become passes through relaxed requirements.
- **The document outlives the implementation.** Flag commands, flags, paths,
  dependency choices, file/function rosters, temporary status, active plans,
  tuned constants and one-bug workarounds. Put their lasting lesson here and
  their mechanics with the owning code, runbook, skill or plan. Links are not
  a loophole for turning principles into an implementation index. Preserve an
  explicit user requirement for principles only. Prefer a short decision rule
  over generic advice, session history or an ever-growing checklist.
