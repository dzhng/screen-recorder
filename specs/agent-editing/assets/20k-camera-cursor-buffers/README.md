# Cursor-generated compressed buffers

Native sample correspondence and reader-buffer equivalence are separate contracts.
A generated sample can preserve stored bytes, clocks and format while lacking
reader control attachments. These facts must remain visible to any transfer policy.

[The outcome](report.json) records the complete observation, native correspondence
pass and full-reader parity differences. The missing decoder-reset attachment and
end trim are retained without normalization; marker equivalence remains unqualified.

[Saved checks](saved-checks.json) verify the retained operands without native replay.
[The archive manifest](manifest.json) identifies the complete executed phase and reused
comparison operands in [the frozen archive](actual.tar.gz). Its source/controller are
historical reference material, not a maintained harness or production implementation.
