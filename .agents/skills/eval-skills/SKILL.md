---
name: eval-skills
description: Eval and improve a skill against golden cases — run the target skill blind in a fresh, context-free subagent on each example input, grade the artifact against the expected outcome, and let the gaps drive the edits. Use when the user wants to test/eval/improve/harden a skill, says "this skill keeps producing X / keeps missing Y", or hands a skill plus example input→expected-output pairs. Pairs with [write-skills](../write-skills/SKILL.md) (the authoring principles every fix obeys).
---

# Eval Skills

Treat a skill like a function under test. Feed it example inputs in a clean
room, check the artifacts against what good looks like, and let the failures
drive the edits. The eval is only honest if the run is **blind**: the agent
executing the skill must carry none of this conversation's context and must
never see the expected output. Leak either and you are teaching to the test.

## Inputs you need — refuse without them

Confirm all three before spawning anything. If any is missing or
unresolvable, stop and tell the user *exactly which one* and what a good
version looks like. Do not invent cases, guess intent, or eval against a
fuzzy wish.

- **Target skill** — must resolve to a real `SKILL.md`. If you can't find it,
  list the skills you can see and ask which one they mean.
- **At least one golden case** — a concrete input the skill will actually
  receive: a screenshot, a prompt, a file, a scene. "Improve write-spec"
  with no input attached is not a case.
- **The bar per case** — the outcome a good artifact achieves and the smells
  that would make it bad, *not* an exhaustive parts list. The skill's
  **judgment** is what's under test, so do not pre-enumerate every
  requirement — that turns the eval into a conformance check and stops testing
  whether the skill decides well. "Sliced so each piece is independently
  buildable and verifiable, at the granularity a competent practitioner would
  pick — a lazy mega-slice and pointless over-splitting are both failures" is
  a bar a judge can hold the work to; "slices it well" is too thin to grade
  and a fixed list of expected slices is too prescriptive. State the bar and
  the smells; let the judge apply them. The exception is a **conformance-style**
  skill that genuinely wants an exact task hit exactly — then the explicit
  criteria *are* the bar; match the bar's shape to the skill's nature, and if
  you can't tell which it is, ask. If the user gives only a fuzzy wish with no
  bar, draw the bar out of them and echo it back before spending agents.

## Workflow

1. **Validate inputs and surface first principles.** Resolve the skill and
   read its **first principles** — what it's for and the standard it holds
   itself to; this is what the judge grades against, so if the skill doesn't
   make them clear, clarify with the user rather than inventing them. Settle
   the eval mode here too: judgment (a bar the judge applies) vs conformance
   (an exact task hit exactly) — ask the user if it's ambiguous. Then sharpen
   each case's bar — the outcome plus the smells, kept at the altitude the
   user cares about, never widened into a prescribed parts list unless the
   skill is conformance-style. Done when you can state the skill's first
   principles in a sentence and every case has a concrete input and a bar a
   competent judge could hold an artifact to.

2. **Blind run, one fresh agent per case.** Isolate every run so a misbehaving
   skill can't touch the live checkout and each case starts clean. Prefer
   capturing the artifact from the runner's final message — if the skill's
   output is a plan or text, ask for it inline and nothing hits disk to leak.
   When the skill must write files, give the runner a throwaway sandbox dir as
   its only writable root, not a worktree of the live repo (worktree isolation
   guards git state, not absolute-path or escaped writes). After every run,
   sweep the live checkout (`git status`) and clean anything the run leaked —
   isolation is best-effort, the sweep is the guarantee. Give the runner
   **only** the input and the instruction to use the target skill — never the
   bar, the smells, the other cases, or why you're asking. Done when you hold
   one artifact per case, each from a context-free run, and the checkout is
   clean.

3. **Grade with a separate judge that applies judgment.** Hand a fresh judge
   the artifact, the bar, and the skill's **first principles** — so it grades
   against the skill's own intent, not its personal taste — but never the
   expected output and never "make this pass." Grounded in those principles
   the judge is a competent practitioner: it decides whether the work clears
   the bar with *defensible* choices, and is explicitly free to fault both
   too-coarse and too-fine work. It must cite specific evidence for each
   verdict — a quote or pointer, not a number. Done when every part of the bar
   has a verdict grounded in the artifact.

4. **Account for nondeterminism.** Agents flicker. A single green is not
   proof. For any case that matters or any verdict that looks borderline,
   re-run the blind run 2–3× and report the pass *rate*. A skill that passes
   1 of 3 is not fixed.

5. **Diagnose each failure as skill-defect vs bad-case.** A miss means either
   the skill failed to drive the behavior (fixable here) **or** the bar was
   wrong — it asked for something the skill should not do, can't express, or
   it punished a defensible judgment call the skill was right to make (tell
   the user; do not edit the skill to chase a wrong bar — that just encodes
   the wrong reality). Name the defect against the `write-skills` failure
   modes:
   premature completion, vague completion criterion, missing rule, no leading
   word, duplication, sediment, war story, no-op.

6. **Revise via write-skills.** Fix the named defect — and obey those
   authoring rules while you do it: sharpen the completion criterion before
   adding bulk, prefer one leading word over more sentences, add no no-ops.
   The failure is the spec for the edit; change only what the failure points
   at.

7. **Re-eval all cases, not just the failed one.** A fix can regress a case
   that was passing. Loop until every case clears its rate bar, or until you
   can show the skill structurally can't express a case — then report that
   instead of forcing it.

## Output

A short report: per case, pass rate and the cited gap; the defect each
failure mapped to; the edits you made (or, if the user asked to approve
first, the diff you propose); and the re-eval result. Make the before/after
movement legible — this is the evidence the skill actually improved.

## Rules

- **Blind is non-negotiable.** The runner sees input only. The judge sees
  artifact + bar + the skill's first principles. The moment either sees the
  expected output, the eval is worthless.
- **Test judgment, not conformance.** The bar is a standard the work must
  clear, never a checklist of the answer. If you find yourself listing the
  exact pieces you expect, you've stopped evaluating the skill.
- **Isolation is best-effort; the sweep is the guarantee.** Always check the
  live checkout after a run and clean leaks, no matter how the run was
  sandboxed.
- One fresh agent per case per run — no shared context, so no cross-case
  learning inflates a later case.
- Grade against the bar, not against the other artifacts, and not on a
  numeric score that hides which part of the bar failed.
- Don't bend the skill to pass a case you can't defend. A failing case that
  exposes a bad bar is a finding, not a bug.
