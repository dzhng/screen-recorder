# 01 — Pinned LGPL build

Status: complete. Question: **Can the pinned build execute the required compatible features?**

Dependencies: existing contracts only.

## Contract and owner

The FFmpeg dependency owner in helpers/ffmpeg binds pinned sources, configuration, prepared shared-library bytes and matching-source receipt; scripts composes it into release preparation. No generated binary in Git.

Pin stable FFmpeg/ffprobe sources and dependency hashes; disable GPL/nonfree. Include Apple codecs, swresample, metering/dynamics and compatible LUT/color filters. Initially test compatible HDR candidates without libzimg; prepare a separately identified libzimg candidate only if the later HDR reproduction demonstrates need. A new dependency/configuration reopens this slice, produces a new frozen receipt and invalidates affected bundle/execution evidence before production use. Bind architecture, configure flags, dependency licenses and matching-source distribution. Exact versions are research outputs frozen here before dependent work.

## Focused proof and review

An arm64 build inventory and tiny encode/probe/filter receipts.

Run actual pinned filter help and bounded operands. Require H264/HEVC Apple encoder execution, WAV/AAC, metering and dynamics; report optional unavailable filters. Inspect LGPL version and transitive dependencies. Missing mandatory feature fails the slice; no Homebrew substitution.

## Boundaries and decision budget

Inherit the [global contract](../README.md#contracts-and-ownership) and narrow verification policy. Write-tests red/green precedes behavior changes. Existing native output and persisted identity remain unchanged unless this slice names the extension.

Delegate internal naming/decomposition, bounded fixture selection and reversible artifact styling. The recipe/provider/build decision is a measured research deliverable; freeze it and its limits in this file before any dependent implementation. Record actual commands, immutable input/runtime identities, coverage, failures and verdict. User feedback changes requested meaning, supported scope or visible appearance; mechanical preferences alone do not justify expanding the slice. A failed proof remains unfinished and must be narrowed or resliced, not waived.

## Retained result — 2026-10-04

Pinned official FFmpeg 9.0.2 archive SHA-256 8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e. Recipe SHA-256 8e11246e56ef1ccc5737c91c34eda5319fd8e0654112a2e88a37ee4d72ae161e. Built arm64 with macOS 26 minimum, GPL/nonfree/version3 disabled, autodetected external dependencies disabled. Shared libraries use @rpath and only bundled libraries/system frameworks. Prepared distribution is about 34 MiB, including matching source archive; no libzimg selected yet.

Three narrow CLI tests pass (corrupt source refusal, changed executable refusal, verified idempotent replay); replay test was falsified and restored. Actual smoke passes Apple H264/HEVC 320×180 one-second encode/probe/decode, Float32 WAV and AAC48k, and metering/normalization/limiter/sidechain/colorbalance execution. Inventory confirms required filters, with absence of GPL eq and libx264/libx265. These are build/component checks; no app, project or appearance claims.

Review: refactor-clean found one dependency owner and no alternative renderer/supervisor. Source packaging retains the build controller as well as upstream source/configuration. Code-review and narrow tests are clean. Independent Codex review found no actionable defect; its sandbox could not create VideoToolbox sessions, while the unrestricted bounded production-build smoke succeeded. No performance or managed-execution claim relies on that restricted run. [Frozen receipts](../evidence/lgpl-build/) record the actual prepared bytes and smoke results.
