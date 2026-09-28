# Corrected CLI errors

CLI prefix: `node /Users/david/.codex/worktrees/project-still-composition/screen-recorder/apps/cli/dist/main.js`
Socket: `/tmp/screenrec-project-image-skill-WjPTiH/library/run/service.sock`

Each first command below used `--params /tmp/screenrec-project-image-skill-WjPTiH/agent-output/REQUEST.params.json` rather than stdin and redirected stdout to its corresponding `*.response.json`. All exited 1. Requests are retained in the named `.params.json` files.

- `asset.import`: request `import-portrait.params.json`; response: `{"id":"f137c7ec-c869-482a-9d80-c751fcb689b6","ok":false,"error":{"code":"INVALID_REQUEST","message":"Unexpected token '/', \"/tmp/scree\"... is not valid JSON","retryable":false,"details":{}}}`
- `asset.import`: request `import-card.params.json`; response: `{"id":"c21ae997-9ef2-4152-a8a5-491f64e44f4e","ok":false,"error":{"code":"INVALID_REQUEST","message":"Unexpected token '/', \"/tmp/scree\"... is not valid JSON","retryable":false,"details":{}}}`
- `project.create`: request `create-project.params.json`; response: `{"id":"448aace8-11a4-476d-9a61-636fbf93c7b7","ok":false,"error":{"code":"INVALID_REQUEST","message":"Unexpected token '/', \"/tmp/scree\"... is not valid JSON","retryable":false,"details":{}}}`

Exact command for the first `index.get` (exit 1):

```sh
node /Users/david/.codex/worktrees/project-still-composition/screen-recorder/apps/cli/dist/main.js index.get --socket /tmp/screenrec-project-image-skill-WjPTiH/library/run/service.sock --params - --output /tmp/screenrec-project-image-skill-WjPTiH/agent-output/project-index.json < /tmp/screenrec-project-image-skill-WjPTiH/agent-output/index-project.params.json > /tmp/screenrec-project-image-skill-WjPTiH/agent-output/index-project.response.json
```

Response: `{"id":"a22d0223-42f7-44e5-9a9b-028b38ef2ea8","ok":false,"error":{"code":"INVALID_REQUEST","message":"--output applies only to artifact inspection operations","retryable":false,"details":{}}}`
