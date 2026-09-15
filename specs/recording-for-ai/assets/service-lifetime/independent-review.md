Full review comments:

- [P2] Serialize socket reclamation and listener creation — /private/tmp/screenrec-app-service/apps/service/src/main.ts:39-44
  If two instances start against the same home concurrently, both can observe ENOENT or ECONNREFUSED, after which one binds its listener before the other executes this unlink. The second instance then removes a live socket and can announce another successful listener; either process's later cleanup can also remove the other's path. Serialize the reclaim-and-bind sequence across processes rather than treating an earlier connection failure as continuing proof of ownership.

- [P2] Handle control-output errors through listener cleanup — /private/tmp/screenrec-app-service/apps/service/src/main.ts:157-160
  If the app dies while a startup announcement or health response is being written, stdout can emit EPIPE before stdin's EOF handler runs. There is no stdout error listener, so Node exits on the unhandled error without calling `listener.close()`, leaving the socket behind instead of performing the promised parent-death cleanup. Route control-output errors through the same shutdown path as stdin closure.

- [P2] Bound interpreter validation beyond a cooperative SIGTERM — /private/tmp/screenrec-app-service/apps/macos/Sources/ScreenRecorder/NodeRuntime.swift:49-52
  If an interpreter candidate ignores SIGTERM, the watchdog does not terminate it and `readToEnd()` or `waitUntilExit()` can block forever. This validation runs synchronously during `applicationDidFinishLaunching`, so the menu and SIGTERM-driven quit also become unresponsive. Enforce a hard deadline with escalation and a bounded output read, preferably without blocking the main thread.

- [P2] Catch response framing failures before they terminate the service — /private/tmp/screenrec-app-service/apps/service/src/main.ts:134-138
  A valid control request can produce a response exceeding the same 64 KiB limit: an unknown operation containing 65,400 ASCII characters encodes into a 65,438-byte request, but its error response throws FRAME_TOO_LARGE. Because `reply()` executes after the catch, this becomes an unhandled rejection that terminates the service and leaves its socket behind. Bound echoed error content and convert encoding failures into a bounded failure response.
