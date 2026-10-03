# Metadata owner choices

## Sound — high confidence

When a project asks for cursor rows from many acquisitions of one asset, validate
that asset once within each synchronous phase and validate every acquisition once.
Start a new batch after the checkpoint write and on the next request. This shares
immutable inputs without retaining an earlier success across a point where another
owner can change. The plan named the redundant owner work but did not select the
batch boundary. It adds only local maps within the existing capture reader.

Evidence resolves source support without a renderable file address. The same pure
source-selection rules serve both facts and file-addressed consumers, preserving
support, bindings and clocks. A stored asset header is insufficient because physical
segments define occupied support; its complete metadata still loads once per phase.
No replacement metadata projection or durable cache is introduced.

Keep source-by-source scene validation/preparation ordering. Scene preparation can
submit jobs, so collecting all capture contexts first would change partial-work
behavior when a later source fails. Cursor and capture-only reads can share a batch
without those side effects. Optimizing scene/transcript preparation was not justified
by this cursor profile and is outside this pass.
