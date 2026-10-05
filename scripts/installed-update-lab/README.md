# Installed update evidence

The [runner](../installed-update-lab.mjs) drives the production app, bundled CLI,
service, Node and patched Sparkle through a real signed local A→B replacement.
Its `--help` owns inputs. Run it only against the committed final release build;
the orchestrating agent supplies approved signing credentials in the environment.
The app's child environment is separately constructed and contains no credentials.

A is the final app with an older fixture version; it is not the historical
published release. B retains final compiled app bytes. Both have a unique fixture
bundle identifier, local signed feed, and private lock namespace under the real
account's cache directory. The production launcher source receives only that
namespace substitution. A `HOME` override alone cannot isolate Sparkle's helper.
The receipt records the exact final kit launcher separately: its signature and
hash are static evidence, not a claim of byte parity with the fixture launcher.

The [library fixture](library.mjs) reuses retained silent media, existing recording
and journal fixtures, and public acquisition/edit/package-export operations.
The lifecycle and journal are synthetic facts; this run captures no new media,
renders no movie and performs no model work. Its focused [restart check](library.test.mjs)
requires an already-built native worker and proves public facts and original-byte
digests survive an ordinary service restart.

An old MCP process holds the launcher lock. The SDK defers rather than waiting
for client closure to trigger installation. The runner records the live usable
old installation, then uses ordinary quit/relaunch and resets only its own
last-check preference to obtain a controlled next automatic cycle. Controlled
Off input proves persistence and prevents checks on the next launch. It does not
exercise the Settings action's live cancellation path; the native-owner and
protected-engine proofs own that contract.

The optional startup failure removes the successor's service entry before signing.
This is a deliberately broken candidate, not a release artifact. The launcher and
Node remain present; the caller's actual failure envelope distinguishes unavailable
service startup from launcher failure. Manual recovery reinstalls the explicitly
retained older same-format fixture archive; no automatic rollback is promised.

Signed public archives and compact diagnostics remain outside Git, bound by the
receipt. Cleanup removes only owned processes, defaults, cache namespace and scratch
library/bundles. The runner proves controlled installed behavior; earlier barrier
proofs own other busy domains, accepted historical evidence owns permissions, and
the release closeout must separately verify published GitHub HTTPS artifacts.
