# Player reference coverage checkpoint

The existing [display reference](../../../../packages/test-harness/editing/FrameColorReference.swift)
now keeps a receipt for every attempted sample. Missing pictures retain a failed
row and later requests continue; integer requests inside fractional frames retain
the actual selected media clock. This is a selected picture observation, not a
claim that the requested timestamp is itself a presentation timestamp.

Generated image profiles remain distinct from source declarations. A profile with
no name can still carry an ICC payload; its hash is retained rather than inventing
a name or treating it as absent. The comparison runner must separately retain the
source's declared transfer, primaries, matrix, range and orientation.

[Focused proof](proof.json) records regression failures and successful coverage
checks. Two complete matched PNGs remain byte identical to the prior display
recipe. Existing consumers require available receipts before reading pixels. The
[case-selected native tests](../../../../packages/test-harness/editing/picture-reference.test.mjs)
own those behavioral checks; they require macOS and the selected fetched fixtures.

Full decoded-picture acceptance still requires the durable production-route
comparison, frozen profile/tolerance scope and visual gates. This checkpoint
changes reference coverage without changing successful picture output.

[Independent review](code-review.md) found a requested-versus-actual output-profile
claim, indirect readers without status checks and missing default registration.
[Resolutions](code-review-receipt.json) record their fixes. The PNG is re-opened
for actual profile identity, every consumer checks status, and the owning package
includes these native checks in its test command. No new renderer, dependency or
public operation was added.
