# Public pointer review

Shape review keeps one source-selection helper, queue state machine, history/cache
owner, and publication input-readiness predicate. Index/frame and preview use the
same renderer support binding; the index no longer carries a duplicate renderer
identity setting. Source geometry and event-reset logic are unchanged.

Independent review found two actionable issues, both reproduced and corrected:

- Nested admission failure could leave an already-visited export waiting forever
  with no executor to wake it. Actual terminal transitions now coalesce one later
  admission pass. Removing that event fails the two retained negative controls;
  unchanged pressure/reads stay quiescent.
- Export retry could request an old renderer even when staged bytes could finish
  publication. Admission and retry now share prepared-input readiness. The staged
  retry negative control fails under the unconditional request, and native
  publication tests preserve cache/staging, version-change and unrelated decoder
  failure behavior.

The independent review's socket tests were blocked by its sandbox (EPERM).
The implementer's unrestricted public native journey and native publication suite
supply those gates; blocked review tests are not counted as passes. The second
review independently passed 627 core tests and 19 render/deletion tests, with
socket-dependent tests separately reported blocked. Final focused review of the
corrected export policy reported no actionable findings. Its runtime tests were
not run because the default helper path was absent; the implementer ran the
[eleven native publication cases](export-recovery.log) against the frozen combined
worker, including the new staged-recovery control.
