# 21 — Immutable motion-asset interchange

Status: complete. Ordinary immutable assets, placements and processed packages already
carry the finite movie representation frozen by slice 20. No production extension
was necessary.

Dependencies: [20](20-alpha-feasibility.md).

## Contract and owner

Core assets/acquisitions/packages; composition clocks; consumer import helper.

Implement only representation frozen by feasibility. Retain all members and explicit timing/color/alpha manifest where necessary. Reuse normal layer placement, exact curves, undo and package dependencies. No external animation-source runtime or second clock.

The movie's immutable bytes contain its timing and color/alpha description. Existing
asset streams retain native facts; inventing another manifest would introduce a
second owner. A package retains the whole movie, including undo dependencies.

## Retained proof

[Public journey](../../../packages/test-harness/editing/motion-interchange.mjs)
uses the real CLI/socket service in scratch state. [Complete operands and
receipts](../evidence/motion-interchange/proof.json) preserve source/runtime identity,
import, repeated/retimed/undo/historical views, bounded off-grid preview, package
export/adoption and missing-member refusal. Sender scratch media is deleted before
recipient adoption; the archive member independently hashes to the original movie.
Lossless decoded pixels match the frozen movie reference, rather than pinning
platform PNG compression bytes. Sample phase and final support are explicit.

The tiny H.264 preview changes saturated one-pixel edges. The matched still-image
preview has exactly the same decoded pixels at all three selected phases, separating
existing codec loss from alpha input. This does not establish general encoded-edge
quality. Slice 20 owns unchanged light/dark matte and orientation proof. No new
Preview batch was opened because cleanup of the prior owned batch was unverified.

Independent code reviews found PNG encoding coupling, a surviving donor library,
unchecked final sample duration and cleanup vulnerable to report failure; all were
corrected. The extended-support fault retains identical frame starts/pixels but now
fails the duration gate. An injected report failure exits without owned service/MCP
processes remaining. The raw-versus-encoded visual critique's edge/color findings
are retained, not dismissed. Final matched-encode critique finds no discrepancy;
the shared gray edge remains documented codec loss. No motion smoothness or sound
quality claim follows from these stills.

## Focused proof and review

Imported overlay, repeated placement and portable package.

Hash retention, missing-frame refusal, exact cadence/final support, repeats/retime/off-grid views, undo/package adoption and light/dark alpha edges. Judge edge/phase crops against feasibility control.

Retain source/control and candidate shots. Use compare-screenshots to judge the named variable/crop; show useful shots with preview-shots. As the last visual acceptance check, run unprimed screenshot-critique. Human response is a non-blocking chance to redirect reversible choices: allow about five minutes while doing other work, then decide from evidence, record the verdict and close opened shots. Never claim unseen or unheard quality.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.
