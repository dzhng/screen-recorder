# Archive boundary research

This records the research behind [14c1](../../slices/14c1-bounded-archive-extraction.md).
Its tiny probes are distinct from the later [extraction proof](archive-extraction.md);
the moved-directory checks alone do not prove untrusted ZIP opening.

The Swift-native [ZIPFoundation project](https://github.com/weichsel/ZIPFoundation)
provides chunked extraction to a consumer closure, which could feed the existing
native descriptor-relative file ownership approach. Its
[reading implementation](https://github.com/weichsel/ZIPFoundation/blob/development/Sources/ZIPFoundation/Archive%2BReading.swift)
returns a CRC value; the caller must compare the expected checksum when using that
low-level API. This is a candidate for evaluation, not a reason to use its
pathname-based convenience extraction.

A concrete blocker to adopting its iteration API unchanged appears in
[Archive.swift](https://github.com/weichsel/ZIPFoundation/blob/development/Sources/ZIPFoundation/Archive.swift):
`makeIterator` ends with `nil` when a central-directory or local-header read fails.
Normal end and malformed-entry termination are therefore indistinguishable to a
plain public iteration loop. Matching all expected manifest entries before that
point does not establish that every remaining archive entry was examined. These
links describe the inspected development source, not a pinned release guarantee.

The next extraction feasibility test must include a valid manifest and all its
listed members followed by an unreadable extra archive entry. Reject it explicitly;
do not certify completeness merely because the manifest inventory was satisfied.
The parser must expose reliable end/error/count semantics or have another proven
way to establish complete bounded traversal. Evaluate this before selecting or
pinning an archive dependency. Avoid introducing a handwritten ZIP parser just to
patch a convenient library's missing signal.

Keep actual expansion limits, entry/path budgets, duplicate/case collisions,
symlink/special-file rejection, CRC plus inventory hashes, descriptor-owned staging
and cleanup in the same extraction gate. Package handles, context-scoped scheduling
and delivery revocation remain later ownership work.

## Follow-up probes and conditional choice

[14c1](../../slices/14c1-bounded-archive-extraction.md) selects the system
libarchive seekable ZIP reader; the extraction report supplies its subsequent
acceptance suite. This adds no Homebrew runtime requirement or bundled
third-party binary: a minimal SwiftPM C system module vendors the unmodified, licensed
[3.7.4 public headers](https://github.com/libarchive/libarchive/tree/v3.7.4/libarchive),
links `archive.2`, and is consumed by the native extraction owner. The configured
CommandLineTools MacOSX SDK has `libarchive.2.tbd` but **no archive headers**;
SDK-header-only integration was rejected. A clean isolated SwiftPM probe with
include/library environment overrides removed compiled, linked and ran reader
creation, seekable selection, mac-ext disabling and free against libarchive 3.7.4.
This is ABI/build feasibility, not acceptance of hostile input or a runtime bundle.
Missing symbols or unsupported options fail explicitly, never fall back to unzip. Runtime/OS versions stay
in receipts because a system dependency can change with macOS updates.

Tiny generated ZIPs were inspected with the host's libarchive 3.7.4 through its C
API and scratch-installed yauzl 3.4.0. These probes are parser evidence only:
`manifest.json` contains a probe inventory, not a valid complete product manifest.
All entry payloads were fully read. They do not prove descriptor-safe extraction,
memory bounds or the production implementation. The compact machine result is
[parser-probe.json](parser-probe.json).

| Mutation | libarchive, seekable, mac-ext disabled | yauzl, lazy entries and strict names |
| --- | --- | --- |
| Broken final central/local header | Explicit error | Explicit error when count includes tail |
| EOCD count underreports extra entry | Extra entry exposed | Normal end hides extra entry |
| Underreported count plus broken tail | Explicit error | Normal end hides broken tail |
| Payload CRC corruption | Explicit read failure | Normal end; manual CRC comparison detects corruption |
| Two central records alias a local offset | Explicit error | Requires application validation |
| Extra `__MACOSX` member | Exposed with mac-ext disabled | Not used to select candidate |

The last row matters: default libarchive hid that member. Explicitly disabling
`zip:mac-ext` returned success and made it visible. Do not use automatic Mac metadata
restoration. Selecting only the seekable reader also avoids treating local-header
stream traversal as an equivalent completeness check. See libarchive's
[ZIP format notes](https://github.com/libarchive/libarchive/wiki/FormatZip) and
[ZIP reader implementation](https://github.com/libarchive/libarchive/blob/master/libarchive/archive_read_support_format_zip.c).

Yauzl's iteration stops at the declared count, so validating only the entries it
emits is insufficient for this boundary. Do not bolt a private EOCD parser onto it.
The checked public implementation is
[yauzl 3.4.0](https://github.com/thejoshwolfe/yauzl/blob/v3.4.0/index.js).

Libarchive eagerly builds central-directory state before returning its first
header. A later member-count check alone cannot bound that allocation. A custom
read/seek adapter with a 64 KiB fixed buffer was probed: at a 256-byte initial read
budget it refused to expose the excess byte and the first header failed; at 8 KiB
the same small fixture returned a header. Callback errors are propagated by the
[libarchive IO contract](https://github.com/libarchive/libarchive/wiki/LibarchiveIO).
The adapter must retain its own limit reason when the parser error string is empty.
This proves error propagation, **not** memory safety at the proposed 8 MiB default:
14c1 must measure actual peak RSS on adversarial metadata and verify forward progress
and cancellation, including a single oversized metadata entry. If allocation can
precede bounded input or loop without another callback, reject the candidate or
add a proven library-supported limit; do not claim the byte counter solved it.

Independent plan review identified raw-name visibility, check-to-unlink races and
post-kill cleanup ownership as prerequisites. The extraction pass settled them
through effective-name inventory checks, explicit private workspace ownership and
a parent-retained descriptor. Core verifies bounded immutable manifest/revision
bytes after the one-shot child exits; no two-way resident verification protocol
is necessary. The 14c1 slice owns the precise threat model and remaining lifetime
boundary.
