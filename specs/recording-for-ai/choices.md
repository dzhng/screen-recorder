# Implementation choices

## Bootstrap and tooling

### Local bundle identity

- **When:** bootstrap.
- **Decision:** build a locally ad-hoc-signed ScreenRecorder.app with stable bundle
  identifier com.david.screenrec. Its status-bar label is ScreenRec.
- **Gap:** the project had no product name, signing identity or distribution setup.
- **Rationale:** a stable local app identity supports later macOS permission testing;
  public signing/notarization belongs to the separately planned public release.
- **Consequence:** the personal build needs no distribution account; public release
  must explicitly choose its signing and product identity.

### Build dependency pins

- **When:** bootstrap.
- **Decision:** pin the installed registry versions of TypeScript, Vitest, Turbo,
  oxfmt, oxlint, Zod and Node 24 types; Bun and Node retain the spec's runtime split.
- **Gap:** the spec delegated exact dependency versions.
- **Rationale:** one lockfile and exact direct versions make the initial toolchain
  reproducible rather than copying another repo's older numbers without a reason.
- **Consequence:** updates are deliberate dependency changes and require focused checks.

### Native build caching

- **When:** bootstrap.
- **Decision:** disable Turbo caching for the native bundle build and process/conformance tests;
  include the shared TypeScript compiler config in global cache inputs.
- **Gap:** package-local build outputs do not describe the root .app directory.
- **Rationale:** a cached success must not skip creating the actual app after output
  deletion. Swift already performs incremental compilation.
- **Consequence:** root builds always invoke native packaging/signing, and native process checks
  execute even when inputs outside the app package change.

## Actual-agent inspection

### Evidence without personal recordings

- **When:** image-access gate.
- **Decision:** use randomly generated digit PNGs and an isolated Claude Code
  session to prove both MCP image blocks and CLI-file image ingestion.
- **Gap:** the spec needed an actual-client proof before any recorded fixture existed.
- **Rationale:** hidden expected text plus retained tool exchanges distinguishes
  seeing pixels from receiving a plausible file path or inferring a scripted answer.
- **Consequence:** this establishes the transport/client boundary only; readability
  of real screen recordings and the eventual edit loop still need their own gates.
