# Screenrec still composition acceptance

Created and exported a 2.000 s managed project at 40×64 and 10 fps. The portrait image fills the canvas for the full duration. The card image is placed from 0.300 s through 1.400 s at x=12, y=12, width=24, height=16, using deliberate stretch geometry.

The raw image receipts identify still assets with an `image:0` stream and no sample clock. The portrait import reports stored dimensions 64×40, oriented dimensions 40×64 and orientation 6; its delivered upright source PNG is 40×64. The card import reports 64×40 and orientation 2; its delivered PNG is 64×40. In the edit receipt, each image uses `source: {kind: "hold", atUs: 0}`. That selects the still source; project placement supplies its timeline: portrait `[0, 2,000,000)` µs, card `[300,000, 1,400,000)` µs. The project frame receipts then report project sample times and visible ranges: 0.4 s is sample 400,000 with visibility `[400,000, 500,000)`, and 1.5 s is sample 1,500,000 with visibility `[1,500,000, 1,600,000)`. The former lists both asset/clip layers; the latter lists only the portrait. The card dry tap at 0.4 s lists only the card layer and bypasses its geometry stack.

The retained processed project index is generation `dac04e18-3d7f-40b4-959e-3cbd26061f3e`, pinned to revision `336b4cb6-4fa7-4ea4-a6d3-47e02286b2a0`. It covers 2,000,000 µs, has six selected frames and nine coverage intervals. Its samples show portrait-only at 0 and 0.2 s, both layers from 0.3 to 0.4 s and 1.3 to 1.4 s, then portrait-only at 1.4 and 1.9 s. The other intervals are explicitly marked `unproven`, as they were not sampled.

The historical movie was committed at `/tmp/screenrec-project-image-skill-WjPTiH/agent-output/still-composition.mp4`; that scratch output is no longer retained (3,550 bytes, SHA-256 `7e59e00e632ce41d39258454ab8d5e75fae3c4c47cc22333b7af62082685512f`). The five delivered PNGs were opened for visual inspection: source portrait, source card, processed output at 0.4 and 1.5 s, and card dry tap at 0.4 s.

## Receipts and exact invocation record

This directory retains the exact JSON requests and raw response envelopes. For each command below, `--params -` read the named request from stdin; stdout was redirected to the named response file. A `.poll1.json` file is the result of replaying the same read arguments after the first `processing` response. All commands used this CLI and socket:

`commands.tsv` preserves each exact CLI command line, its exit code, and a short description. `initial-errors.md` preserves the first invalid responses that were overwritten when I retried using stdin. Request/response files below keep the payloads and raw envelopes.

- CLI: `/Users/david/.codex/worktrees/project-still-composition/screen-recorder/apps/cli/dist/main.js`
- Socket: `/tmp/screenrec-project-image-skill-WjPTiH/library/run/service.sock`

| Operation | Request file | Response file(s) | Exit codes |
|---|---|---|---|
| `--help` | none | `../help.json` | 0 |
| `asset.import` portrait | `import-portrait.params.json` | `import-portrait.response.json` | 1 (invalid argument form), then 0 |
| `asset.import` card | `import-card.params.json` | `import-card.response.json` | 1 (invalid argument form), then 0 |
| `project.create` | `create-project.params.json` | `create-project.response.json` | 1 (invalid argument form), then 0 |
| `job.get` portrait/card | `job-portrait.params.json`, `job-card.params.json` | `job-portrait.response.json`, `job-card.response.json` | 0 each |
| `asset.get` portrait/card | `asset-portrait.params.json`, `asset-card.params.json` | `asset-portrait.response.json`, `asset-card.response.json` | 0 each |
| `edit.apply` | `edit-project.params.json` | `edit-project.response.json` | 0 |
| `frame.get` output 0.4 s | `frame-output-04.params.json` | `frame-output-04.response.json`, `frame-output-04.poll1.json` | 0 each |
| `frame.get` output 1.5 s | `frame-output-15.params.json` | `frame-output-15.response.json`, `frame-output-15.poll1.json` | 0 each |
| `frame.get` card dry 0.4 s | `frame-card-dry.params.json` | `frame-card-dry-04.response.json`, `frame-card-dry-04.poll1.json` | 0 each |
| `index.get` processed project | `index-project.params.json` | `index-project.response.json`, `index-project.poll1.json` | 1 with unsupported `--output`, then 0; ready on poll |
| `index.coverage` | `index-coverage.params.json` | `index-coverage.response.json` | 0 |
| `frame.get` raw portrait/card | `frame-source-portrait.params.json`, `frame-source-card.params.json` | matching `.response.json` and `.poll1.json` | 0 each |
| `export.create` | `export-create.params.json` | `export-create.response.json` | 0 |
| `export.status` | `export-status.params.json` | `export-status.response.json` | 0; committed |

Exact command form for successful calls (with the operation, request and response names shown in the table):

```sh
node /Users/david/.codex/worktrees/project-still-composition/screen-recorder/apps/cli/dist/main.js OPERATION --socket /tmp/screenrec-project-image-skill-WjPTiH/library/run/service.sock --params - [--output /tmp/screenrec-project-image-skill-WjPTiH/agent-output/DELIVERED_FILE] < /tmp/screenrec-project-image-skill-WjPTiH/agent-output/REQUEST.params.json > /tmp/screenrec-project-image-skill-WjPTiH/agent-output/RESPONSE.json
```

The CLI rejected three initial calls because I passed a request file path directly to `--params`; it expects JSON on stdin. The error was `INVALID_REQUEST: Unexpected token '/', "/tmp/scree"... is not valid JSON` (exit 1). I then used the documented stdin form and all three operations succeeded. The first `index.get` also rejected `--output` with `INVALID_REQUEST: --output applies only to artifact inspection operations` (exit 1); retrying the same request without `--output` returned processing, and replaying it returned the ready retained index. These errors are preserved here because the first response files for the three corrected calls were overwritten by their successful responses; exact error envelopes and full shell invocations are recorded in `initial-errors.md`.
