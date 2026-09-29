# 20d3 — Inventory-bound portable asset metadata

Status: planned. Dependencies: [20d2](20d2-asset-metadata-pages.md).

The actual large probe metadata exceeds the unchanged 2 MiB project manifest
budget. Serialize complete existing portable-asset values into inventory-bound
metadata members. Keep compact identities and byte/hash references in the manifest;
retain ordinary immutable media members. Charge metadata against existing archive
and scoped metadata budgets. Do not inline it in the native archive receipt.

Use existing admitted descriptor/file access and package lifetime ownership to
hydrate these members before dependency closure validation or transient readiness.
The same strict portableAsset decoder and canonical receipt/clock verification must
run before ready and adoption. No second metadata database or readiness registry.
Make the required pre-ready phase explicit in the current archive owner. Preserve
the recording-package contract. Follow the existing explicit project package
version/refusal policy; do not add compatibility paths for unshipped inline formats.

Verify actual 100,000-run export/open/adoption/relocation after donor removal,
complete metadata equality, missing/corrupt/reordered/substituted member controls,
canonical clock relabel refusal, cancellation and inherited package lifetimes.
Global framing/manifest budgets remain unchanged. This is metadata portability,
not a claim that every downstream audio selection or capture rollout gate is closed.
