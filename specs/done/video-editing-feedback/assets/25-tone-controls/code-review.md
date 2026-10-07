# 25A scoped code review

An independent read-only Codex review inspected the native correction, service
identity/readiness, public tone runner, fixture evidence and cleanup. Its verdict
initially found three P2 issues in the new runner:

- chart-reference startup was outside the cleanup guard;
- RGB byte counts were labelled `channels`;
- the report marked success before service/home cleanup completed.

All three were fixed in the runner, then lint, syntax, service tests/typecheck and
the complete public tone runner were rerun. The final report records
`cleanup.completed: true`, the field is `bytes`, and `passed` is finalized only
after cleanup. The original review verdict is retained in the session artifact;
these findings were implementation hygiene defects, not a native tone mismatch.

A fresh visual observer inspected every current full frame, all supplied 4x face,
wall and neutral crops, comparison sheets and both decoded movie samples. It found
no candidate-only geometry, halo, banding or reference mismatch. Shared source
softness and matched movie softening remain visible limitations. Exact pixels,
fine texture beyond the supplied resolution, temporal behavior beyond two held
frames and arbitrary editorial taste remain outside this visual verdict.
