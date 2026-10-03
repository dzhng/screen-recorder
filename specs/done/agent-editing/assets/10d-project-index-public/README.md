# Public project screenshot indexes

The actual CLI and MCP adapters prepare and retrieve retained project pictures
through the shared service, queue, native renderer and delivery owner. The
[report](report.json) records empty and audio-only projects, full composition,
dry/processed clip taps, paging and ordered batch errors, child-frame cancellation
and explicit retry, historical generations across restart, and deletion lifetime.
Every selected picture is compared with direct inspection and an independent
geometry oracle. The deletion case reads an open delivery before deleting its
owner, then proves that delivery is revoked while an external copy and another
project remain usable. That one lease is held through the public socket SDK;
CLI/MCP image retrieval normally closes its delivery after downloading.

Run from the repository with a built CLI/service and frozen native worker:

```sh
SCREENREC_NATIVE=/path/to/ScreenRecorderNative node packages/test-harness/editing/project-index-evidence.mjs --out /tmp/project-index-evidence
```

The retained run uses native worker SHA-256
`987dae364b8acd481f1ae8fc8aa3b8ea8db800f959c84fa33ce5d0bcd9cdcca6`.
[Source preservation](source-preservation.json) independently reruns the existing
source-index public journey. Focused core tests pass 92 checks; protocol 19,
service 125 (two skipped), CLI 30, and all seven type/build tasks pass. Logs are
retained beside this report. The deletion negative control removes reclamation
and fails because unfinished index output remains readable. Independent review
found no actionable regression; its service socket checks were sandbox-limited,
while the parent service suite and native journeys ran successfully.

The shared existing retained store owns deletion after active work drains and
leases are revoked; this adds no storage format or background cleanup worker.
The protocol advertises projects on the existing five index operations.

[Fresh skill inspection](../10d-project-index-skill/README.md) remains a separate
acceptance gate: it revealed ambiguous frame-range metadata and a mistaken prose
interpretation. These media checks do not close that clarity issue, all of slice
10d, custom exclusion masks, raw still admission, or release-scale measurements.
