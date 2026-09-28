# Retained project picture ownership

The [project domain](../../../../packages/core/src/project-index.ts) connects
project picture identity to the existing retained index store. The
[behavior checks](../../../../packages/core/src/project-index.test.ts) use real
catalogs, project revisions, admitted source metadata, scene generations and
retained PNG files. Native pixel receipts are synthetic and labeled; these checks
do not establish public delivery, native image quality or actual queue retention.

A completed generation reads its admitted identity and retained bytes without
resolving the latest renderer or source analysis. Beginning a new generation still
validates its pinned inputs. Shared read paths enforce complete identity and the
project deletion fence; reclamation remains legal after the fence. Held descriptors
retain ordinary file lifetime until released; external delivery revocation belongs
to the service deletion owner and is not inferred from this store-only check.

Sampled coverage equals the full compiler-visible interval of its delivered frame,
not the clipped one-microsecond demanded receipt. Every delivered candidate has
one sampled interval, while the gaps remain unproven without an image ordinal.
A missing source is reported in physical provenance, not substituted for composite
coverage. Empty projects retain zero pictures; nonempty audio-only projects can
retain their background canvas.

The shared [picture validator](../../../../packages/core/src/frame-inspection.ts)
checks the complete native visual graph before projecting public timing/layers and
source provenance. Retained records compare that public projection. This boundary
responds to a reported fresh-agent misunderstanding of native versus authoring
coordinates; actual CLI/MCP and fresh-skill confirmation remain integration gates.
The service project-picture recipe changes for the public artifact shape, not a
pixel algorithm or source-picture change.

[Verification](verification.json) distinguishes focused tests, wider preservation
and independent review. Negative controls remove [identity checking](identity-mutant.txt),
[sampled coverage completeness](coverage-mutant.txt), or [native graph checking](native-graph-mutant.txt);
each must fail its corresponding behavior test before production is restored.

The shared record encoder exposes the existing serialized-row limit to producers.
Size overflow reports a structured limit error; ordinary JSON cycle/BigInt failures
and nonfinite-number encoding semantics stay unchanged. Actual producer admission
and preflight before scheduling pictures, indexed scene retention, queue cleanup,
service deletion integration and public delivery remain the next pass.
