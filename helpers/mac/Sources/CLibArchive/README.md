# libarchive binding

The two public headers are unmodified upstream libarchive v3.7.4 files, including
its redistribution notices. The macOS SDK supplies libarchive.2.tbd but omits these
headers. This module links the OS library; it has no Homebrew dependency or bundled
runtime. Upstream: https://github.com/libarchive/libarchive/tree/v3.7.4/libarchive

ArchiveOperation owns the deliberately restricted ZIP reading and writing. Its receipts
include the runtime version, because OS updates can change the implementation.
