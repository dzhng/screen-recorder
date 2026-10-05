# 03 — Owned CLI execution

Status: not started. Question: **Can a raw FFmpeg task finish, fail and retire within the existing worker lifetime?**

Dependencies: [01](01-lgpl-build.md).

## Contract and owner

Service worker.ts owns process lifetime; protocol-specific decoding sits at its boundary.

Generalize existing lifetime ownership for argv/exit/status/progress/binary or JSON output. No shell, daemon, second supervisor or routing framework. Preserve native JSON-worker semantics. Progress is not completion; bounded stdout/stderr must drain without deadlock. Choose direct child topology where possible; any necessary wrapper must prove descendant retirement.

## Focused proof and review

A fake-worker fixture and one real bounded cancel probe.

Test noisy diagnostics, binary output, malformed probe JSON, nonzero exit, deadline, abort and exit-before-drain. Kill service/wrapper and prove all descendants stop before staging/capacity reuse. Retain bounded failure context without leaking unrelated content.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.
