# Contract implementation decisions

Accepted: expose `targets` and `requiresAcquisition` from the same registry used
by authoring validation. Target compatibility is distinct from whether evidence
is presently available; a valid acquired clip may still await preparation.

Accepted: compiled pointer instructions retain `stepId` and an ordered
`geometryPrefix` of operation indices. Each prefix is an immutable snapshot of
already emitted geometry, avoiding duplicated transform calculations and mutable
references that could acquire later operations. Validation requires the complete
prefix, not merely individually valid indices.

Accepted: keep native execution unbound. This checkpoint proves authoring,
compatibility and compilation only. Source-history selection and rendering have
separate evidence requirements and cannot be replaced with empty overlays.

Accepted: add only the optional `trailUs` field to the existing native processing
DTO in this checkpoint. Strict request roundtrip otherwise rejects disabled
pointer metadata, despite the compiled picture being unchanged. Bypassed metadata
must remain transportable without binding the unimplemented processor.
