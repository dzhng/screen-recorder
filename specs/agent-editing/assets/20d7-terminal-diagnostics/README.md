# Terminal capture diagnostics

The existing recording lifecycle retains the original bounded failure message
alongside its code. It survives restart and duplicate delivery without requiring
usable video or a revision. Recovery chooses code and message from the same
failure; missing text stays missing. Unfinished finalization errors remain separate.

The public journey copies the prior prerecorded controller source, inserts an
explicit terminal failure in the copied journal, and exercises actual native
recovery with and without the copied video. CLI and MCP return the same message
after restart; source journal hashes remain unchanged during recovery. This is a
controlled terminal-failure fixture, not a physical device-disconnection result.

Native receipt verification re-exports that source through the same verifier used
by package admission. Both current and historical receipt formats pass exact
proof; altered current diagnostic text fails. Historical format projection removes
only fields that did not exist in that format. Native parsing also preserves a
long historical message's accepted journal prefix while bounding its disclosure.

The first independent review found live fixture policy literals; these now use
the processing owner. The relocated public package journey exposed a fixture
directory-permission mismatch, corrected to production permissions without
relaxing the storage check. Red and green logs are retained. Followup review found
no actionable regressions. Test counts and scope are in [verification.json](verification.json).

Compressed scripts preserve scratch locations. The source fixture is retained by
[the cleanup checkpoint](../20d6-settled-cleanup/README.md). No live capture,
installation, playback or listening acceptance occurred in this checkpoint.
