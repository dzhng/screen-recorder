# Protected Sparkle input

This product-specific source patch has [native boundary proof](../../specs/auto-update/assets/protected-engine-proof.json), separate from installed product acceptance. The
[upstream pin](upstream.json) and [maintained patch](screenrec.patch) bind its
inputs. Preparation and linking do not establish runtime safety or production
parity; accept the engine only after updater and launcher labs pass against its
actual output.
The fork retains Sparkle's MIT license; deliver that license with the framework.

The existing installer owns explicit installation permission and exclusive CLI
launch exclusion. A staged candidate cannot install on ordinary quit or crash.
The host requests installation only after committing its native/service permit;
the helper obtains the lock before acknowledging stage2. The app is the sole
owner of clean service shutdown and host termination; the helper never sends a
quit event, so cancellation cannot leave a queued updater quit behind.
Earlier will-install callbacks indicate intent. Only the installing callback
acknowledges held exclusion and permits irreversible service EOF. NSXPC transfers
the helper's actual locked open-file description to the host; its retained copy
keeps permission valid even if the helper dies or the callback is delayed. If termination
is desired, the coordinator invokes that callback's retained retry handler only
after proving clean child exit. The distinct final-authorization acknowledgement
arrives through `updaterWillRelaunchApplication`; only then may the host terminate.
Crash before final authorization preserves the installed bundle even after lock
acquisition. If termination
is canceled, the host sends Skip through its retained ready reply; successful cancellation
confirms released exclusion. The helper revokes permission and waits until the
host suppresses callbacks and closes its copy; a typed-transfer acknowledgement
also drains queued descriptor rights before release. A termination deadline starts
revocation rather than expiring permission. Failed channel invalidation is not a
successful cancellation acknowledgement. Once final replacement begins,
cancellation is too late.

The installed, signed host metadata owns `ScreenrecLaunchLockRelativePath`, relative
to the account home already supplied to Sparkle's helper. The app/launcher must
precreate its persistent account-owned private lock file; the helper opens and
locks it but never unlinks or creates it. All entries must use this same inode.
Fixtures use a uniquely owned cache directory under that account home and remove
only their own directory. Feed and archive contents never choose this path.

The helper accepts one host connection for its lifetime and rejects staged
resumability. This reduces accidental permission sources; it does not claim that
self-signed code gains host-authenticated IPC. Same-account code modification is
outside this coordination boundary. Failed locks preserve the live host. The
helper keeps exclusion through replacement and the completion of a quiet launch
request. The app owns interpretation of `--screenrec-update-relaunch`, including
suppressed Settings. Only `SCREENREC_HOME` and `SCREENREC_DEFAULTS` travel through
the existing secure installation input into the relaunch environment; no complete
environment or credentials are copied. Relaunch
failure reports an updated bundle with unavailable startup; it does not roll back.

## Source build

Use a separate checkout at the pinned commit. Do not patch the reference checkout
or share derived data between source generations. Run the builder's `--help` for
its input contract. `--check` verifies pin and real Git patch applicability without
changing the checkout or requiring Xcode. `--prepare-only` applies the exact patch;
preparation is repeatable. Building additionally requires full Xcode and an absent
output directory whose parent exists. `DEVELOPER_DIR` may select a user-installed
Xcode without changing system developer selection.

The [builder](build.mjs) invokes the framework scheme, leaving distribution and
test-app packaging alone. It delivers `Sparkle.framework` and `build-receipt.json`;
an unfinished build retains inputs for diagnosis without a success receipt. The
receipt binds source, patch, toolchain, arguments and the framework's deterministic
file/mode/symlink identity. Signing is disabled for this build input. Final app
assembly owns nested signing. A successful source build still needs the actual
authenticated A→B, failure, race and quiet-relaunch proofs before acceptance.

The builder checks raw tracked bytes, executable modes and symlink targets against
the pinned tree plus patch using a private temporary Git index. Git clean filters
cannot authorize different compiler input. It records its loaded input hashes
before compilation and rejects drift before issuing a success receipt. It also
rejects unexpected files through that same expected index, ignores local replacement
refs, and rejects external Xcode configuration overrides. Interrupted builds terminate their owned compiler
process group; this build cleanup is separate from the non-escalating application
shutdown contract.
