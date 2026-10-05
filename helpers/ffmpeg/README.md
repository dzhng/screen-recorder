# Bundled FFmpeg dependency

This owner prepares FFmpeg and ffprobe from the [pinned source and recipe](provenance.json).
It builds broad LGPL-compatible shared libraries against macOS system frameworks;
the pinned zimg runtime library supplies transfer/primaries conversion. Its source
manifest owns the scalar/ARM operands. A pinned pkgconf builds privately to resolve
that dependency; it is a build tool and never enters the runtime closure. External
libraries are not discovered from the builder's environment. Build output
and source archives stay in ignored storage. Runtime operations never build or
acquire this dependency.

[Preparation](prepare.mjs) downloads only verified source, builds into private
staging, checks native architecture and dependency closure, and commits a complete
hash-bound receipt. Repeating preparation verifies and returns the existing result.
A private whitespace-free compile directory avoids upstream configure path
parsing assumptions; publication commits beside the requested output, verifying
any copy required across filesystems before the atomic rename.
A changed recipe requires a new output rather than replacing an existing result.
The distribution includes matching sources, the build controller, actual build
commands and environment, configuration and required notices for every dependency,
including build-only inputs. Sources and licenses are hash-bound even when their
executables are not shipped. To rebuild from those inputs, use its source folder as
--cache and choose a new --output directory; developer prerequisites apply.
Shared libraries remain replaceable; packaging must preserve their relative load paths.
Staging verifies a prepared distribution before signing a private copy, then seals
that copy's changed hashes. Source and recipe identities remain unchanged. The
app's manifest pins the staged receipt; preparation never rewrites its original.

```sh
node helpers/ffmpeg/prepare.mjs prepare --jobs 4
node helpers/ffmpeg/prepare.mjs verify
node helpers/ffmpeg/smoke.mjs helpers/ffmpeg/.build/distribution
node --test helpers/ffmpeg/prepare.test.mjs
```

The [smoke probe](smoke.mjs) executes small encodes, independent decode/probe,
audio and filter operands, including zscale/tonemap, with system-only PATH. It
proves the selected build, not managed project timing, perceptual quality or an installed app. Integration
remains owned by [service](../../apps/service/README.md) and [release](../../scripts/README.md).
GPL-only components and unsupported optional libraries are not promised by a broad
build. Capability discovery must reflect the shipped inventory, not a host installation.
