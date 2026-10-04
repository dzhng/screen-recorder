# Public clean-frame delivery checkpoint

Verified 2026-09-16. This is explicit clean single-frame inspection, not completion
of the parent frame/audio/trail slices.

The packaged own-window fixture records with both audio sources disabled. Through
actual public operations it produces a clean frame; the CLI writes a PNG and the
official MCP SDK client receives byte-identical image content. A crop returns the
requested dimensions at the same actual source timestamp. An exact-duration
request is rejected. After a cut, playback zero decodes inside the following kept
source span, while an explicit historical revision retains its original cache
publication. The original video hash is unchanged.

The native frame/source-processing integration pair passes. Core inspection has
four focused tests for revision pinning, cut joins, cache regeneration, invalid
native intervals and explicit retry. The prior integrated core suite passed 78
checks; the fourth frame test was added afterward and passes. Service has 56
passing tests, CLI has nine, protocol has nine, and eight build/type tasks pass.
The adapter's byte-transfer test moves a payload over 8 MiB through bounded socket
chunks and verifies exact bytes. That payload check is not a large-image MCP host
compatibility claim. Malformed nonadvancing chunks fail and release their read.

Independent code review found the native test lacked a CLI build dependency. The
macOS package now declares it; Turbo's dry-run graph contains the CLI build. Review
socket tests were sandbox-blocked; the root ran actual sockets and the native tests.
The separate delivery helper review reported no actionable defects.

## Visual evidence

[Delivered frame](delivered.png), [title crop](title-crop.png),
[label crop](label-crop.png), [metrics](metrics.json).

Target: the captured fixture's complete upright grid, labels, title and fiducials,
with no pointer overlay. The actual CLI output is 1600×1065; MCP received exactly
those bytes. There was no earlier public image route to use as a before-image;
this pass does not claim a rendering-style change.

Root inspection and a fresh unprimed agent agree: no missing/clipped content,
orientation error or capture corruption; title and labels remain readable. The
reviewer noted mild edge softness, clearest in the enlarged crops. It is accepted
for this default-size fixture, not a universal small-text readability claim.
Metrics establish nonempty content, not visual correctness on their own.

## Still open

Default pointer/trail requests need source pause/geometry/scene boundaries and
core sample selection. Batch frames, full-resolution public coverage, sparse
numbered public fixtures, audio delivery/audition, cache-pressure native scenarios
and the complete real-agent edit/export workflow remain their owning slice gates.
The official MCP client receipt is distinct from an AI model inspecting the image
through production MCP; the latter is not claimed here.
