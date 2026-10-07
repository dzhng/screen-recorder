# 02 — temporal correspondence evidence

## Contract

Add `correspondence.prepare` and `correspondence.get`. Select two explicit
clock-bearing inputs: source audio channels, an edited/reference source, or a
prepared project tap. Publish candidate local mappings with offset, residual,
coverage, drift, anchors, competing candidates, and a global status of
`accepted`, `refused`, or `insufficient_evidence`.

An accepted result is source-bound evidence only. It does not declare an angle,
retime a clip, or synchronize a project. Refused results retain their candidates
and reasons for the agent to inspect.

## Ownership and seam

Use the existing source selection, PCM extraction, alignment, prepared-tap,
job/publication, generation, cursor, package, CLI wait, and MCP delivery owners.
Add one Core correspondence receipt parser/validator and one service handler.
`angle.declare` accepts only a matching accepted receipt; no automatic consumer is
added in this slice.

## Verification

Freeze positive controls (known offset, gain/noise, polarity), ambiguity,
silence, drift, duplicate source, missing support, and unlike-mic refusal cases.
Replay every numeric field and source identity without inference. The retained
real nine-pair unlike-mic evidence and global bridge refusal must remain refused.
Add protocol, service, CLI/MCP parity, package-read, pagination, and mutation tests.

## Must stay green

Existing alignment/join/synchronization replay tests, source selection tests,
angle validation tests, type checks, and public operation help.
