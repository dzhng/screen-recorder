# Project derivative retirement

The project service initializes the shared cache and uses existing native managed-file
removal. Deletion fences new reads/publications, drains jobs, purges derivatives,
then retires revisions and their media references. A held read leaves deletion
retryable; releasing it allows the same durable deletion marker to finish.

The [service regression](../../../../../apps/service/src/project-deletion.test.ts)
uses real catalog, job, cache, project and asset owners. Native file removal is
replaced only at the filesystem seam. It verifies that an interrupted deletion
with a held derivative preserves source references, then removes the derivative
while leaving a sibling project's cache and shared original bytes intact.
[Before](red.txt) fails because deletion incorrectly completes while the file is
held; [after](green.txt) passes. Service build/typecheck also pass.

The [public CLI/MCP deletion journey](public-deletion.json) passes with the new
service initialization. Public preview delivery is not yet implemented, so this
is lifecycle integration evidence, not a rendered-media journey.

Independent Codex review found no actionable regressions. Its service socket checks
were sandbox-blocked; the root run above completed those checks without that
restriction. Shape review reuses existing owners with no new schema, queue,
endpoint or dependency. Public preview/export read revocation and export intent
retirement remain part of slice 09 as those lifetime owners are connected.
