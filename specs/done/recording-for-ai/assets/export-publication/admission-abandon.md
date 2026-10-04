# Abandonment during destination admission

A create call can be checking the destination before its durable intent exists.
Returning successful abandonment from that temporary absence allowed the earlier
call to insert an export after the user had closed it.

The existing admission tracker now associates each pending call with its export
identity. The existing retirement promise fences new matching admissions, waits
for already-entered matching calls to drain, and then verifies/removes the intent.
Admission checks that fence again after its destination await. Unrelated exports
remain independent; shutdown still drains every admission. Completed abandonment
still permits an explicitly new request reusing the UUID, as the existing contract
requires. This is a drain of already-entered calls, not cancellation of future
requests or a permanent tombstone.

## Evidence

The actual native destination operation was held for two matching create calls.
The [regression failed before the fix](admission-abandon-red.txt): abandonment
reported success while both calls were still active. The [restored contract passes](admission-abandon-green.txt):
abandonment stays pending, another matching create is refused, an unrelated request
is admitted, both earlier calls are refused after draining, and no intent or output
remains. Existing committed retirement/deletion, UUID reuse and shutdown cases also
pass (four focused checks). The worker was the fresh bundled native executable,
selected explicitly through SCREENREC_NATIVE; media was generated.

Service build/types, changed-file formatting/lint and diff checks pass. Independent
Codex review found no actionable regression. Its runtime attempt used the old debug
helper and failed because that helper lacks storage.externalDirectory; the pinned
bundled-worker results above supply runtime evidence. Shape review keeps the same
admission and retirement owners; decision audit adds no new product choice, table,
scheduler or operation. Native menu interaction remains its own acceptance gate.
