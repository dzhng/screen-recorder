# Verification tools

This package exercises product contracts and measures their output. It also
holds independent references for judging that output and experiments for
questions the product implementation cannot settle by inspection.
The [product boundary](../../README.md#product-boundary) applies to every fixture
journey: authored test operations are explicit inputs, not inferred edit intent.

## Find the right owner

The [package manifest](package.json) owns default discovery and named lab
entry points. Being outside default discovery means a tool is run deliberately;
it says nothing about whether its evidence is useful or still valid.
The source owns arguments, prerequisites and case selection. Read the selected
runner before invoking it; some perform native rendering, model preparation or
inference, while an evidence verifier may only read existing files.

- [Editing and source verification](editing/README.md) covers acquisition facts,
  composition, pictures, audio, processing, delivery and publication.
- [Speech evaluation](speech/protocol.md) explains how independent labels,
  model identity and word alignment constrain accuracy claims.
- [Native transport checks](src/) exercise the worker protocol and client
  image boundary. The [protocol fixtures](../protocol/fixtures/) own the shared
  requests and expected responses.

Files alongside this README cover system integration and resource measurements
that cross those domains. The [installed caller journey](personal-release.mjs)
is deliberately separate from scratch integration: it consumes a supplied edit
plan through the installed CLI and can operate on the person's library.

## Different kinds of proof

A fixture generator supplies repeatable input. An oracle states the expected
result independently of the mechanism being checked. An integration journey
exercises actual component boundaries, including failure and resource lifetime.
A measurement records cost under specified work and environment. A reproduction
isolates a platform or model question; it does not become a production alternative.

Follow a runner's imports to reuse its fixtures, transport and observers.
Keep an independent expectation independent: sharing setup is useful, sharing
the implementation's answer would hide the defect. Numerical identity,
perceptual quality, installed behavior and resource budgets are different claims.

## Reuse evidence before producing more

Locate the contract in the source, then follow its evidence references. The
[closed editing record](../../specs/done/agent-editing/README.md#retained-evidence-and-visual-standards)
owns retained results and acceptance limits. Current runners reproduce claims;
[archived evidence](../../specs/done/agent-editing/assets/README.md) binds historical
results to the source revision that produced them.
Neither a saved pass nor a script's continued presence certifies current behavior.

Choose the smallest existing check that can distinguish the suspected failure.
Generated output belongs in an explicitly selected evidence directory or owned
scratch, separate from executable source. Reuse valid source media and results;
refresh only the work whose inputs or implementation changed.

A specialized tool earns its place by preserving a distinct claim or isolating
an unresolved question. Its local documentation should explain that distinction
and point to the owner of cases and inputs. An experiment retained only to explain
a historical result belongs with that evidence rather than as a second current
verification owner.
