# Public project transcript routing

The existing transcript operations accept project selectors through both advertised
CLI and MCP schemas. The project service invokes the same core query owner and
shared job queue; no transport-specific projection or preparation owner was added.
Retry is limited to manifest preparation. Failed source dependencies report their
selection for an explicit source retry.

## Verification

Main build and workspace type checks passed. Focused invocations passed 9 service
tests, 11 CLI tests, 10 protocol tests and 18 core project/source paging tests.
The service regression requests an empty pinned revision through the socket and
waits for its real shared job before checking the exact empty page. The independent
public journey supplies the nonempty, rational, multi-track and historical oracles;
its reviewed evidence is integrated separately.

Independent Codex review found no actionable defects. Its own socket tests were
blocked by sandbox permissions and its native build by SDK/compiler mismatch.
Those limitations are separate from the passing unrestricted root checks.
Static lint and formatting passed for changed source files.

No project phrase search, event/cursor delivery, new native inference or subjective
speech quality is accepted by this routing pass.
