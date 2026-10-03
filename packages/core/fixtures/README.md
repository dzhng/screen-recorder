# Persisted catalog references

The prior-format catalog was created by the real recording revision owner before
its removal. It contains a capture, caller-authored cut and trim, their replay
receipts and undo history. The adjacent provenance records source/emitted hashes
and original contents. It is immutable input for refusal without migration; do
not regenerate it from the current schema or substitute a hand-written table.

The capture-store refusal test copies it before opening it. Source media and
user libraries are never test outputs.
