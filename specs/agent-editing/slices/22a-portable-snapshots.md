# 22a — Portable snapshot and dependency boundary

Status: core checkpoint verified (2026-09-28); 11 focused tests and core type checking pass. Independent review findings about probe identity, retained-file validation and cross-extension deduplication are fixed with regression checks. This is the foundation of [22](22-portable-projects.md), not a playable package claim.

## Contract

A copied project keeps its complete retained revision sequence and the active undo
stack. Adoption assigns independent project/revision identities, preserving
composition identities and document meaning. A repeated adoption request returns
the same receipt; a different package under that request is a conflict.

Media remains byte-addressed. The portable inventory follows asset-owned reference
chains so generated media can retain its source/reference audio. Snapshot and
inventory reads are bounded. Missing references, unsupported acquisition ownership,
ambiguous paths and mismatched history hashes fail explicitly.

The asset owner stages and hashes source bytes before any catalog publication. The
project owner publishes dependencies, revisions, undo and durable references inside
one catalog transaction. Files left by a failed transaction remain invisible and
are removed by the existing asset startup recovery; successful adoption does not
retain a donor path as playback authority.

## Verification and next pass

Focused core tests cover history/undo independence, replay/conflict, dependency
publication rollback, byte preservation, pre-canceled staging, hash conflicts,
reference chains and manifest rejection. These are core behavior checks, not the
public CLI/MCP relocation or delivered-media gate.

The next pass connects this boundary to the existing bounded archive worker,
retained package registry and export publication owner. It must prove actual
export/open/adopt/render/edit/undo through CLI and MCP. Acquisition/source evidence,
scene/transcript generations, prepared processing outputs and fonts need complete
owner-specific export/adoption support before full slice 22 acceptance. Explicit
fixture coverage remains allowed; actual 15a output remains a final gate.
