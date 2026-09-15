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

## Recording pages

`recording.list` reaches the same core owner from the local socket, CLI and MCP.
Core checks verify exact newest-first identities across newly allocated takes,
edits and database reopen, plus canceled exclusion and default/maximum page bounds.
A real service process resumes the continuation after relaunch; actual MCP and CLI
processes return matching list data.

Root verification: 27 core tests pass; service 25, CLI 3 and protocol 8 tests pass,
with focused build/type checks (13 Turbo tasks). The initial pagination regression
failed because the operation did not exist. Independent Codex review found no
additional defect; its full native build was sandbox-blocked and is not evidence.
No native behavior or schema table changed in this pass.
