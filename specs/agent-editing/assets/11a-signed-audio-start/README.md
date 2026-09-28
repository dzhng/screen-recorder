# Signed decoder starts

Probe/import accepts signed presentation origins. Packet lookbehind must never move
an already negative requested start forward to zero. The source reader preserves
that prior seek start; nonnegative seeks retain the existing bounded context.

The DEBUG native fixture checks the reader's actual request-boundary calculation
before reading its existing media fixtures. The zero clamp fails (`red.txt`); the
corrected bound and existing source wire cases pass (`green.txt`, `wire.txt`). This
is focused arithmetic coverage, not a claim of end-to-end negative-PTS media proof.

Independent review caught a release-packaging failure from the testable module
import. Internal boundary assertions are explicitly DEBUG-only; release retains the
normal module import and all existing media fixture tests. Release build evidence
verifies this fix without exposing an internal helper as product API.
