# Output settings checkpoint

The functional settings checkpoint is integrated in root68e25d9d. Its shared
schema owns explicit CLI/MCP settings, preset expansion, canonical render identity
and authored export retry identity. Native preflight rejects unsupported settings
before reading source frames or preparing audio. Actual H.264 profile/level is
read from the encoded sequence header; AAC rate/layout and duration are validated.

[Measured quality/size policy](../09b-output-quality/README.md) supports the balanced
starting point while preserving explicit overrides and every earlier fidelity
failure. Presets never replace the controls. The public SDK inventory found
additional applicable controls and overly narrow schema ranges; their expansion
and final fresh skill use are still in progress. Whole09b is not complete.

## Verification boundaries

Retained public receipts cover fourteen encoded variants: preset/explicit reuse,
video rate modes and profiles, AAC formats, full/range frame reordering,
cancellation/retry, historical revisions and stable export replay. Independent
review caught three defects, all corrected: stale native movie callers, invalid
settings surfacing as internal errors, and changed request identities for
settings-free exports. Native video, picture-admission, layered rendering and
composition movie/audio regressions pass. Original failed runs remain retained.

The preflight negative control fails against the previous worker and passes
against the corrected worker before missing source files or incomplete audio
plans are touched. Explicit header validation first caught an incorrect Baseline
profile identifier; the corrected hexadecimal map is verified against delivered
files. Frozen worker: `/tmp/screenrec-output-profile-verified-native`.

The [limited-context skill checkpoint](skill-checkpoint.md) exercises discovery,
custom settings without a preset, full resolved-settings reuse, byte-identical
preview/export and replay, independently probed encoded formats, and explicit
invalid-combination refusal. Its [raw evidence](skill-checkpoint.zip) is retained.
The consumer knew the project lifecycle from previous work; this is not a fully
fresh agent gate, and new controls require subsequent verification.

The quality harness, decoder and retained provenance passed independent review
without actionable findings; [review log](quality-code-review.log). Exact
experiment design is in [the quality plan](quality-plan.md). Public parameter
schemas and native lowering remain the authoritative setting inventory; these
evidence files record verification rather than another API manual.

[Combined-root confirmation](root-integration.json) passes the targeted build,
16 focused tests, 13 export-lifecycle tests and the complete public settings journey.
The source-index portability guard remains preserved during integration.
