# Bounded CLI media files

The CLI now streams single-media outputs through the same chunk validator used by
buffered image/audio model content. Only inline model content allocates a complete
bounded buffer; playable files use fixed-size chunks and a staged file beside the
destination. Exclusive publication never replaces an existing file. Transfer failure
closes the service lease and removes its temporary staging before returning.

The transport accepts a preview receipt without advertising a preview tool before
its service renderer is ready. MCP continues using its existing bounded image/audio
content path. Public preview operations and native app playback remain13e work.

[All21 CLI tests](cli-tests.txt), type checking and focused lint pass. The new
transport cases write49MiB+17bytes exactly, preserve a pre-existing destination,
and fail on a nonadvancing second chunk after512KiB has been staged, leaving no
published file or staging directory. Existing image/audio limits remain enforced.
Publishing the link before receiving chunks makes the cleanup regression fail on
an exposed `preview.mp4`; restoring the implementation returns the focused tests
to green. These are transport bytes, not a codec/playback acceptance claim.

Independent read-only review found no actionable regressions. Its type check
passed; its socket tests were blocked by sandbox `EPERM`. The host suite above
provides the actual transport test evidence. No new queue, catalog, operation,
configuration or third-party dependency is introduced by this pass.
