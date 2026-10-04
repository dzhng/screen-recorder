I can't give you the exact setup procedure: the supplied files don't contain it. The `README.md` delegates all installation detail to `scripts/release-notes.md`, and that file isn't here. Nothing was installed or executed.

## What the supplied files do establish

Only `README.md`, the skill's `SKILL.md` and `references/editorial-checks.md` are in the working directory.

1. **Download source:** the app comes from GitHub Releases at `https://github.com/dzhng/screen-recorder/releases`. Built binaries are release assets, not in source control.
2. **Installation guide:** `scripts/release-notes.md` owns supported systems, bundled runtime, signing status and CLI/MCP setup.
3. **Check the CLI after install:** `screenrec <operation> --help` returns a JSON description and parameter schema without launching the app. `screenrec --help` gives the full operation catalog, which is large, so save it to a file.
4. **Check capture state:** `capture.sources` and `capture.status` report device identities and existing permissions. Discovery activates nothing and triggers no permission prompt.
5. **Fallback launcher:** `bun run screenrec <operation> --help` works only in a built source checkout, which is a different path from the release install you asked for.

## Installation blockers

- **Installation guide missing:** without `scripts/release-notes.md`, these are all unknown:
  - which release asset to download and how to install it;
  - whether macOS 26 on Apple Silicon is supported;
  - whether the build is signed and notarized, which decides whether Gatekeeper blocks first launch;
  - what the bundled runtime covers, and whether anything else must be installed first;
  - how the `screenrec` command gets onto `PATH`, and how MCP is registered.
- **Latest release not checked:** I have no network tool in this session, so I couldn't read the releases page. The current version tag and asset names are unverified.
- **Source-build guide missing:** `scripts/README.md`, which covers native prerequisites and personal source installs, isn't supplied either, so the fallback route is equally undocumented here.
- **Permission steps undocumented:** the files confirm capture depends on permissions but don't say which ones or how to grant them on a fresh Mac.

I have not filled these gaps with guessed commands such as a Homebrew formula, a symlink path or a quarantine override. None of them appear in the supplied files.

## To unblock

Supply `scripts/release-notes.md`, or the body of the latest GitHub release if it carries the same guide. With that I can turn the above into exact, ordered commands.
