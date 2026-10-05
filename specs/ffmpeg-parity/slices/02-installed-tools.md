# 02 — Relocatable installed tools

Status: implemented and focused proof passed. Question: **Can callers discover and execute tools from the selected relocated app?**

Dependencies: [01](01-lgpl-build.md), [03](03-cli-lifetime.md) for owned version probes.

## Contract and owner

App runtime/bundle resolution and explicit `service.tools` discovery; release signing and receipts. Health remains a cheap readiness check.

Expose absolute ffmpeg/ffprobe paths, executable hashes, version/configuration identity and availability. Resolve from selected app, never PATH. Extend release manifest/signing to actual executable/dylib closure and provide notices plus matching-source access. Native defaults stay unchanged.

## Focused proof and review

A relocated staging app and structured capability receipt.

Run with system-only PATH and isolated HOME from a directory with spaces. Inspect Mach-O load paths, architecture and signatures; run both binaries and tiny representative features. Missing or mismatched binaries report unavailable. Do not replace the personal installation.

## Retained result

[Installed-tools proof](../evidence/installed-tools/proof.json) records a signed,
relocated staging app, Swift bundle resolution, official bundled Node 24.21.0
and production service socket discovery with isolated HOME/system-only PATH.
The staged native executable is the thin production CLI owner. Both tools,
Mach-O signatures/load paths and tiny H.264/HEVC, audio and filter smoke passed.
This is not a full native app-launch or released ZIP proof; those remain slice 26.

Focused checks: the service discovery fixture, five preparation/bundle tests and
service typechecking pass. Discovery refuses altered/missing bytes, rewritten
receipts and FIFOs; completed and cancelled probe processes are gone before
settlement. Independent review found no remaining actionable issues. Earlier
review findings about health latency and early subprocess-abort settlement were
fixed by separate discovery and the shared CLI lifetime owner.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. Public meaning and backend policy are fixed above; resolve a new semantic choice in this spec before coding it. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.
