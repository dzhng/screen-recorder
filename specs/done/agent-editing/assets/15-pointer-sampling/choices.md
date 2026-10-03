# Examined choices

- Extract the existing schedule's event/reset owner rather than introduce a second
  scene or gap interpretation. Both event-driven legacy output and fixed project
  sample requests consume the same transitions and eligibility planner.
- Evaluate all intervening actual events, not only the two pictures at requested
  output instants. Otherwise A-B-A scenes and short physical gaps could reconnect
  a stale pointer or trail.
- Keep lookahead observational. A future invalid geometry record must not veto an
  earlier supported request merely because the stream looked ahead to its time.
- Restart forward readers for backward requests while retaining aggregate work
  budgets. This supports arbitrary selected instants with bounded memory; it is
  not a claim that highly shuffled workloads meet release-scale performance.
- Count output occurrences separately from source events. A long held picture can
  otherwise produce unlimited repeated overlay work without consuming event budget.
