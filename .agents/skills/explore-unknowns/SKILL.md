---
name: explore-unknowns
description: Guide the user through a quadrant walk that maps the unknowns of a task — open by listing the known knowns, then work through known unknowns, unknown knowns, and unknown unknowns one stage at a time, ending with a complete four-quadrant map in the user's hands. Use when a request is ambiguous or underspecified, the codebase or domain is unfamiliar, the user will "know it when they see it", a reference implementation must be understood before porting, mid-build deviations from the plan need capturing, or a finished change needs buy-in or verified understanding before merge. Pairs with [write-spec](../write-spec/SKILL.md) — walk the quadrants to burn off fog before slicing, and feed the finished map into the spec.
---

# Explore Unknowns

The map is not the territory. The prompt, the plan, and the context window are
the map; the codebase, the domain, and the user's actual intent are the
territory. The gap between them is the unknowns — and an unknown found before
code is written costs minutes, while the same unknown found three PRs later
costs the three PRs.

This skill is a guided conversation: the **quadrant walk**. Together with the
user you fill in a four-quadrant map of the task, one quadrant per stage, and
the user walks away holding the completed map. The map is the deliverable;
implementation is a different task that starts only after the map is handed
over.

Two moves apply at every stage:

- **Reacting beats imagining.** Never ask the user to describe what they want
  when you can hand them something concrete to react to — a rendered option,
  a clickable mock, a decisions table. Reacting extracts knowledge the user
  has but cannot articulate unprompted.
- **Every artifact assembles the reply.** End each artifact with the user's
  next message pre-drafted: steal/skip chips, resonate checkboxes, a
  decisions table, a copyable sharpened prompt — so their reaction becomes
  their next message with near-zero typing.

## The Quadrant Walk

Five stages, walked in order, one at a time. **When you enter a stage, read
its reference file and follow it.** Name the current quadrant as you go — the
user should always know where they stand on the map — and finish the stage in
front of you before opening the next.

1. **[Known knowns](references/stage-1-known-knowns.md)** — scan the
   territory, then open with the settled ground.
2. **[Known unknowns](references/stage-2-known-unknowns.md)** — the questions
   you can name; resolve them one at a time.
3. **[Unknown knowns](references/stage-3-unknown-knowns.md)** — extract the
   taste and tacit context nobody has put into words.
4. **[Unknown unknowns](references/stage-4-unknown-unknowns.md)** — sweep the
   territory for landmines.
5. **[Hand over the map](references/stage-5-hand-over-the-map.md)** — the
   completed four-quadrant map, the walk's only done-condition.

When the user moves on to build, review, or merge what the walk mapped, read
[after the walk](references/after-the-walk.md) — the map lives on past
planning.

## Rules

- Walk the quadrants in order, one stage at a time, naming the current
  quadrant. The walk ends with the map in the user's hands — no map, not
  done.
- Stages order the walk; they never embargo information. A finding that
  materially bears on a decision in flight is disclosed the moment you have
  it, then filed on the map under its quadrant — never held back for its
  stage's scheduled turn.
- Nothing closes off-screen. Any question or judgment call the map records as
  closed must have been shown to the user first — including ones the
  territory answered.
- Close items as decisions, not discussions. Each resolved unknown ends as a
  one-line decision plus its why, phrased so the spec can carry it verbatim as
  a given. Every choice a builder later invents unsupervised is an unknown
  this walk missed — a map that leaves the implementer deciding is incomplete.
- Claims about the territory cite real files actually read; invented data is
  labeled as such. A fabricated specific destroys the map's authority.
- HTML artifacts are self-contained single files: inline CSS/JS, no external
  requests, plausible fake data over lorem ipsum.
- Stop at every stage boundary that needs the user's reaction. Never barrel
  into implementation on unconfirmed guesses — implementing is a separate
  task that begins after the map is delivered.
