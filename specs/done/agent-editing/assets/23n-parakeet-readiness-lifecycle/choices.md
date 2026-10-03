# Choices — checker lifecycle correction

## Sound, high confidence

**One scenario lifecycle owner.** When a source child dies during startup, the
checker must both reject readiness and finish cleanup before saving its report.
Those actions share the same child and SDK connection state. They now live in one
scenario-specific module used by the original checker and actual-child controls.
Keeping the code embedded behind model inventory checks would force failure tests
to scan retained models or add a test-only readiness mode. The prompt delegated
internal checker placement; the module adds no product abstraction or API.

**Preserve the first failure and cleanup evidence separately.** If startup emits a
failure and exits with code one, cleanup also rejects the zero-exit assertion.
The report keeps the startup error and cleanup error, then the checker still
rejects. Replacing the first error would lose its cause; ignoring cleanup would
hide a failed terminal check. No product policy or retry is introduced.

Storage names and archive layout are internal discretion. No uncertain or
user-only decision remains.
