# 02 — Relocatable installed tools

Status: not started. Question: **Can callers discover and execute tools from the selected relocated app?**

Dependencies: [01](01-lgpl-build.md).

## Contract and owner

App runtime/bundle resolution and shared health/capability response; release signing and receipts.

Expose absolute ffmpeg/ffprobe paths, executable hashes, version/configuration identity and availability. Resolve from selected app, never PATH. Extend release manifest/signing to actual executable/dylib closure and provide notices plus matching-source access. Native defaults stay unchanged.

## Focused proof and review

A relocated staging app and structured capability receipt.

Run with system-only PATH and isolated HOME from a directory with spaces. Inspect Mach-O load paths, architecture and signatures; run both binaries and tiny representative features. Missing or mismatched binaries report unavailable. Do not replace the personal installation.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.
