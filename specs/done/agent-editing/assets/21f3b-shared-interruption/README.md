# Shared interruption during primary closure

A shared interruption can reach NativeCapture while it awaits primary encoder
closure. Reading that shared state before the await lost the later diagnostic
from camera authority. The correction reads current shared failure inside the
companion closure task. A primary-only completion failure such as `NO_VIDEO`
continues to stay local to the primary source.

The [manifest](manifest.json) indexes every member of [the archive](evidence.tar.gz).
It retains complete red and green native source snapshots, source/runtime
identities, all regression/control artifacts, both build logs and the full default
suite log. The source snapshots differ only in NativeCapture's failure read.
Every archive member was read back and verified against its byte count and hash.
Executable bytes remain in their separately frozen scratch paths; this durable
packet retains their identities and the actual source bytes.

The regression drives actual NativeCapture through the existing prerecorded input
boundary: pause a healthy take, hold physical input stop, replace the primary
journal inode, then release stop. The finish-time pause-end write emits the real
`JOURNAL_FAILED` callback. Recorded events prove NativeCapture received it before
camera closure. Original code exits 133 at the camera-diagnostic assertion; the
corrected code exits 0 and retains the diagnostic through camera publication and
recovery. The test also verifies one physical stop and one companion closure.
No sleep or production flag controls the failure window.

The corrected camera-only `NO_VIDEO` control and complete default capture suite
also exit 0. Independent settled correction review and root production/test
review are clean. The configured CLI reviewer was not retried. This is controlled
native evidence, with no hardware, model, playback, installed-worker change or
claim about stop deadlines. The [merged checkpoint](merged-verification.json) verifies the corrected root
build, complete default capture gate and retained regression output. The original
source/runtime packets remain unchanged.

The [earlier camera-clock packet](../21f3b-independent-camera-clock/README.md)
retains its original source, artifacts and cross-encode exception unchanged.
This correction packet owns the later shared-interruption finding and its proof.
