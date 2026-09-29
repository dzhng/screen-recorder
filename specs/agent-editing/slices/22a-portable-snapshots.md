# 22a — Portable snapshot and dependency boundary

Status: core checkpoint verified (2026-09-28); 11 focused tests and core type checking pass. Independent review findings about probe identity, retained-file validation and cross-extension deduplication are fixed with regression checks. This is the foundation of [22](22-portable-projects.md), not a playable package claim. Dependencies: [02](./02-assets.md), [04](./04-projects.md).

## Contract

A copied project keeps its complete retained revision sequence and the active undo
stack. Adoption assigns independent project/revision identities, preserving
composition identities and document meaning. A repeated adoption request returns
the same receipt; a different package under that request is a conflict.

Media remains byte-addressed. The portable inventory follows asset-owned reference
chains so generated media can retain its source/reference audio. Snapshot and
inventory reads are bounded. Missing references, unsupported acquisition ownership,
ambiguous paths and mismatched history hashes fail explicitly.

The project owner prepares independent identities without catalog visibility, so
revision-bound evidence can be validated before publication. Publication rechecks
request replay inside the shared transaction; a concurrent loser returns the winning
receipt without publishing its staged dependencies. No durable identity reservation
is needed.

The asset owner stages and hashes source bytes before any catalog publication. The
project owner publishes dependencies, revisions, undo and durable references inside
one catalog transaction. Files left by a failed transaction remain invisible and
are removed by the existing asset startup recovery; successful adoption does not
retain a donor path as playback authority.

## Seam and ownership

ProjectStore owns revision/undo snapshots and atomic adoption; AssetStore owns staged
immutable media publication. ResourceReferences supplies dependency edges. The
project package manifest validates the inventory and complete composition meaning;
existing archive framing/path/byte limits stay with the archive owner.

## Verification and next pass

The [public project-index relocation](../assets/22-project-index/README.md) now
exercises this boundary through CLI/MCP and the native worker, including current
and historical picture receipts, source evidence, rendered results and failed-import
controls. Identity preparation remains invisible; a concurrent publication loser
returns the winning receipt without publishing its own staged evidence.

Prepared model-dependent output retention, fonts and non-current package export
remain parent-22 work. Actual 15a output is still a final acceptance gate.

## Failure boundary and discretion

No missing dependency may be silently omitted or replaced by an external donor path.
Core refusal for unsupported owners remains an unfinished parent22 obligation, not
a smaller package promise. Internal staging and identity remapping are delegated;
editable history, atomic visibility and complete dependency retention are fixed.
