# 12 — Pinned SRT and VTT delivery

Status: not started. Question: **Do sidecars describe the explicitly selected displayed captions?**

Dependencies: existing contracts only.

## Contract and owner

Composition resolves cue placement; core exports/publication retain intent; protocol proposed export.create (new SRT/VTT kinds) operation.

Request revision, caption placement IDs, SRT/VTT and new destination. Resolve display text and clipped project intervals, not raw ASR. Order by exact start then stable placement ID. Round outward to milliseconds; report any added overlap. Omit nonpositive exact support, report omissions; plain sidecars discard styling explicitly. SRT/VTT escaping is format-specific.

## Focused proof and review

Tiny SRT/VTT files and parsed cue records.

Corrected display text, repeated take, fractional retime, anchors, trim, adjacent sub-ms endpoints, overlaps and escaping/newlines. Outward rounding must not create negative duration; allow genuine overlaps rather than rewriting meaning. Parse independently. Existing publication/replay/no-overwrite contract remains green.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.
