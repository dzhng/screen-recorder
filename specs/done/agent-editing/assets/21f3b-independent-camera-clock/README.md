# Independent camera clock evidence

This packet retains the isolated `cda9db141db7758ff7970c6044a0c3e30b151cab`
source pass. It proves camera support without primary pictures, a fixed camera
origin across later primary startup, shared host-pause projection, fractional
first-picture admission, and immutable publication/recovery through controlled
native inputs. It does not establish physical synchronization, large-take stop
latency, hardware capture, model behavior, playback or public selector integration.

The [manifest](manifest.json) identifies every member of [the archive](evidence.tar.gz)
and its complete byte digest. The archive includes the original verification
manifest, complete source freeze, all 1,019 retained cohort files, all 43 original
logs, comparison measurements, and original absence/mutation failure artifacts.
Every archived member was read back and checked against its byte count and hash;
canonical media hardlinks retain their same complete bytes.

`original-verification.json` inside the archive identifies the six final passing
executions and their frozen production runtime. `source-freeze.tar.gz` holds
those source bytes. `runtime-identities.json` identifies production and the final
isolated mutation executable; executable bytes remain in their frozen scratch
paths. The final mutation's source is included separately. Earlier mutation
executables were rebuilt, so their historical binaries are not claimed retained.
The intended failing assertions and actual process outcomes remain in the logs.
Earlier development failures are evidence of those attempts, not passing gates.

Separate encodes do not promise identical pixels. In the first publication
comparison, all twelve readable historical/current receipts retain timing and
support, while one picture digest differs. An isolated same-source rerun returns
the historical digest. Each run's own raw-to-canonical picture proof passes. The
precise cross-encode cause remains unestablished; both comparison measurements
and the isolated rerun are retained. The deliberately malformed receipt is
explicitly excluded from that comparison.

This immutable packet predates the independent review's shared-interruption
finding during primary encoder closure. The
[separate correction packet](../21f3b-shared-interruption/README.md) owns its fix,
red/green regression and later source/runtime identities. These original bytes
remain unchanged. Merged-source verification is owned by the integrating agent.
No configured CLI review was retried.
