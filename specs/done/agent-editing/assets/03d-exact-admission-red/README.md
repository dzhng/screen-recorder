# Complete imported float-WAV endpoint reproduction

Input is the accepted corrected A: `specs/agent-editing/assets/13a-corrected-selections/internal-slower-0.8x.wav`, SHA-256 `53da1582ea82e3d6bb4ba16d9f7c75f978f838d28dd1f1e05b501bb0a5aeccc7`. It contains 246478 mono Float32 frames at 48000Hz: an exact endpoint of 15404875/3 microseconds.

The 0525dfb9 native worker probes/imports the end as integer 5134958us. Three real public attempts, with requests and responses retained in compressed reports:

- Fraction: `place` with exact reduced fractional source and project endpoints fails INVALID_PARAMS. `schema-errors.json` localizes the actual public operation schema failures to `clip.source.range.endUs` and `clip.placement.range.endUs`, both integer-only command fields. The persisted document's exact-time schema is not the public place command schema.
- Ceiling: endUs5134959 preserves the intended sample-clock count, but placement fails INVALID_EDIT because the selection exceeds imported source bounds.
- Floor: endUs5134958 is accepted, but dry audio has246477 frames. Every delivered stereo frame exactly duplicates the corresponding accepted mono frame. The omitted final mono sample is0.005455852951854467, not zero.

No product fix, padding, trim, rate change or fallback was accepted. The separate familiar listening packet uses the already verified original-source retime authoring route to reproduce all246478 accepted frames before denoise.
