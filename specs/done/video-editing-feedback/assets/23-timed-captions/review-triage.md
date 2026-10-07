# Scoped review verdict

Independent Codex thread `01a1115f-26e9-7db2-8ad0-bbc377c7221c` completed its
resumed read-only review with exit zero and `turn.completed`. Its original run
ended when the delegated turn was paused; no incomplete run is treated as a pass.
The final raw verdict is retained unchanged.

The sole finding claimed the second caption occurrence was not retimed, making
the numeric movie reference's doubled source phase wrong. **Dismissed:** before
any movie is prepared, the fixture explicitly retimes `speech1` from two source
seconds to one project second. Its content-anchored caption inherits that extent.
Retained word windows still use source time, and the default normalized caption
curve completes twice as fast in project time.

At project 2.125 seconds, the retimed entrance PNG is byte-identical to the first
caption at source/project 0.250 seconds:
`d82d3f59edb9268be6bdf9b1f6eab83937f08039aa277fcd0b252d9a27486aaa`.
At project 2.6875 seconds the delivered active ranges are `[5,11]` and `[12,15]`,
matching source 1.375 seconds and its retained overlap PNG. All 48 movie frames
match the doubled-phase numeric reference with zero caption-pixel difference.
These are actual public/native results, whereas the reviewer did not run the
native checkpoint. Removing the factor would contradict the applied retime and
the supplied output. A short comment now explains this non-obvious clock relation.

Owned verdict: clean after evidence-grounded dismissal. No oracle or tolerance
was weakened. The fresh visual review followed the settled render changes; only
comments and closeout evidence were subsequently edited.
