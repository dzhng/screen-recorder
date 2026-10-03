# Journal ownership and pinned mapping

A live writer and a recovery attempt must not mutate the same take. The journal inode owns a nonblocking kernel lease, automatically released when its final descriptor closes. Close-on-exec prevents an unrelated child from retaining abandoned ownership. The lease validates both directory and journal identity; locking a replacement inode cannot authorize the original attempt. Missing journals refuse without creating files. This is cooperative process exclusion, not protection against an uncooperative same-user writer.

Mapping replay uses the existing bounded record decoder and positioned reads of exactly the declared byte prefix. Later appends do not extend a pinned attempt; a short prefix, partial record or different digest refuses. Callbacks remain provisional until the validating read returns. No second parser, per-packet retained array, polling loop or lock file is introduced.

The default native suite includes real contender processes, actual exec inheritance plus a negative control without CLOEXEC, replacement and missing-journal checks, and prefix replay after later lifecycle/PCM appends. The retained default log includes schema1 capture/recovery preservation. The separately retained actual EFBIG writer probe verifies accepted decoded PCM survives both first journal failure boundaries while unsupported acquisition remains empty. Commands and worker identity are in verification.json; verbose artifacts are losslessly gzip-compressed.

This checkpoint does not activate packed capture or schema2 public admission. Canonical materialization, durable publication, retry continuation, cleanup, immutable import and package binding remain open. The publication proposal records the next owner integration, not shipped behavior. Physical camera/screen synchronization remains untested.

Review: root owner review, local shape/diff/docs review and independent read-only Codex review found no actionable correctness defect. Native build, default suite and isolated EFBIG probe passed after the final source changes.
