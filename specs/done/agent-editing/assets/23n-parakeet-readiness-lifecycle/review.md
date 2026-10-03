# Review — checker lifecycle correction

Clean after refactor-clean, code-review, write-tests and write-docs.

The original checker owns the same operation and preservation assertions. A
textual comparison in the archive records the operation helper and verification
body's equality after explicit lifecycle-name and whitespace normalization; the
diff was also read. This is source preservation evidence, not a repeated model
gate. Original accepted evidence is unchanged.

The source startup wait settles on a terminal event or child error. Malformed and
truncated control output reject through the same cleanup path. SDK close
observation precedes initialization, and its error signal settles malformed
initialization output. Cleanup attempts both owned resources; report persistence
follows even if terminal assertions fail. Existing SDK shutdown behavior and
successful source zero-exit assertions remain authoritative.

The two original defects are reproduced against the extracted original lifecycle,
with actual driver terminal results and missing-report outcomes retained. Eight
corrected actual-child controls pass, including the ordinary success control and
nonzero source-close refusal. Syntax, focused lint/format and diff checks pass.
No model, native, media or readiness cohort ran. The [metadata](verification.json)
owns exact commands, source pins, results and archive identities.
