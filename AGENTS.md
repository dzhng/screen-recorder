# Principles

- **Optimize for iteration speed.** Minimize the time from a useful question to
  trustworthy feedback. Prefer small, coherent changes and short feedback loops.
  Remove work that does not improve the decision or the product.

- **Use the cheapest meaningful verification.** Check the behavior affected by
  a change first. Broaden testing only when a changed shared contract or a
  concrete unresolved risk requires it. Every expensive check needs a named
  question it will answer. Reuse valid evidence; repeat a check when relevant
  changes invalidate it. Test observable behavior, not implementation details.

- **Keep editorial judgment with the caller.** The product provides primitives
  and evidence and executes explicit requests. It makes zero editorial
  decisions. Detection supplies information, not permission to alter content.

- **Prefer simplicity and clear ownership.** Give each concept one authoritative
  owner. Remove obsolete mechanisms instead of layering alternatives beside
  them. Add abstractions for demonstrated needs, not imagined possibilities.

- **Preserve what matters.** Protect original material, user intent and verified
  behavior. Make changes reversible where practical. Keep enough evidence to
  reproduce conclusions without accumulating redundant copies.

- **Keep work bounded.** Resource use and waiting must have clear limits and
  observable progress. A stalled activity needs a changed approach, not endless
  retries. Continue useful independent work when another path is unavailable.

- **Respect human attention.** Resolve routine technical decisions from evidence.
  Ask for human input when it changes a consequential decision that cannot be
  established otherwise. Reuse information already provided.

- **Communicate the current truth.** Distinguish verified results, assumptions
  and unfinished work. Report failures honestly and never weaken a requirement
  to manufacture success. Documentation should explain durable purpose and
  constraints; implementation and temporary status belong with their owners.
