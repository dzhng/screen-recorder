# Service library operation verification

The actual Node service now opens the existing core catalog and dispatches its
implemented read/edit operations through shared protocol schemas. There is no
parallel edit implementation or fixture-only store in this route.

Root ran service/protocol build, type checks and tests: 24 service tests and eight
protocol tests passed. New real-process cases verify exact edited spans, undo's
fresh identity, stale-write rejection, historical reads and mutation replay after
service relaunch. Existing socket lifetime and lost-response transport cases remain
green. Focused lint and formatting pass.

The packaged app builds. Its old idle-start test expected only a socket directory;
the new eager catalog makes that expectation obsolete. The updated test requires
an empty catalog via the real `recording.latest` operation and no source directory.
All 15 packaged lifecycle checks pass; see [retained output](packaged-lifecycle.txt).

Independent Codex review found no actionable regressions and passed type checks;
its socket tests were sandbox-blocked. Runtime acceptance uses root's process runs,
not the restricted review environment. Shape review kept parameter definitions in
protocol, transaction/edit behavior in core and only composition in service.

This pass binds available library operations. It does not implement capture control,
source reconciliation, artifact jobs, media inspection, CLI/MCP adapters or their
complete operation parity. Those remain explicit parent/later-slice work.
