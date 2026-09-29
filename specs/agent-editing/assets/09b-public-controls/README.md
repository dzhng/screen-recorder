# Public output controls checkpoint

Presets supply defaults; the authored schema owns choices and the native SDK owns
format-dependent acceptance. Range restrictions should express documented domains,
not a convenient preset's range. The [public journey](public-journey.json.gz)
exercises the schema through preview, encoded output inspection, export and replay.

Two framework boundaries matter when extending this owner. VideoToolbox defines
zero average bitrate and keyframe count as automatic, but AVAssetWriter rejects
those literal values. The native lowering omits those keys while retaining authored
zero intent. The [initial refusal](zero-writer-refusal.json.gz) and successful
public journey pin that distinction. Zero keyframe duration is accepted directly.

A public audio key is not necessarily usable through this writer. Explicit Normal
and Mastering resampling algorithms passed writer admission but failed actual AAC
encoding; omitted algorithm succeeded. The [writer refusal](resampling-writer-refusal.json.gz)
and [isolated probe](resampling-probe.swift.gz) explain why discovery identifies
algorithm selection as unavailable. It must not silently become a no-op control.

The [SDK audit](sdk-audit.md.gz) records provenance and conditional public controls.
It predates implementation and is evidence of the audit, not the current API roster.
The schema/native owners remain the source of truth for available controls.

Verification: [composition suite](composition-suite.log.gz) passed 197 tests;
[independent review](independent-review.log.gz) found no actionable defects, with
native journeys verified by the implementing pass. The successful journey includes
constrained-profile SPS checks, automatic settings with look-ahead, lower-rate AAC
and higher-bitrate mono AAC alongside prior preset/replay/retry/timing gates.

Explicit offline mode retains the prior balanced opening output at sampled frames:
[matched comparison](default-parity.json.gz) confirms identical reference PNGs,
Apple-decoded BGRA and ICC hashes, timestamps and file size. Movie hashes differ;
this is decoded-pixel parity, not byte-identical containers. The [new cohort](default-cohort.json.gz)
records inputs and worker provenance. This does not replace longer-cohort fidelity
evidence or promote a different preset.

Next checkpoint: expose public encoder selection through one typed specification
lowered identically to VT preflight and AVVideoEncoderSpecificationKey on the real
writer. Verify completion under hard selection constraints and refusal under an
impossible selection. Report requested/enforced policy, not an observed encoder ID:
AVAssetWriter does not expose its selected VT session. Preferred selection explicitly
allows fallback. An independently owned resampling stage remains separate work if
algorithm selection is required; adding its rejected dictionary key is not sufficient.

[Combined-root verification](root-integration.json) passes the targeted build and
210 composition/preview tests with previously integrated fade/zoom behavior.
