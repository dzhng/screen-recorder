# 01 — Pinned LGPL build

Status: pinned zimg source closure and affected 02–05 proof complete; HDR acceptance remains in 18/19. Question: **Can the pinned build execute the required compatible features?**

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


## Reopened dependency recipe

Actual PQ input made the system-only color candidate refuse its transfer
function in slice 18. The explicitly identified research candidate demonstrated
that libzimg is needed; this slice reopens the release dependency recipe without
changing native defaults or claiming HDR treatment acceptance. The owning
[provenance](../../../helpers/ffmpeg/provenance.json) pins zimg 3.0.6 (runtime,
WTFPL) and pkgconf 2.5.1 (build-only, ISC) with immutable archive hashes. Preparation
compiles zimg scalar/ARM sources from its upstream build manifest and pkgconf in
private staging. System-only PATH, fixed compilers/minimum macOS and a private
pkg-config library search prevent accidental host dependencies. No autotools,
Homebrew, model download or host install is needed.

All archives are verified before compilation; every dependency's matching source
and license travels with the distribution, along with actual commands/environment
and the build controller. Runtime dylibs retain @rpath resolution and remain
replaceable; pkgconf stays outside runtime. Hash-bound replay refuses corrupt
sources, absent matching notices/sources and absent runtime libraries before any
execution. Existing signed-copy staging remains the sole receipt owner after
codesign. This recipe invalidates the old affected component/relocation receipts;
new proof is retained separately rather than overwriting the initial evidence.

The final exact-controller build succeeds under an output parent containing
spaces. Real pinned pkgconf preparation first refused the unsafe source directory;
private whitespace-free compilation fixes that failure while same-filesystem
atomic publication remains beside the requested output. An EXDEV copy is verified
before commit; a separate external-volume runtime scenario was not exercised.

[New frozen receipts](../evidence/zimg-build/) retain matching-source/build
commands, exact prepared hashes, inventory, component smoke and separately signed
relocation. The relocated staging app resolver, production service discovery,
arm64 Mach-O load/signature closure and H264/HEVC/audio/filter execution pass under
system-only PATH and isolated child HOME. Seven selected streams across four
retained MOV and fresh CAF/AAC fixtures decode through held inputs, including
pathname substitution, B-frame edit-list support, VFR and rotation metadata reuse.
The fresh 100ms WAV uses the managed output slot, unchanged native held-output
validation and real workspace cleanup; its bytes/hash/native facts match the
initial proof. Actual FFmpeg completion, cancellation and isolated service death
retire both CLI/native processes. Nine preparation/release and eighteen selected
service ownership tests, strict selected service typechecking and scoped lint pass.

These are dependency/component and affected ownership checks. The unchanged frozen
native probe/cleanup owner is reused read-only, with the current thin CLI owner
compiled in scratch; this is neither a full app launch nor released ZIP proof.
The root prepared distribution remains untouched. The isolated final distribution
identity and controller hash live in the new receipt/checks, not a host PATH.
Slice 18 must complete its native metadata/timing, PQ/HLG analytical, gamut and
visual gates before production acceptance in 19. Build or filter success alone
does not establish correct HDR conversion.

Final shape/diff/docs review retains one dependency and signing owner, with no
host capability fallback. Independent review found the whitespace build-path
defect above; real red/green preparation fixed it. Its final read-only review
reports no actionable correctness defects and confirms controller/recipe/receipt
agreement, while preserving the external-volume and HDR proof limits.
