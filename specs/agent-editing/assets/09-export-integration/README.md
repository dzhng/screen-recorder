# Project export service integration

Project video exports enter the same MediaExports intent table, JobQueue,
derivative cache and native Publication owner as recording exports. The service
supplies only its actual project domain; no recording adapter or alternate
publication implementation is constructed. Shared admission and capacity events
resume dependencies and recovery. Project deletion retires export obligations
before removing cache files or revision references, preserving external outputs.

The [public journey](../09-first-export/README.md) proves actual CLI/MCP publication
and exact parity with decoded preview bytes. The focused integration checks cover
owner behavior separately:

- [41 service/protocol/deletion checks](service-protocol.txt).
- [10 project owner tests with native publication](owner-tests.txt), using controlled
  renderer payloads; these do not substitute for decoded media.
- [16 core preview/project/cache checks](core-tests.txt).

Core, service, protocol and CLI builds plus core/service type checks passed.
Independent [routing review](routing-review.txt) found shutdown ordering could
wait for export admission before aborting its lifetime. The public-service
[regression failed](shutdown-red.txt) before the fix; the final service checks
prove the admission receives cancellation before manual release, leaves no intent
or destination, and closes the catalog afterward. A bounded independent follow-up
read found the correction sound; it inspected code/tests, not runtime behavior.

The shape review retains one export lifecycle and one target-aware deletion
coordinator. Public schemas preserve exclusive flat owner selectors, and discovery
cursors carry both nullable owner filters unchanged through CLI/MCP. No package
export for managed projects or installed-app cutover is claimed here.
