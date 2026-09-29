# Relocated voice runtime evidence

The frozen runtime works from a self-contained local bundle while the donor
interpreter, venv, runtime checkout, old Hugging Face cache and Homebrew paths are
denied by the OS. Both fixed texts retain complete frozen WAV and PCM bytes.
The model remains a separately supplied, verified local path; it was not copied
and the experiment denies writes to it. OS frameworks remain platform prerequisites.
This proves this installed-byte closure on the measured Mac, not cross-machine
portability, public model readiness, distribution or voice quality.

## Artifact and identity

The assembly report records clone-only allocation measurements and packaging
choices. The relative manifest owns file content hashes, modes and symlink targets;
all links stay inside the bundle. Its identity excludes absolute donor paths.
Source paths are provenance in the assembly report, not runtime dependencies.
The local bundle retains all runtime files; large dependency payloads are not Git
assets. The assembly script can reproduce it from the explicitly supplied sources.

The bundle contains the base interpreter binary and library tree, replacing the
base-only site-packages with the complete frozen venv site-packages. Base pip was
not visible in the original venv and is not part of its effective dependency set.
Unused activation/console scripts, absolute venv configuration, headers and docs
are excluded. No source, model, generation setting or dependency version changed.
A relative Python executable link replaces the original absolute link. No venv
configuration is needed: the interpreter finds its adjacent standard library.

The import report records exact Python/platform identity, the matching distribution
map, module paths and loaded native libraries. Static native load commands are
retained separately: old absolute library IDs are not load dependencies, and unused
Homebrew rpaths did not become requirements under denial. All observed non-system
libraries resolved inside the bundle. Strings embedded in build metadata or cached
bytecode can still name donors; the donor-denied execution determines independence.

## Discriminatory controls and limitations

The donor-read control fails with EPERM. An initial import-report probe failed on
a module with a null __file__; the probe was corrected without changing the bundle.
The first service-binding attempt failed before Python startup because a nested
sandbox could not apply its profile under the outer file-denial sandbox. No output
from that attempt is counted as success.

The successful gate uses one combined profile through the existing JSON process
and render-attempt owners. It does not claim that voiceRenderer itself ran beneath
an outer sandbox. Future launch integration should compose one profile rather than
nest sandbox processes. The unchanged worker still performs its frozen preparation
checks, and the harness authenticates interpreter, entry and manifest against 19a's
shipped byte envelopes before launch. The final gate runs two matched generation processes; the earlier successful
pair is retained separately. The harness now snapshots the exact profile, verifies
every donor is readable outside it and denied inside it, and checks network denial
before generation. An allow-donor profile fails with no generated output.
System/Metal caches were not purged.

[The report](report.json) indexes the verified [lossless evidence archive](evidence.tar.xz),
including the complete relative manifest, import/dependency reports, effective
profiles, negative controls, failed attempts and both pairs of full output WAVs.
Observed free-space deltas can include unrelated machine activity; clonefile success
and distinct inodes establish copy-on-write use without writable donor aliases.
